import {z} from 'zod';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Database,Sql} from './database';
import type {RuntimeConfig} from './config';
import {HttpError} from './security';
import {audit} from './repository';
import {registeredPhone} from './accountRoutes';
import {DEFAULT_GIVEAWAY,type GiveawaySettings} from '../../packages/giveaway';
const iso=z.string().datetime({offset:true});
const settingsSchema=z.object({enabled:z.boolean(),title:z.string().trim().min(1).max(65),prize:z.string().trim().min(1).max(60),startsAt:iso,endsAt:iso,drawAt:iso,rules:z.string().trim().max(24000),version:z.number().int().positive()}).strict();
async function campaign(sql:Sql,lock=false):Promise<GiveawaySettings>{
 await sql.query('insert into giveaway_campaign(id,settings) values(true,$1::jsonb) on conflict do nothing',[JSON.stringify(DEFAULT_GIVEAWAY)]);
 const row=(await sql.query('select * from giveaway_campaign where id=true'+(lock?' for update':''))).rows[0];
 return {...row.settings,version:row.version};
}
function entryView(row:any){return row?{id:row.id,status:row.status,ticket:row.ticket_number===null?null:'PULSE-'+String(row.ticket_number).padStart(4,'0'),createdAt:new Date(row.created_at).toISOString(),registeredAt:row.registered_at?new Date(row.registered_at).toISOString():null,leadId:row.lead_id,reason:row.reason,tickets:(row.tickets??[]).map((ticket:any)=>({id:ticket.id,ticket:'PULSE-'+String(ticket.ticket_number).padStart(4,'0'),leadId:ticket.lead_id,registeredAt:new Date(ticket.registered_at).toISOString()}))}:null;}
async function entryWithTickets(sql:Sql,id:string){const row=(await sql.query('select * from giveaway_entries where id=$1',[id])).rows[0];if(row)row.tickets=(await sql.query('select * from giveaway_tickets where entry_id=$1 order by ticket_number',[id])).rows;return entryView(row);}
async function notify(sql:Sql,config:RuntimeConfig,row:any,status:string,title:string,body:string,ticketId?:string){
 const link=config.PUBLIC_ORIGIN+'/pulsedv/mini-app/#/giveaway';
 await sql.query("insert into outbox_events(topic,aggregate_type,aggregate_id,payload,dedup_key) values('user.giveaway','giveaway',$1,$2::jsonb,$3) on conflict(dedup_key) where dedup_key is not null do nothing",[row.id,JSON.stringify({userId:row.user_id,entryId:row.id,status,title,body,deepLink:link,ticketId}),'giveaway:'+row.id+':'+status+(ticketId?':'+ticketId:'')]);
}
export function registerGiveawayRoutes(app:FastifyInstance,db:Database,config:RuntimeConfig,visitor:(r:FastifyRequest)=>Promise<void>,editor:(r:FastifyRequest)=>Promise<void>){
 app.get('/api/v1/me/giveaway',{preHandler:visitor},async r=>({settings:await campaign(db),entry:await (async()=>{const row=(await db.query('select id from giveaway_entries where user_id=$1',[r.visitor!.userId])).rows[0];return row?entryWithTickets(db,row.id):null})(),serverNow:new Date().toISOString()}));
 app.post('/api/v1/me/giveaway',{preHandler:visitor},async r=>{
  const input=z.object({version:z.number().int().positive(),acceptedRules:z.literal(true)}).strict().parse(r.body);
  const userId=r.visitor!.userId;
  if(!await registeredPhone(db,userId,config.CONSENT_VERSION))throw new HttpError(403,'Подтвердите номер и согласие для участия');
  return db.transaction(async sql=>{
   const s=await campaign(sql,true);
   const existing=(await sql.query('select * from giveaway_entries where user_id=$1',[userId])).rows[0];
   if(existing)return {entry:await entryWithTickets(sql,existing.id)};
   if(!s.enabled||Date.now()<Date.parse(s.startsAt)||Date.now()>=Date.parse(s.endsAt))throw new HttpError(409,'Приём заявок сейчас закрыт');
   if(input.version!==s.version)throw new HttpError(409,'Условия обновились. Откройте их заново');
   const user=(await sql.query('select phone from app_users where id=$1 for update',[userId])).rows[0];
   const row=(await sql.query('insert into giveaway_entries(user_id,phone,rules_version) values($1,$2,$3) on conflict do nothing returning *',[userId,user.phone,s.version])).rows[0];
   if(!row)throw new HttpError(409,'Этот номер телефона уже зарегистрирован в акции');
   await notify(sql,config,row,'pending','Заявка на участие принята','Номер участника будет присвоен после покупки через PULSEDV.RU и проверки государственной регистрации сделки. Откройте приложение, чтобы связаться с менеджером.');
   return {entry:entryView(row)};
  });
 });
 app.get('/api/v1/control/giveaway',{preHandler:editor},async r=>{
  const {page,status}=z.object({page:z.coerce.number().int().min(1).max(10000).default(1),status:z.enum(['all','pending','confirmed','rejected']).default('all')}).strict().parse(r.query);
  const rows=(await db.query(`select e.*,(select coalesce(json_agg(t order by t.ticket_number),'[]'::json) from giveaway_tickets t where t.entry_id=e.id) as tickets,u.first_name,u.last_name,u.telegram_username,u.telegram_user_id::text,
   (select json_build_object('sent',o.processed_at is not null and o.last_error is null,'skipped',o.processed_at is not null and o.last_error is not null,'pushSent',(select count(*) from push_deliveries d where d.event_id=o.id and d.delivered_at is not null),'pushPending',(select count(*) from push_deliveries d where d.event_id=o.id and d.delivered_at is null and d.dead_at is null),'failed',o.dead_at is not null,'error',o.last_error) from outbox_events o where o.topic='user.giveaway' and o.payload->>'entryId'=e.id::text and o.payload->>'status'=e.status order by o.created_at desc,o.id desc limit 1) as delivery
   from giveaway_entries e join app_users u on u.id=e.user_id where ($1='all' or e.status=$1) order by e.created_at desc,e.id limit 21 offset $2`,[status,(page-1)*20])).rows;
  const counts=(await db.query("select count(*) filter(where status='pending')::int pending,count(*) filter(where status='confirmed')::int confirmed,count(*) filter(where status='rejected')::int rejected,(select count(*)::int from giveaway_tickets t join giveaway_entries ge on ge.id=t.entry_id where ge.status='confirmed') tickets from giveaway_entries")).rows[0];
  return {settings:await campaign(db),items:rows.slice(0,20).map(row=>({...entryView(row),userId:row.user_id,phone:row.phone,name:[row.first_name,row.last_name].filter(Boolean).join(' '),username:row.telegram_username,delivery:row.delivery})),hasMore:rows.length>20,page,counts,telegramReady:!!config.BOT_TOKEN};
 });
 app.put('/api/v1/control/giveaway',{preHandler:editor},async r=>{
  const next=settingsSchema.parse(r.body);
  if(Date.parse(next.endsAt)<=Date.parse(next.startsAt)||Date.parse(next.drawAt)<Date.parse(next.endsAt))throw new HttpError(400,'Проверьте даты акции и подведения итогов');
  if(next.enabled&&next.rules.length<100)throw new HttpError(400,'Перед публикацией заполните полные правила акции');
  if(next.enabled&&!config.BOT_TOKEN)throw new HttpError(400,'Подключите Telegram-бота перед публикацией');
  return db.transaction(async sql=>{
   const current=await campaign(sql,true);
   if(current.version!==next.version)throw new HttpError(409,'Настройки изменились. Обновите страницу');
   const hasEntries=!!(await sql.query('select id from giveaway_entries limit 1')).rows.length;
   if(hasEntries&&(['startsAt','endsAt','drawAt'].some(key=>Date.parse(String(next[key as keyof GiveawaySettings]))!==Date.parse(String(current[key as keyof GiveawaySettings])))||['rules','prize'].some(key=>next[key as keyof GiveawaySettings]!==current[key as keyof GiveawaySettings])))throw new HttpError(409,'После первой заявки приз, сроки и принятые правила зафиксированы');
   await sql.query('update giveaway_campaign set settings=$1::jsonb,version=version+1 where id=true',[JSON.stringify(next)]);
   await audit(sql,r.member!.id,'giveaway.settings','new-year-2027',{enabled:next.enabled});
   return {settings:await campaign(sql)};
  });
 });
 app.get('/api/v1/control/giveaway/:id/deals',{preHandler:editor},async r=>{
  const {id}=z.object({id:z.uuid()}).parse(r.params);
  return {items:(await db.query("select l.id,l.name,l.created_at from leads l left join sessions s on s.id=l.session_id join giveaway_entries e on e.id=$1 where coalesce(l.user_id,s.user_id)=e.user_id and l.status='deal' and not exists(select 1 from giveaway_tickets t where t.lead_id=l.id) order by l.created_at desc limit 100",[id])).rows};
 });
 app.post('/api/v1/control/giveaway/:id/confirm',{preHandler:editor},async r=>{
  const {id}=z.object({id:z.uuid()}).parse(r.params);
  const input=z.object({leadId:z.uuid(),registeredAt:iso,registrationReference:z.string().trim().min(3).max(120)}).strict().parse(r.body);
  return db.transaction(async sql=>{
   const s=await campaign(sql,true);
   const row=(await sql.query('select * from giveaway_entries where id=$1 for update',[id])).rows[0];
   if(!row)throw new HttpError(404,'Заявка не найдена');
   if(row.status==='rejected')throw new HttpError(409,'Заявка уже рассмотрена');
   const existing=(await sql.query('select entry_id from giveaway_tickets where lead_id=$1',[input.leadId])).rows[0];
   if(existing){if(existing.entry_id===id)return {entry:await entryWithTickets(sql,id)};throw new HttpError(409,'Эта сделка уже участвует');}
   const at=Date.parse(input.registeredAt);
   if(at<Date.parse(s.startsAt)||at>=Date.parse(s.endsAt)||at>Date.now())throw new HttpError(400,'Регистрация должна состояться в период акции и не позднее текущего времени');
   if(at<new Date(row.created_at).getTime())throw new HttpError(400,'Заявка на участие должна быть подана до регистрации сделки');
   const lead=(await sql.query("select l.id from leads l left join sessions s on s.id=l.session_id where l.id=$1 and coalesce(l.user_id,s.user_id)=$2 and l.status='deal' for update of l",[input.leadId,row.user_id])).rows[0];
   if(!lead)throw new HttpError(400,'Выберите сделку этого клиента со статусом «Сделка»');
   const ticketRow=(await sql.query("insert into giveaway_tickets(entry_id,lead_id,ticket_number,registered_at,registration_reference,reviewed_by) values($1,$2,nextval('giveaway_ticket_numbers'),$3,$4,$5) returning *",[id,input.leadId,input.registeredAt,input.registrationReference,r.member!.id])).rows[0];
   await sql.query("update giveaway_entries set status='confirmed',ticket_number=coalesce(ticket_number,$2),lead_id=coalesce(lead_id,$3),registered_at=coalesce(registered_at,$4),registration_reference=coalesce(registration_reference,$5),reviewed_by=$6,reviewed_at=now() where id=$1",[id,ticketRow.ticket_number,input.leadId,input.registeredAt,input.registrationReference,r.member!.id]);
   const ticket='PULSE-'+String(ticketRow.ticket_number).padStart(4,'0');
   await notify(sql,config,row,'confirmed','Вы участвуете в розыгрыше PULSEDV.RU!','Ваш номер — '+ticket+'. Приз — '+s.prize+'. Дата определения победителя — '+new Date(s.drawAt).toLocaleDateString('ru-RU',{timeZone:'Asia/Vladivostok'})+'. Удачи!',ticketRow.id);
   await audit(sql,r.member!.id,'giveaway.confirm',id,{leadId:input.leadId,ticket,registeredAt:input.registeredAt,registrationReference:input.registrationReference});
   return {entry:await entryWithTickets(sql,id)};
  });
 });
 app.post('/api/v1/control/giveaway/:id/reject',{preHandler:editor},async r=>{
  const {id}=z.object({id:z.uuid()}).parse(r.params);
  const {reason}=z.object({reason:z.string().trim().min(3).max(500)}).strict().parse(r.body);
  return db.transaction(async sql=>{
   await campaign(sql,true);
   const row=(await sql.query("update giveaway_entries set status='rejected',reason=$2,reviewed_by=$3,reviewed_at=now() where id=$1 and status in ('pending','confirmed') returning *",[id,reason,r.member!.id])).rows[0];
   if(!row)throw new HttpError(409,'Заявка уже отклонена или не найдена');
   await notify(sql,config,row,'rejected','Статус участия в акции изменён',reason+' Свяжитесь с менеджером в приложении для уточнения.');
   await audit(sql,r.member!.id,'giveaway.reject',id,{reason});return {entry:entryView(row)};
  });
 });
}
