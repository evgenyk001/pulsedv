import Fastify, { type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { randomUUID } from 'node:crypto';
import { z, ZodError } from 'zod';
import type { Database, Sql } from './database';
import { camelRow } from './database';
import type { RuntimeConfig } from './config';
import { HttpError, tokenHash, checkPassword, hashPassword, issueToken } from './security';
import { verifyTelegramInitData } from './telegramInitData';
import { stateSchema, leadSchema, eventsSchema, safeMetadata } from './validation';
import { audit, leadRepository, readState } from './repository';
import { ingestEventBatch, processSessionIntent } from './leadEngineService';

type Member={id:string;name:string;email:string;role:'owner'|'admin'|'manager';active:boolean};
type Visitor={sessionId:string;userId:string|null};
declare module 'fastify' {interface FastifyRequest {member?:Member;visitor?:Visitor}}
const uuid=(value:unknown)=>z.uuid().parse(value);
const memberView=(row:any)=>({id:row.id,name:row.name,email:row.email,role:row.role,active:row.active,cities:row.cities,telegramUserId:row.telegram_user_id?.toString()??null});

export async function createApp(db:Database,config:RuntimeConfig){
 const app=Fastify({bodyLimit:1_500_000,trustProxy:config.TRUST_PROXY_HOPS?(_address:string,hop:number)=>hop<config.TRUST_PROXY_HOPS:false,logger:config.NODE_ENV!=='test'?{redact:['req.headers.authorization','req.headers.cookie','res.headers["set-cookie"]']}:false});
 await app.register(cookie);
 await app.register(rateLimit,{max:180,timeWindow:'1 minute'});
 const dummyPassword=await hashPassword('dummy-non-account-password');
 app.addHook('onRequest',async(request,reply)=>{
  reply.header('X-Content-Type-Options','nosniff').header('Cache-Control','no-store');
  if(!['GET','HEAD','OPTIONS'].includes(request.method)){
   if(request.headers.origin&&request.headers.origin!==config.PUBLIC_ORIGIN)throw new HttpError(403,'Недопустимый источник запроса');
   if(!request.headers['content-type']?.startsWith('application/json'))throw new HttpError(415,'Требуется application/json');
  }
 });
 app.setErrorHandler((error,request,reply)=>{
  if(error instanceof ZodError)return reply.code(400).send({error:error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; '),code:'VALIDATION'});
  const status=error instanceof HttpError?error.statusCode:((error as any).statusCode||500);
  if(status>=500)request.log.error({err:error,requestId:request.id},'API request failed');
  return reply.code(status).send({error:status>=500?'Сервис временно недоступен. Повторите попытку.':error instanceof Error?error.message:'Ошибка запроса',requestId:request.id});
 });
 async function control(request:FastifyRequest){
  const token=request.cookies.pulse_control;if(!token)throw new HttpError(401,'Войдите в PULSE Control');
  const row=(await db.query("select m.* from auth_tokens t join team_members m on m.id=t.member_id where t.token_hash=$1 and t.kind='control' and t.expires_at>now() and m.active=true",[tokenHash(token)])).rows[0];
  if(!row)throw new HttpError(401,'Сессия истекла. Войдите снова');request.member=memberView(row);
 }
 async function editor(request:FastifyRequest){await control(request);if(request.member!.role==='manager')throw new HttpError(403,'Нужны права администратора');}
 async function owner(request:FastifyRequest){await control(request);if(request.member!.role!=='owner')throw new HttpError(403,'Нужны права владельца');}
 async function visitor(request:FastifyRequest){
  const token=request.headers.authorization?.replace(/^Bearer /,'');if(!token)throw new HttpError(401,'Сессия не создана');
  const row=(await db.query("select s.id,s.user_id from auth_tokens t join sessions s on s.id=t.session_id where t.token_hash=$1 and t.kind='visitor' and t.expires_at>now()",[tokenHash(token)])).rows[0];
  if(!row)throw new HttpError(401,'Сессия истекла');request.visitor={sessionId:row.id,userId:row.user_id};
 }
 const sessionLock=async(sql:Sql,id:string)=>{await sql.query('select id from sessions where id=$1 for update',[id]);};
 const cookieOptions={httpOnly:true,secure:config.NODE_ENV==='production',sameSite:'strict' as const,path:'/api/v1/control',maxAge:8*3600};
 app.get('/health',async()=>({status:'ok'}));
 app.get('/ready',async()=>{await db.query('select 1');await readState(db);return {status:'ready'};});
 app.get('/api/v1/public/state',async()=>{const {state,version}=await readState(db);return {version,consentVersion:config.CONSENT_VERSION,state:{...state,properties:state.properties.filter(p=>p.status==='published'),banners:state.banners.filter(b=>b.enabled)}};});
 app.get('/api/v1/public/map',async()=>{if(!config.MAP_2GIS_KEY)throw new HttpError(503,'Карта временно недоступна');return {provider:'2gis',key:config.MAP_2GIS_KEY};});
 app.post('/api/v1/auth/session',{config:{rateLimit:{max:20,timeWindow:'1 minute'}}},async request=>{
  const input=z.object({source:z.string().max(100).optional()}).parse(request.body);
  return db.transaction(async sql=>{const id=randomUUID();await sql.query('insert into sessions(id,source) values($1,$2)',[id,input.source||'web']);const auth=await issueToken(sql,'visitor',id);return {sessionId:id,accessToken:auth.token,expiresAt:auth.expiresAt};});
 });
 app.post('/api/v1/auth/telegram',{preHandler:visitor,config:{rateLimit:{max:20,timeWindow:'1 minute'}}},async request=>{
  const input=z.object({initData:z.string().min(1).max(15000)}).strict().parse(request.body);
  if(!config.BOT_TOKEN)throw new HttpError(503,'Telegram пока не настроен');
  let verified;try{verified=verifyTelegramInitData(input.initData,config.BOT_TOKEN);}catch{throw new HttpError(401,'Не удалось подтвердить вход Telegram');}
  if(!verified.user||!Number.isSafeInteger(verified.user.id)||verified.user.id<=0)throw new HttpError(401,'Не удалось подтвердить пользователя');
  const user=verified.user;
  await db.transaction(async sql=>{
   await sessionLock(sql,request.visitor!.sessionId);
   const current=(await sql.query('select u.telegram_user_id from sessions s left join app_users u on u.id=s.user_id where s.id=$1',[request.visitor!.sessionId])).rows[0];
   if(current?.telegram_user_id&&String(current.telegram_user_id)!==String(user.id))throw new HttpError(409,'Эта сессия уже принадлежит другому пользователю');
   const row=(await sql.query('insert into app_users(telegram_user_id,telegram_username,first_name,last_name) values($1,$2,$3,$4) on conflict(telegram_user_id) do update set telegram_username=excluded.telegram_username,first_name=excluded.first_name,last_name=excluded.last_name,last_seen_at=now() returning id',[user.id,user.username??null,user.first_name,user.last_name??null])).rows[0];
   await sql.query('update sessions set user_id=$2,telegram_start_param=$3 where id=$1',[request.visitor!.sessionId,row.id,verified.startParam]);
   for(const table of ['user_events','visitor_profiles','leads'])await sql.query(`update ${table} set user_id=$2 where session_id=$1`,[request.visitor!.sessionId,row.id]);
  });return {ok:true};
 });
 app.post('/api/v1/events',{preHandler:visitor},async request=>{
  const {events}=eventsSchema.parse(request.body);const identity=request.visitor!;
  for(const e of events)if(Date.parse(e.occurredAt)>Date.now()+60_000||Date.parse(e.occurredAt)<Date.now()-30*86400_000)throw new HttpError(400,'Событие вне допустимого временного окна');
  return db.transaction(async sql=>{
   await sessionLock(sql,identity.sessionId);
   return ingestEventBatch(leadRepository(sql),events.map(e=>({...e,sessionId:identity.sessionId,userId:identity.userId,entityType:e.entityType??null,entityId:e.entityId??null,metadata:safeMetadata(e.metadata),createdAt:e.occurredAt})));
  });
 });
 app.post('/api/v1/leads',{preHandler:visitor,config:{rateLimit:{max:10,timeWindow:'1 minute'}}},async request=>{
  const input=leadSchema.parse(request.body);if(input.consentVersion!==config.CONSENT_VERSION)throw new HttpError(409,'Условия обработки данных обновились. Обновите страницу');
  return db.transaction(async sql=>{
   const session=request.visitor!;await sessionLock(sql,session.sessionId);
   const existing=(await sql.query('select id,name,phone,source,property_id,comment from leads where session_id=$1 and idempotency_key=$2',[session.sessionId,input.idempotencyKey])).rows[0];
   if(existing){if(existing.name!==input.name||existing.phone!==input.phone||existing.source!==input.source||existing.property_id!==(input.propertyId??null)||existing.comment!==(input.comment??null))throw new HttpError(409,'Ключ заявки уже использован');return {ok:true,id:existing.id,duplicate:true};}
   if(input.propertyId&&!(await readState(sql)).state.properties.some(p=>p.id===input.propertyId&&p.status==='published'))throw new HttpError(400,'Объект больше не опубликован');
   const row=(await sql.query('insert into leads(session_id,user_id,idempotency_key,source,property_id,name,phone,comment,consent_at,consent_version) values($1,$2,$3,$4,$5,$6,$7,$8,now(),$9) returning id',[session.sessionId,session.userId,input.idempotencyKey,input.source,input.propertyId??null,input.name,input.phone,input.comment??null,config.CONSENT_VERSION])).rows[0];
   const repo=leadRepository(sql);
   await repo.insertEvents([{idempotencyKey:'lead:'+row.id,sessionId:session.sessionId,userId:session.userId,eventType:'lead_created',entityType:'lead',entityId:row.id,metadata:{source:input.source},createdAt:new Date().toISOString()}]);
   const processed=await processSessionIntent(repo,session.sessionId);
   if(processed.lead?.managerId)await repo.enqueueOutbox({topic:'manager.new_lead',aggregateType:'lead',aggregateId:row.id,payload:{managerId:processed.lead.managerId,score:processed.result.score,priority:processed.result.priority,city:processed.result.city,nextAction:processed.result.recommendedAction,deepLink:config.PUBLIC_ORIGIN+'/pulsedv/control-center/#/leads?lead='+row.id}});
   return {ok:true,id:row.id,duplicate:false};
  });
 });
 app.post('/api/v1/control/login',{config:{rateLimit:{max:5,timeWindow:'1 minute'}}},async(request,reply)=>{
  const {email,password}=z.object({email:z.email().max(254),password:z.string().min(1).max(200)}).parse(request.body);
  const row=(await db.query('select * from team_members where lower(email)=$1 and active=true',[email.trim().toLowerCase()])).rows[0];
  const valid=await checkPassword(password,row?.password_hash||dummyPassword);
  if(!row||!valid)throw new HttpError(401,'Неверный email или пароль');
  const auth=await issueToken(db,'control',row.id);reply.setCookie('pulse_control',auth.token,cookieOptions);await audit(db,row.id,'login',row.id);return {member:memberView(row)};
 });
 app.post('/api/v1/control/password',{preHandler:control,config:{rateLimit:{max:5,timeWindow:'1 minute'}}},async(request,reply)=>{
  const input=z.object({currentPassword:z.string().max(200),newPassword:z.string().min(14).max(200)}).strict().parse(request.body);
  await db.transaction(async sql=>{const member=(await sql.query('select password_hash from team_members where id=$1 for update',[request.member!.id])).rows[0];if(!await checkPassword(input.currentPassword,member.password_hash))throw new HttpError(400,'Текущий пароль не совпадает');await sql.query('update team_members set password_hash=$2 where id=$1',[request.member!.id,await hashPassword(input.newPassword)]);await sql.query('delete from auth_tokens where member_id=$1',[request.member!.id]);await audit(sql,request.member!.id,'password.change',request.member!.id);});
  reply.clearCookie('pulse_control',cookieOptions);return {ok:true};
 });
 app.post('/api/v1/control/notifications/:id/retry',{preHandler:editor},async request=>{
  const id=uuid((request.params as any).id);
  const result=await db.query("update outbox_events set dead_at=null,attempts=0,available_at=now(),last_error=null where id=$1 and processed_at is null and (locked_until is null or locked_until<now()) returning id",[id]);
  if(!result.rows.length)throw new HttpError(409,'Уведомление уже доставлено или обрабатывается');await audit(db,request.member!.id,'notification.retry',id);return {ok:true};
 });
 app.get('/api/v1/control/me',{preHandler:control},async request=>({member:request.member}));
 app.post('/api/v1/control/logout',{preHandler:control},async(request,reply)=>{await db.query('delete from auth_tokens where token_hash=$1',[tokenHash(request.cookies.pulse_control!)]);reply.clearCookie('pulse_control',cookieOptions);return {ok:true};});
 app.get('/api/v1/control/snapshot',{preHandler:control},async request=>{
  const m=request.member!;const scoped=m.role==='manager';const {state,version}=await readState(db);
  const leads=(await db.query(`select * from leads ${scoped?'where manager_id=$1':''} order by score desc,created_at desc limit 1000`,scoped?[m.id]:[])).rows.map(row=>{const lead=camelRow(row);lead.manager=lead.managerId;delete lead.idempotencyKey;return lead;});
  const tasks=(await db.query(`select * from crm_tasks ${scoped?'where assigned_to=$1':''} order by due_at limit 1000`,scoped?[m.id]:[])).rows.map(camelRow);
  const events=(await db.query(`select id,session_id,user_id,event_type,entity_type,entity_id,metadata,occurred_at as created_at from user_events ${scoped?'where session_id in(select session_id from leads where manager_id=$1)':''} order by occurred_at desc limit 2000`,scoped?[m.id]:[])).rows.map(camelRow);
  const profiles=(await db.query(`select * from visitor_profiles ${scoped?'where session_id in(select session_id from leads where manager_id=$1)':''} order by score desc limit 1000`,scoped?[m.id]:[])).rows.map(camelRow);
  const members=(await db.query('select id,name,email,role,active,cities,telegram_user_id from team_members order by name')).rows.map(memberView);
  const notifications=scoped?[]:(await db.query('select id,topic,attempts,last_error,processed_at,dead_at,created_at from outbox_events order by created_at desc limit 30')).rows.map(camelRow);
  return {state,version,leads,tasks,events,profiles,members,notifications,limited:leads.length===1000||events.length===2000||profiles.length===1000||tasks.length===1000};
 });
 app.put('/api/v1/control/state',{preHandler:editor},async request=>{
  const {state,version}=z.object({state:stateSchema,version:z.number().int().positive()}).parse(request.body);
  return db.transaction(async sql=>{
   const changed={...state,updatedAt:new Date().toISOString()};
   const result=await sql.query('update app_config set document=$1::jsonb,version=version+1,updated_at=now() where singleton=true and version=$2 returning version',[JSON.stringify(changed),version]);
   if(!result.rows.length)throw new HttpError(409,'Настройки изменил другой сотрудник. Обновите данные и повторите правки');
   await audit(sql,request.member!.id,'config.update',null,{version:result.rows[0].version});return {state:changed,version:result.rows[0].version};
  });
 });
 app.patch('/api/v1/control/leads/:id',{preHandler:control},async request=>{
  const id=uuid((request.params as any).id);const patch=z.object({status:z.enum(['new','contacted','qualified','showing','booking','deal','closed','lost']).optional(),manager:z.uuid().nullable().optional(),comment:z.string().max(5000).nullable().optional(),nextAction:z.string().max(1000).nullable().optional(),expectedUpdatedAt:z.string().min(1)}).strict().parse(request.body);
  return db.transaction(async sql=>{
   const current=(await sql.query('select * from leads where id=$1 for update',[id])).rows[0];if(!current)throw new HttpError(404,'Заявка не найдена');
   const member=request.member!;if(member.role==='manager'&&(current.manager_id!==member.id||patch.manager!==undefined))throw new HttpError(403,'Недостаточно прав');
   if(new Date(current.updated_at).getTime()!==Date.parse(patch.expectedUpdatedAt))throw new HttpError(409,'Заявка изменена другим сотрудником. Обновите данные');
   if(patch.manager&&!(await sql.query('select id from team_members where id=$1 and active=true',[patch.manager])).rows.length)throw new HttpError(400,'Менеджер недоступен');
   for(const [key,value] of Object.entries(patch)){if(key==='expectedUpdatedAt')continue;const column={status:'status',manager:'manager_id',comment:'comment',nextAction:'next_action'}[key]!;await sql.query(`update leads set ${column}=$2 where id=$1`,[id,value]);}
   if(patch.manager!==undefined)await sql.query("update crm_tasks set assigned_to=$2 where lead_id=$1 and status<>'done'",[id,patch.manager]);
   if(patch.status&&['deal','closed','lost'].includes(patch.status))await sql.query("update crm_tasks set status='done' where lead_id=$1 and status<>'done'",[id]);
   await audit(sql,member.id,'lead.update',id,{fields:Object.keys(patch).filter(k=>k!=='expectedUpdatedAt')});return {ok:true};
  });
 });
 app.patch('/api/v1/control/tasks/:id',{preHandler:control},async request=>{
  const id=uuid((request.params as any).id);const patch=z.object({status:z.enum(['today','in_progress','waiting','done']).optional(),title:z.string().min(1).max(200).optional(),reason:z.string().max(2000).optional(),dueAt:z.iso.datetime().optional(),expectedUpdatedAt:z.string().min(1)}).strict().parse(request.body);
  return db.transaction(async sql=>{
   const current=(await sql.query('select * from crm_tasks where id=$1 for update',[id])).rows[0];if(!current)throw new HttpError(404,'Задача не найдена');
   if(request.member!.role==='manager'&&current.assigned_to!==request.member!.id)throw new HttpError(403,'Недостаточно прав');
   if(new Date(current.updated_at).getTime()!==Date.parse(patch.expectedUpdatedAt))throw new HttpError(409,'Задача уже изменилась');
   for(const [key,value] of Object.entries(patch)){if(key==='expectedUpdatedAt')continue;const column={status:'status',title:'title',reason:'reason',dueAt:'due_at'}[key]!;await sql.query(`update crm_tasks set ${column}=$2 where id=$1`,[id,value]);}
   await audit(sql,request.member!.id,'task.update',id,{fields:Object.keys(patch)});return {ok:true};
  });
 });
 app.post('/api/v1/control/members',{preHandler:owner},async request=>{
  const input=z.object({name:z.string().trim().min(2).max(100),email:z.email().max(254),password:z.string().min(14).max(200),role:z.enum(['admin','manager']),cities:z.array(z.string().max(100)).max(30),telegramUserId:z.string().regex(/^\d{1,16}$/).nullable()}).strict().parse(request.body);
  return db.transaction(async sql=>{if((await sql.query('select id from team_members where lower(email)=$1',[input.email.toLowerCase()])).rows.length)throw new HttpError(409,'Этот email уже зарегистрирован');const row=(await sql.query('insert into team_members(name,email,password_hash,role,cities,telegram_user_id) values($1,$2,$3,$4,$5,$6) returning id',[input.name,input.email.toLowerCase(),await hashPassword(input.password),input.role,input.cities,input.telegramUserId])).rows[0];await audit(sql,request.member!.id,'member.create',row.id);return {id:row.id};});
 });
 app.patch('/api/v1/control/members/:id',{preHandler:owner},async request=>{
  const id=uuid((request.params as any).id);const patch=z.object({active:z.boolean().optional(),cities:z.array(z.string().max(100)).max(30).optional(),telegramUserId:z.string().regex(/^\d{1,16}$/).nullable().optional()}).strict().parse(request.body);
  if(id===request.member!.id&&patch.active===false)throw new HttpError(400,'Нельзя отключить собственный аккаунт');
  return db.transaction(async sql=>{const member=(await sql.query('select * from team_members where id=$1 for update',[id])).rows[0];if(!member)throw new HttpError(404,'Сотрудник не найден');for(const [key,value] of Object.entries(patch)){const column={active:'active',cities:'cities',telegramUserId:'telegram_user_id'}[key]!;await sql.query(`update team_members set ${column}=$2 where id=$1`,[id,value]);}if(patch.active===false)await sql.query('delete from auth_tokens where member_id=$1',[id]);await audit(sql,request.member!.id,'member.update',id);return {ok:true};});
 });
 app.get('/api/v1/control/audit',{preHandler:editor},async()=>({items:(await db.query('select a.id,a.action,a.entity_id,a.details,a.created_at,m.name from audit_log a left join team_members m on m.id=a.member_id order by a.id desc limit 100')).rows.map(camelRow)}));
 return app;
}
