import {z} from 'zod';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Database,Sql} from './database';
import type {RuntimeConfig} from './config';
import {HttpError} from './security';
import {favoriteOwner} from './favoriteRoutes';
import {audit} from './repository';
import {stat} from 'node:fs/promises';
import {join} from 'node:path';
import {broadcastError,type BroadcastContent,type Broadcast} from '../../packages/broadcasts';
const content=z.object({kind:z.enum(['apartment','promotion','giveaway','news']),title:z.string().trim().min(1).max(120),body:z.string().trim().min(1).max(3500),imageUrl:z.string().regex(/^\/media\/broadcasts\/[a-f0-9-]{36}\.jpg$/).nullable(),buttonLabel:z.string().trim().min(1).max(40),buttonPath:z.string().trim().min(1).max(500)}).strict().superRefine((v,c)=>{const error=broadcastError(v);if(error)c.addIssue({code:'custom',message:error})});
const idOf=(r:FastifyRequest)=>z.object({id:z.uuid()}).parse(r.params).id;
const revision=z.object({version:z.number().int().positive()}).strict();
const subscriberCount=async(sql:Sql)=>Number((await sql.query('select count(*)::int n from announcement_subscriptions s join app_users u on u.id=s.user_id where s.enabled=true and u.telegram_user_id is not null')).rows[0].n);
export async function broadcastView(sql:Sql,row:any):Promise<Broadcast>{
 const counts={sent:row.sent_count,failed:row.failed_count,skipped:row.skipped_count,pending:Math.max(0,row.recipient_count-row.sent_count-row.failed_count-row.skipped_count)};
 return {...row.content,id:row.id,version:row.version,status:row.status==='queued'&&!counts.pending?'completed':row.status,createdAt:new Date(row.created_at).toISOString(),sentAt:row.sent_at?new Date(row.sent_at).toISOString():null,total:row.recipient_count,...counts};
}
export async function registerBroadcastRoutes(app:FastifyInstance,db:Database,config:RuntimeConfig,visitor:(r:FastifyRequest)=>Promise<void>,editor:(r:FastifyRequest)=>Promise<void>){
 app.get('/api/v1/me/announcements',{preHandler:visitor},async r=>db.transaction(async sql=>{
  const identity=await favoriteOwner(sql,r.visitor!.sessionId);
  const row=identity.authenticated?(await sql.query('select enabled from announcement_subscriptions where user_id=$1',[r.visitor!.userId])).rows[0]:null;
  return {enabled:!!row?.enabled,authenticated:identity.authenticated};
 }));
 app.put('/api/v1/me/announcements',{preHandler:visitor,config:{rateLimit:{max:20,timeWindow:'1 minute'}}},async r=>{
  const {enabled}=z.object({enabled:z.boolean()}).strict().parse(r.body);
  return db.transaction(async sql=>{
   const identity=await favoriteOwner(sql,r.visitor!.sessionId);
   if(!identity.authenticated)throw new HttpError(400,'Откройте PULSE через Telegram, чтобы настроить анонсы');
   await sql.query(`insert into announcement_subscriptions(user_id,enabled) values($1,$2) on conflict(user_id) do update set enabled=excluded.enabled,consent_key=gen_random_uuid(),updated_at=now()`,[r.visitor!.userId,enabled]);
   await sql.query("with skipped as (update outbox_events set processed_at=now(),lock_token=null,locked_until=null,last_error='Announcement subscription changed' where topic='user.broadcast' and payload->>'userId'=$1 and processed_at is null and dead_at is null returning aggregate_id) update broadcasts b set skipped_count=skipped_count+s.n from (select aggregate_id,count(*)::int n from skipped group by aggregate_id) s where b.id=s.aggregate_id",[r.visitor!.userId]);
   return {enabled,authenticated:true};
  });
 });
 app.get('/api/v1/control/broadcasts',{preHandler:editor},async r=>{
  const {page}=z.object({page:z.coerce.number().int().min(1).max(10000).default(1)}).strict().parse(r.query);
  const rows=(await db.query('select * from broadcasts order by created_at desc,id limit 21 offset $1',[(page-1)*20])).rows;
  return {items:await Promise.all(rows.slice(0,20).map(row=>broadcastView(db,row))),page,hasMore:rows.length>20,subscribers:await subscriberCount(db),telegramReady:!!config.BOT_TOKEN,testReady:!!config.BOT_TOKEN&&!!(await db.query('select telegram_user_id from team_members where id=$1',[r.member!.id])).rows[0]?.telegram_user_id};
 });
 app.put('/api/v1/control/broadcasts/:id',{preHandler:editor},async r=>{
  const id=idOf(r),input=z.object({version:z.number().int().min(0),content}).strict().parse(r.body);
  if(input.content.imageUrl){const file=await stat(join(config.MEDIA_ROOT,input.content.imageUrl.slice('/media/'.length))).catch(()=>null);if(!file?.isFile()||file.size>8*1024*1024)throw new HttpError(400,'Загрузите фото для рассылки заново');}
  return db.transaction(async sql=>{
   if(input.version===0){const result=await sql.query('insert into broadcasts(id,content,created_by) values($1,$2::jsonb,$3) on conflict(id) do nothing returning *',[id,JSON.stringify(input.content),r.member!.id]);if(!result.rows.length)throw new HttpError(409,'Черновик уже сохранён. Обновите список');await audit(sql,r.member!.id,'broadcast.create',id);return {item:await broadcastView(sql,result.rows[0])};}
   const row=(await sql.query("update broadcasts set content=$2::jsonb,version=version+1 where id=$1 and status='draft' and version=$3 returning *",[id,JSON.stringify(input.content),input.version])).rows[0];
   if(!row)throw new HttpError(409,'Рассылка изменилась или уже отправлена. Обновите список');
   await audit(sql,r.member!.id,'broadcast.edit',id);return {item:await broadcastView(sql,row)};
  });
 });
 const delivery=(c:BroadcastContent)=>({...c,deepLink:c.buttonPath.startsWith('/')?config.PUBLIC_ORIGIN+'/pulsedv/mini-app/#'+c.buttonPath:c.buttonPath,preferencesLink:config.PUBLIC_ORIGIN+'/pulsedv/mini-app/#/profile'});
 app.post('/api/v1/control/broadcasts/:id/test',{preHandler:editor,config:{rateLimit:{max:3,timeWindow:'1 minute'}}},async r=>{
  const id=idOf(r),input=z.object({version:z.number().int().positive(),requestId:z.uuid()}).strict().parse(r.body);
  if(!config.BOT_TOKEN)throw new HttpError(409,'Подключите Telegram-бота на сервере');
  if(!(await db.query('select telegram_user_id from team_members where id=$1',[r.member!.id])).rows[0]?.telegram_user_id)throw new HttpError(400,'Укажите свой Telegram ID в настройках аккаунта Control');
  const row=(await db.query('select * from broadcasts where id=$1 and version=$2',[id,input.version])).rows[0];if(!row)throw new HttpError(409,'Обновите рассылку');
  await db.query("insert into outbox_events(topic,aggregate_type,aggregate_id,payload,dedup_key) values('manager.broadcast_test','broadcast_test',$1,$2::jsonb,$3) on conflict(dedup_key) where dedup_key is not null do nothing",[id,JSON.stringify({...delivery(row.content),managerId:r.member!.id}),`broadcast-test:${r.member!.id}:${input.requestId}`]);
  await audit(db,r.member!.id,'broadcast.test',id);return {queued:true};
 });
 app.post('/api/v1/control/broadcasts/:id/send',{preHandler:editor,config:{rateLimit:{max:5,timeWindow:'1 minute'}}},async r=>{
  const id=idOf(r),{version}=revision.parse(r.body);if(!config.BOT_TOKEN)throw new HttpError(409,'Подключите Telegram-бота на сервере');
  return db.transaction(async sql=>{
   const row=(await sql.query('select * from broadcasts where id=$1 for update',[id])).rows[0];if(!row)throw new HttpError(404,'Рассылка не найдена');
   // Retrying the same send request never creates another delivery per recipient.
   if(row.status!=='draft')return {item:await broadcastView(sql,row)};
   if(row.version!==version)throw new HttpError(409,'Рассылка изменилась. Проверьте предпросмотр заново');
   content.parse(row.content);
   const count=await subscriberCount(sql);if(!count)throw new HttpError(409,'Пока нет пользователей, подписанных на анонсы');
   const inserted=await sql.query(`insert into outbox_events(topic,aggregate_type,aggregate_id,payload,dedup_key) select 'user.broadcast','broadcast',$1::uuid,$2::jsonb||jsonb_build_object('userId',s.user_id::text,'campaignId',$1::text,'consentKey',s.consent_key::text),'broadcast:'||$1::text||':'||s.user_id::text from announcement_subscriptions s join app_users u on u.id=s.user_id where s.enabled=true and u.telegram_user_id is not null on conflict(dedup_key) where dedup_key is not null do nothing returning id`,[id,JSON.stringify(delivery(row.content))]);
   const updated=(await sql.query("update broadcasts set status='queued',sent_at=now(),recipient_count=$2,version=version+1 where id=$1 returning *",[id,inserted.rows.length])).rows[0];
   await audit(sql,r.member!.id,'broadcast.send',id,{recipients:inserted.rows.length});return {item:await broadcastView(sql,updated)};
  });
 });
 app.post('/api/v1/control/broadcasts/:id/cancel',{preHandler:editor},async r=>{
  const id=idOf(r),{version}=revision.parse(r.body);
  return db.transaction(async sql=>{
   const row=(await sql.query("update broadcasts set status='cancelled',version=version+1 where id=$1 and status='queued' and version=$2 returning *",[id,version])).rows[0];if(!row)throw new HttpError(409,'Обновите состояние рассылки');
   await sql.query("with skipped as (update outbox_events set processed_at=now(),lock_token=null,locked_until=null,last_error='Broadcast cancelled' where topic='user.broadcast' and aggregate_id=$1 and processed_at is null and dead_at is null returning id) update broadcasts set skipped_count=skipped_count+(select count(*)::int from skipped) where id=$1",[id]);await audit(sql,r.member!.id,'broadcast.cancel',id);return {item:await broadcastView(sql,(await sql.query('select * from broadcasts where id=$1',[id])).rows[0])};
  });
 });
}
