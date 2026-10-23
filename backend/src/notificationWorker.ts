import {isShowingReminder} from './showingReminders';
export type OutboxRecord={
  id:string;
  topic:string;
  aggregateType:string;
  aggregateId:string|null;
  payload:Record<string,unknown>;
  attempts:number;
};

export type NotificationOutboxRepository={
  canDeliver(event:OutboxRecord):Promise<boolean>;
  claimBatch(limit:number):Promise<OutboxRecord[]>;
  managerTelegramUserId(managerId:string):Promise<string|null>;
  ownerTelegramUserId():Promise<string|null>;
  userTelegramUserId(userId:string):Promise<string|null>;
  markProcessed(id:string):Promise<void>;
  markSkipped(id:string,reason?:string):Promise<void>;
  markFailed(id:string,error:string,nextAttemptAt:string):Promise<void>;
  markUndeliverable?(id:string,error:string):Promise<void>;
};

export type TelegramBotSender={
  sendMessage(input:{chatId:string;text:string;deepLink?:string|null;imageUrl?:string|null;buttonLabel?:string|null;preferencesLink?:string|null;richTitle?:boolean}):Promise<void>;
};
export class TelegramDeliveryError extends Error{
 constructor(message:string,public retryAfterSeconds=0,public permanent=false){super(message)}
}

function asString(value:unknown){
  return typeof value==="string"?value:null;
}
export function leadContextText(context:Record<string,unknown>){
 const result:string[]=[];const rub=(n:number)=>new Intl.NumberFormat('ru-RU').format(n)+' ₽';
 for(const [key,label] of [['city','Город'],['rooms','Комнатность']] as const)if(typeof context[key]==='string')result.push(label+': '+context[key].slice(0,100));
 for(const [key,label] of [['price','Стоимость'],['down','Первоначальный взнос'],['min','Бюджет от'],['max','Бюджет до']] as const)if(typeof context[key]==='number'&&Number.isFinite(context[key])&&context[key]>=0)result.push(label+': '+rub(context[key]));
 const programs:Record<string,string>={family:'Семейная ипотека',farEast:'Дальневосточная ипотека',standard:'Базовая ипотека'};
 if(typeof context.program==='string'&&programs[context.program])result.push(programs[context.program]);
 if(typeof context.years==='number'&&Number.isFinite(context.years))result.push('Срок: '+context.years+' лет');
 if(context.purchaseMode==='cash')result.push('Покупка за свои средства');if(context.purchaseMode==='mortgage')result.push('Покупка в ипотеку');
 return result.join('\n').slice(0,1000);
}

function managerText(event:OutboxRecord){
  if(event.topic==='manager.broadcast_test')return userText(event);
  if(event.topic==='manager.showing_reminder')return userText(event);
  if(event.topic==="manager.security_code")return `PULSE.DV · подтверждение входа\nКод: ${asString(event.payload.code)??"—"}\nНикому не сообщайте этот код. Он действует 5 минут.`;
  if(event.topic==="manager.journey")return `PULSE.DV · Обращение клиента\n${asString(event.payload.title)??"Клиент обновил обращение"}\n${asString(event.payload.body)??"Откройте карточку клиента"}`;
  if(event.topic==="manager.interest_changed")return `PULSE.DV · Изменение интереса\n${asString(event.payload.title)??"Клиент уточнил запрос"}\n${asString(event.payload.body)??"Откройте карточку клиента"}`;
  const source=asString(event.payload.source)??'';const sources:Record<string,string>={property:'Карточка ЖК',selection:'Подбор квартиры',catalog:'Каталог',mortgage:'Ипотека',home:'Главная',profile:'Профиль',presentation:'Презентация ЖК',general:'Консультация'};const origin=sources[source.split('-')[0]]??'Мини-приложение';
  if(event.topic==='manager.new_lead')return `PULSE.DV · Новая заявка\n${asString(event.payload.name)??'Клиент'}\nТелефон: ${asString(event.payload.phone)??'В карточке клиента'}\n${asString(event.payload.propertyName)??'Подбор квартиры'}\nГород: ${asString(event.payload.city)??'Пока не указан'}\nИсточник: ${origin}\n${asString(event.payload.contextSummary)??''}\n${asString(event.payload.comment)??''}\n${asString(event.payload.nextAction)??'Свяжитесь с клиентом'}`;
  const score=event.payload.score??"—";
  const priority=event.payload.priority??"new";
  const city=event.payload.city??"—";
  const action=event.payload.nextAction??"Открыть лид в PULSE Control";
  const labels:Record<string,string>={cold:'Новый интерес',warm:'Заинтересованный клиент',hot:'Горячий клиент',urgent:'Нужна быстрая связь',new:'Новый клиент'};
  return `PULSE.DV · ${labels[String(priority)]??'Активность клиента'}\nИнтерес: ${score}/100\nГород: ${city}\n${action}`;
}

function userText(event:OutboxRecord){
  const title=asString(event.payload.title)??"PULSE.DV";
  const body=asString(event.payload.body)??"Есть обновление по вашему подбору.";
  return `${title}${['user.broadcast','manager.broadcast_test'].includes(event.topic)?'\n\n':'\n'}${body}`;
}

function retryAt(attempts:number){
  const seconds=Math.min(3600,Math.max(30,30*Math.pow(2,attempts)));
  return new Date(Date.now()+seconds*1000).toISOString();
}

export async function processNotificationOutbox(
  repo:NotificationOutboxRepository,
  telegram:TelegramBotSender,
  limit=25
){
  const batch=await repo.claimBatch(limit);
  let processed=0;
  let retryAfterSeconds=0;

  for(const event of batch){
    try{
      if(event.topic==='manager.security_code'&&!await repo.canDeliver(event)){await repo.markSkipped(event.id,'Authentication code expired or superseded');continue;}
      if(event.topic.startsWith("manager.")){
        const managerId=asString(event.payload.managerId);
        // Work alerts go only to the owner. Authentication codes remain private to their member.
        if(event.topic==='manager.security_code'&&!managerId)throw new Error("managerId missing");
        const chatId=['manager.security_code','manager.broadcast_test'].includes(event.topic)?await repo.managerTelegramUserId(managerId!):await repo.ownerTelegramUserId();
        if(!chatId)throw new Error(event.topic==='manager.security_code'?"manager Telegram id missing":"owner Telegram id missing");
        if(isShowingReminder(event.topic)&&!await repo.canDeliver(event)){await repo.markSkipped(event.id);continue;}
        await telegram.sendMessage({
          chatId,
          text:managerText(event),
          deepLink:asString(event.payload.deepLink),
          ...(event.topic==='manager.broadcast_test'?{imageUrl:asString(event.payload.imageUrl),buttonLabel:asString(event.payload.buttonLabel),preferencesLink:asString(event.payload.preferencesLink),richTitle:true}:{}),
        });
      }else if(event.topic.startsWith("user.")){
        const userId=asString(event.payload.userId);
        if(!userId)throw new Error("userId missing");
        const chatId=await repo.userTelegramUserId(userId);
        if(!chatId)throw new Error("user Telegram id missing");
        if((isShowingReminder(event.topic)||event.topic==='user.search_updates'||event.topic==='user.broadcast')&&!await repo.canDeliver(event)){await repo.markSkipped(event.id,event.topic==='user.broadcast'?'Broadcast cancelled or subscription changed':event.topic==='user.search_updates'?'Search subscription changed':undefined);continue;}
        await telegram.sendMessage({
          chatId,
          text:userText(event),
          deepLink:asString(event.payload.deepLink),
          ...(event.topic==='user.broadcast'?{imageUrl:asString(event.payload.imageUrl),buttonLabel:asString(event.payload.buttonLabel),preferencesLink:asString(event.payload.preferencesLink),richTitle:true}:{}),
        });
      }else{
        throw new Error("unsupported outbox topic: "+event.topic);
      }

      await repo.markProcessed(event.id);
      processed++;
    }catch(error){
      const message=error instanceof Error?error.message:String(error);
      if(error instanceof TelegramDeliveryError&&error.permanent&&repo.markUndeliverable)await repo.markUndeliverable(event.id,message);
      else await repo.markFailed(event.id,message,error instanceof TelegramDeliveryError&&error.retryAfterSeconds?new Date(Date.now()+error.retryAfterSeconds*1000+1000).toISOString():retryAt(event.attempts));
      // Respect a Telegram-wide flood pause rather than trying the rest of the batch.
      if(error instanceof TelegramDeliveryError&&error.retryAfterSeconds){retryAfterSeconds=error.retryAfterSeconds;break;}
    }
  }

  return{claimed:batch.length,processed,...(retryAfterSeconds?{retryAfterSeconds}:{})};
}
