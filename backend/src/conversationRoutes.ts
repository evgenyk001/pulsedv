import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Database,Sql} from './database';
import type {RuntimeConfig} from './config';
import {z} from 'zod';
import {createHash,randomUUID} from 'node:crypto';
import {HttpError} from './security';
import {lockBuyerIdentity} from './partnerRoutes';
import {leadSchema,safeLeadContext} from './validation';
import {getCatalogProperty} from './catalogRepository';
import {emptyJourney,applyJourney} from '../../packages/journey/model';
import {withMessages} from './journeyMessages';
const schema=z.object({idempotencyKey:z.uuid(),source:z.string().trim().min(1).max(100),propertyId:z.string().max(120).nullable().optional(),context:z.record(z.string(),z.unknown()).optional(),text:z.string().trim().min(1).max(2000),newPurchase:z.boolean().default(false),consent:z.literal(true),consentVersion:z.string(),referralCode:z.string().regex(/^[a-zA-Z0-9_-]{12,64}$/).optional(),referralConsent:z.boolean().optional()}).strict();
export function registerConversationRoutes(app:FastifyInstance,db:Database,config:RuntimeConfig,visitor:(r:FastifyRequest)=>Promise<void>,createLead:(sql:Sql,input:z.infer<typeof leadSchema>,r:FastifyRequest)=>Promise<{id:string}>){
 app.post('/api/v1/me/conversations/start',{preHandler:visitor,config:{rateLimit:{max:10,timeWindow:'1 minute'}}},async r=>{
  const input=schema.parse(r.body),identity=r.visitor!;
  if(!identity.userId)throw new HttpError(401,'Откройте приложение через Telegram');
  if(input.consentVersion!==config.CONSENT_VERSION)throw new HttpError(409,'Условия обновились. Перезагрузите приложение');
  if(input.referralCode&&!input.referralConsent)throw new HttpError(400,'Подтвердите рекомендацию');
  return db.transaction(async sql=>{
   await sql.query('select id from sessions where id=$1 for update',[identity.sessionId]);
   const user=(await sql.query('select u.* from app_users u join telegram_contact_consent c on c.user_id=u.id where u.id=$1 and u.phone is not null and c.accepted_at is not null',[identity.userId])).rows[0];
   if(!user)throw new HttpError(403,'Подтвердите свой номер в Telegram');
   await lockBuyerIdentity(sql,user.phone,identity.userId);
   const context=safeLeadContext(input.context??{});
   context.source=input.source;
   const fingerprint=createHash('sha256').update(JSON.stringify({...input,context:Object.entries(context).sort(([a],[b])=>a.localeCompare(b))})).digest('hex');
   const prior=(await sql.query('select * from conversation_starts where user_id=$1 and idempotency_key=$2',[identity.userId,input.idempotencyKey])).rows[0];
   if(prior){if(prior.fingerprint!==fingerprint)throw new HttpError(409,'Ключ сообщения уже использован');return {id:prior.lead_id,duplicate:true};}
   if(input.propertyId){const property=await getCatalogProperty(sql,input.propertyId,'published');if(!property)throw new HttpError(400,'Объект больше не опубликован');context.propertyName=property.name;context.propertyId=property.id;}
   const active=!input.newPurchase&&!input.referralCode?(await sql.query(`select id,manager_id from leads where user_id=$1 and status not in ('closed','lost','deal') and ($2::text is null or property_id=$2 or property_id is null) order by case when property_id=$2 then 0 else 1 end,created_at desc,id desc limit 1 for update`,[identity.userId,input.propertyId??null])).rows[0]:null;
   const fullName=([user.first_name,user.last_name].filter(Boolean).join(' ').trim()||user.telegram_username||'').slice(0,100);
   const result=active??await createLead(sql,leadSchema.parse({idempotencyKey:input.idempotencyKey,source:input.source,propertyId:input.propertyId??null,name:fullName.length>=2?fullName:'Клиент Telegram',phone:user.phone,comment:input.text,context,consent:true,consentVersion:config.CONSENT_VERSION,referralCode:input.referralCode,referralConsent:input.referralConsent}),r);
   const current=await withMessages(sql,(await sql.query('select document from client_journeys where lead_id=$1',[result.id])).rows[0]?.document??emptyJourney(result.id));
   const next=applyJourney(current,{type:'message',id:randomUUID(),text:input.text,requestContext:context},'client');
   const message=next.messages!.at(-1)!;
   await sql.query('insert into journey_messages(id,lead_id,document) values($1,$2,$3::jsonb)',[message.id,result.id,JSON.stringify(message)]);
   const {messages,messagesBefore,...document}=next;
   await sql.query('insert into client_journeys(lead_id,revision,document) values($1,$2,$3::jsonb) on conflict(lead_id) do update set revision=excluded.revision,document=excluded.document,updated_at=now()',[result.id,next.revision,JSON.stringify(document)]);
   await sql.query("insert into user_events(idempotency_key,session_id,user_id,event_type,entity_type,entity_id,metadata,occurred_at) values($1,$2,$3,'client_message','lead',$4,'{}',now())",['conversation:'+input.idempotencyKey,identity.sessionId,identity.userId,result.id]);
   if(active)await sql.query("insert into outbox_events(topic,aggregate_type,aggregate_id,payload) values('manager.journey','lead',$1,$2::jsonb)",[result.id,JSON.stringify({managerId:active.manager_id,title:'Клиент написал сообщение',body:input.text.slice(0,500),deepLink:config.PUBLIC_ORIGIN+'/pulsedv/control-center/#/leads?lead='+result.id})]);
   await sql.query('insert into conversation_starts(user_id,idempotency_key,fingerprint,lead_id) values($1,$2,$3,$4)',[identity.userId,input.idempotencyKey,fingerprint,result.id]);
   return {id:result.id,duplicate:false};
  });
 });
}
