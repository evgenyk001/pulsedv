import {ensureAnnouncementSubscription} from './announcementSubscriptions';
import {setTimeout} from 'node:timers/promises';
import type {Database,Sql} from './database';
import type {RuntimeConfig} from './config';

type BotConfig=Pick<RuntimeConfig,'BOT_TOKEN'|'PUBLIC_ORIGIN'|'CONSENT_VERSION'>;
type Message={chat:{id:number;type:string};from?:{id:number;is_bot?:boolean;first_name:string;last_name?:string;username?:string};text?:string;contact?:{user_id?:number;phone_number:string};forward_origin?:unknown};
type Update={update_id:number;message?:Message};
type BotCall=(method:string,body:Record<string,unknown>)=>Promise<any>;
class BotError extends Error{constructor(public code:number,public retryAfter=0){super('Telegram API rejected request ('+code+')')}}
export function telegramBotApi(config:BotConfig,signal:AbortSignal,send:typeof fetch=fetch):BotCall{
 return async(method,body)=>{
  const response=await send('https://api.telegram.org/bot'+config.BOT_TOKEN+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.any([signal,AbortSignal.timeout(35000)])});
  const result=await response.json() as any;
  if(!response.ok||!result.ok)throw new BotError(result.error_code??response.status,result.parameters?.retry_after??0);
  return result.result;
 };
}
export async function handleBotUpdate(sql:Sql,config:BotConfig,call:BotCall,update:Update){
 const m=update.message,u=m?.from;
 if(!m||m.chat.type!=='private'||!u||u.is_bot||m.chat.id!==u.id)return;
 const url=config.PUBLIC_ORIGIN+'/pulsedv/mini-app/';
 const open=async(text:string)=>{
  // Remove the contact keyboard before showing the application button.
  await call('sendMessage',{chat_id:m.chat.id,text,reply_markup:{remove_keyboard:true}});
  await call('sendMessage',{chat_id:m.chat.id,text:'Каталог, избранное, подбор и расчёт ипотеки — в одном приложении.',reply_markup:{inline_keyboard:[[{text:'Открыть PULSEDV.RU',web_app:{url}}]]}});
 };
 const requestPhone=async()=>{
  await call('sendMessage',{chat_id:m.chat.id,text:'Добро пожаловать в PULSEDV.RU!\n\nНовостройки Приморья, планировки, избранное и расчёт ипотеки — в одном приложении.\n\nДля входа подтвердите свой номер телефона в Telegram.',link_preview_options:{is_disabled:true},reply_markup:{inline_keyboard:[[{text:'Войти и подтвердить номер',web_app:{url}}],[{text:'Согласие на обработку данных',web_app:{url:url+'#/personal-data-consent'}}],[{text:'Политика конфиденциальности',web_app:{url:url+'#/privacy'}}]]}});
 };
 if(/^\/(start|help)(?:@\w+)?(?:\s|$)/.test(m.text??'')){
  const user=(await sql.query('insert into app_users(telegram_user_id,telegram_username,first_name,last_name) values($1,$2,$3,$4) on conflict(telegram_user_id) do update set telegram_username=excluded.telegram_username,first_name=excluded.first_name,last_name=excluded.last_name,last_seen_at=now() returning id,phone',[u.id,u.username??null,u.first_name,u.last_name??null])).rows[0];
  await ensureAnnouncementSubscription(sql,user.id);
  if(user.phone){await open('С возвращением в PULSEDV.RU!');return;}
  await sql.query('insert into telegram_contact_consent(user_id,consent_version) values($1,$2) on conflict(user_id) do update set requested_at=now(),consent_version=excluded.consent_version,accepted_at=null',[user.id,config.CONSENT_VERSION]);
  await requestPhone();return;
 }
 if(m.contact){
  const phone='+'+m.contact.phone_number.replace(/\D/g,'');
  if(m.forward_origin||m.contact.user_id!==u.id||!/^\+[1-9]\d{6,14}$/.test(phone)){
   await call('sendMessage',{chat_id:m.chat.id,text:'Поделитесь именно своим номером кнопкой «Поделиться номером». Чужие и пересланные контакты не сохраняем.'});return;
  }
  const accepted=await sql.query('update telegram_contact_consent c set accepted_at=now() from app_users u where c.user_id=u.id and u.telegram_user_id=$1 and c.consent_version=$2 and c.requested_at>now()-interval \'24 hours\' returning u.id',[u.id,config.CONSENT_VERSION]);
  if(!accepted.rows[0]){await call('sendMessage',{chat_id:m.chat.id,text:'Для подключения номера нажмите /start и ознакомьтесь с условиями.'});return;}
  await sql.query('update app_users set phone=$2,first_name=$3,last_name=$4,telegram_username=$5,updated_at=now() where id=$1',[accepted.rows[0].id,phone,u.first_name,u.last_name??null,u.username??null]);
  await open('Спасибо! Ваш номер сохранён в аккаунте PULSEDV.RU.');return;
 }
 if(m.text==='Продолжить без номера'){await requestPhone();return;}
 if(m.text)await call('sendMessage',{chat_id:m.chat.id,text:'Нажмите /start, чтобы открыть приложение или подключить свой номер. Обращения менеджеру доступны в приложении.'});
}

export async function pollBotUpdates(db:Database,config:BotConfig,call:BotCall){
 return db.transaction(async sql=>{
  // One consumer even during overlapping worker restarts. Offset survives restarts.
  const lock=(await sql.query('select pg_try_advisory_xact_lock(739128) as acquired')).rows[0];
  if(!lock.acquired)return;
  const cursor=(await sql.query('select next_update_id from telegram_bot_cursor where singleton=true')).rows[0];
  const updates:Update[]=await call('getUpdates',{offset:Number(cursor.next_update_id),timeout:20,limit:10,allowed_updates:['message']});
  for(const update of updates){
   try{await handleBotUpdate(sql,config,call,update)}catch(error){
    if(!(error instanceof BotError&&error.code===403))throw error; // Blocked chats must not stall everyone else.
   }
   await sql.query('update telegram_bot_cursor set next_update_id=$1 where singleton=true',[update.update_id+1]);
  }
 });
}
export async function runTelegramBot(db:Database,config:BotConfig,signal:AbortSignal){
 if(!config.BOT_TOKEN)return;
 const call=telegramBotApi(config,signal);
 while(!signal.aborted){
  let delay=500;
  try{await pollBotUpdates(db,config,call)}catch(error){
   if(signal.aborted)return;
   // Never log fetch errors: their URL can contain the bot token.
   console.error('Telegram bot polling failed; will retry',error instanceof BotError?error.code:'network/database');
   delay=Math.max(5000,error instanceof BotError?error.retryAfter*1000:0);
  }
  await setTimeout(delay,undefined,{signal}).catch(()=>{});
 }
}
