import {test} from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
import {handleBotUpdate,pollBotUpdates} from '../src/telegramBot';
import {prepareTelegramWindow} from '../../apps/mini-app/src/helpers/telegramWindow';
const config={BOT_TOKEN:'test',PUBLIC_ORIGIN:'https://pulsedv.ru',CONSENT_VERSION:'test-v1'};
const message=(extra:Record<string,unknown>={})=>({update_id:1,message:{chat:{id:123,type:'private'},from:{id:123,first_name:'Тест'},...extra}});

test('Telegram fullscreen is requested once, older/unsupported clients keep working',()=>{
 let fullscreen=0,expanded=0;
 const tg={initData:'signed',isVersionAtLeast:()=>true,requestFullscreen:()=>{fullscreen++},expand:()=>{expanded++}};
 prepareTelegramWindow(tg);prepareTelegramWindow(tg);
 assert.equal(fullscreen,1);assert.equal(expanded,2);
 prepareTelegramWindow({...tg,initData:''});prepareTelegramWindow({...tg,isVersionAtLeast:()=>false});
 assert.equal(fullscreen,1);
 assert.doesNotThrow(()=>prepareTelegramWindow({...tg,expand:()=>{throw Error()},requestFullscreen:()=>{throw Error()}}));
});
test('Bot requests consent, rejects foreign/forwarded contacts and binds own phone to existing Telegram account',async()=>{
 const db=await testDatabase();
 try{
  await migrate(db);const sent:any[]=[];const call=async(method:string,body:any)=>{sent.push({method,...body});return []};
  await handleBotUpdate(db,config,call,message({text:'/start'}));
  assert.ok(sent[0].reply_markup.inline_keyboard[0][0].web_app);assert.doesNotMatch(sent[0].text,/https?:|без передачи/);
  assert.match(sent[0].reply_markup.inline_keyboard[1][0].web_app.url,/#\/personal-data-consent/);
  const user=(await db.query('select * from app_users where telegram_user_id=123')).rows[0];
  assert.equal(user.phone,null);
  for(const extra of [{contact:{user_id:555,phone_number:'79991234567'}},{contact:{user_id:123,phone_number:'79991234567'},forward_origin:{type:'user'}},{contact:{phone_number:'79991234567'}}])await handleBotUpdate(db,config,call,message(extra));
  assert.equal((await db.query('select phone from app_users where id=$1',[user.id])).rows[0].phone,null);
  await handleBotUpdate(db,config,call,message({contact:{user_id:123,phone_number:'7 999 123-45-67'}}));
  assert.equal((await db.query('select phone from app_users where id=$1',[user.id])).rows[0].phone,'+79991234567');
  assert.ok((await db.query('select accepted_at from telegram_contact_consent where user_id=$1',[user.id])).rows[0].accepted_at);
  assert.equal(sent.at(-1).reply_markup.inline_keyboard[0][0].web_app.url,'https://pulsedv.ru/pulsedv/mini-app/');
  const count=sent.length;await handleBotUpdate(db,config,call,message({text:'/start'}));
  assert.equal(sent.length,count+2);assert.equal(sent[count].reply_markup.remove_keyboard,true);
  assert.equal(Number((await db.query('select count(*) from app_users')).rows[0].count),1);
 }finally{await db.close()}
});
test('Bot ignores groups and requires a recent consent prompt; skip does not save a phone',async()=>{
 const db=await testDatabase();try{
  await migrate(db);const sent:any[]=[];const call=async(_:string,body:any)=>{sent.push(body);return []};
  await handleBotUpdate(db,config,call,message({chat:{id:-100,type:'group'},text:'/start'}));assert.equal(sent.length,0);
  await handleBotUpdate(db,config,call,message({contact:{user_id:123,phone_number:'79991234567'}}));assert.match(sent.at(-1).text,/\/start/);
  await handleBotUpdate(db,config,call,message({text:'/start'}));
  await db.query("update telegram_contact_consent set requested_at=now()-interval '2 days'");
  await handleBotUpdate(db,config,call,message({contact:{user_id:123,phone_number:'79991234567'}}));assert.match(sent.at(-1).text,/\/start/);
  await handleBotUpdate(db,config,call,message({text:'Продолжить без номера'}));
  assert.equal((await db.query('select phone from app_users')).rows[0].phone,null);
 }finally{await db.close()}
});
test('Polling persists cursor only after handling and retries failed updates',async()=>{
 const db=await testDatabase();try{
  await migrate(db);let fail=true;let offset=0;
  const call=async(method:string,body:any)=>{if(method==='getUpdates'){offset=body.offset;return [message({text:'/start'})]}if(fail)throw Error('offline');return {}};
  await assert.rejects(pollBotUpdates(db,config,call));assert.equal(Number((await db.query('select next_update_id from telegram_bot_cursor')).rows[0].next_update_id),0);
  fail=false;await pollBotUpdates(db,config,call);assert.equal(offset,0);
  assert.equal(Number((await db.query('select next_update_id from telegram_bot_cursor')).rows[0].next_update_id),2);
 }finally{await db.close()}
});
