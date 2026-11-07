import {randomUUID} from 'node:crypto';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import {z} from 'zod';
import type {Database} from './database';
import type {RuntimeConfig} from './config';
import {generateMfaCode,mfaCodeHash,checkMfaCode,HttpError,issueToken} from './security';
import {normalizePhone,lockPhone,phoneUser} from './phoneIdentity';
import {mergeFavorites} from './favoriteRoutes';
import {mergeSearch} from './searchRoutes';
import {mergeNotificationReads} from './clientNotificationRoutes';
export type SmsSender=(phone:string,code:string)=>Promise<void>;
export function smsSender(config:RuntimeConfig,send:typeof fetch=fetch):SmsSender{return async(phone,code)=>{
 const body=new URLSearchParams({api_id:config.SMS_RU_API_ID,to:phone.slice(1),msg:`PULSEDV.RU: код входа ${code}. Никому не сообщайте код.`,json:'1'});
 if(config.SMS_RU_FROM)body.set('from',config.SMS_RU_FROM);
 const response=await send('https://sms.ru/sms/send',{method:'POST',body,signal:AbortSignal.timeout(10000)});
 const result=await response.json() as any;
 if(!response.ok||result.status!=='OK'||result.sms?.[phone.slice(1)]?.status!=='OK')throw new Error('SMS delivery rejected');
 };}
export function registerPhoneAuth(app:FastifyInstance,db:Database,config:RuntimeConfig,visitor:(r:FastifyRequest)=>Promise<void>,send:SmsSender=smsSender(config)){
 const enabled=()=>!!config.PWA_SMS_LOGIN&&!!config.SMS_RU_API_ID&&config.PHONE_OTP_SECRET.length>=32;
 app.get('/api/v1/public/pwa',async()=>({phoneLogin:enabled(),push:!!config.WEB_PUSH_PUBLIC_KEY&&!!config.WEB_PUSH_PRIVATE_KEY,pushPublicKey:config.WEB_PUSH_PUBLIC_KEY}));
 app.post('/api/v1/me/account/sms/request',{preHandler:visitor,config:{rateLimit:{max:6,timeWindow:'1 hour'}}},async r=>{
  if(!enabled())throw new HttpError(503,'Вход по SMS ещё не подключён. Попробуйте позже.');
  const input=z.object({phone:z.string().min(7).max(30),consent:z.literal(true),consentVersion:z.string()}).strict().parse(r.body);
  if(input.consentVersion!==config.CONSENT_VERSION)throw new HttpError(409,'Условия обновились. Перезагрузите приложение');
  const phone=normalizePhone(input.phone),id=randomUUID(),code=generateMfaCode();
  await db.transaction(async sql=>{
   await sql.query('select pg_advisory_xact_lock(739137)');
   await lockPhone(sql,phone);
   const quota=(await sql.query(`select count(*) filter(where phone=$1 and created_at>now()-interval '1 hour')::int as hourly,count(*) filter(where phone=$1)::int as daily,count(*) filter(where phone=$1 and created_at>now()-interval '60 seconds')::int as recent,count(*)::int as total from phone_login_challenges where created_at>now()-interval '24 hours'`,[phone])).rows[0];
   if(quota.recent||quota.hourly>=3||quota.daily>=6||quota.total>=config.SMS_DAILY_LIMIT)throw new HttpError(429,'Лимит запросов кода. Попробуйте позже.');
   await sql.query('update phone_login_challenges set consumed_at=now() where phone=$1 and consumed_at is null',[phone]);
   await sql.query("insert into phone_login_challenges(id,session_id,phone,code_hash,consent_version,expires_at) values($1,$2,$3,$4,$5,now()+interval '5 minutes')",[id,r.visitor!.sessionId,phone,mfaCodeHash(config.PHONE_OTP_SECRET,id,code),config.CONSENT_VERSION]);
  });
  try{await send(phone,code)}catch{await db.query('update phone_login_challenges set consumed_at=now() where id=$1',[id]);throw new HttpError(503,'Не удалось отправить SMS. Попробуйте позже.');}
  return {challengeId:id,retryAfter:60,expiresIn:300};
 });
 app.post('/api/v1/me/account/sms/verify',{preHandler:visitor,config:{rateLimit:{max:30,timeWindow:'10 minutes'}}},async(r,reply)=>{
  if(!enabled())throw new HttpError(503,'Вход по SMS ещё не подключён');
  const input=z.object({challengeId:z.uuid(),code:z.string().regex(/^\d{6}$/)}).strict().parse(r.body);
  const result=await db.transaction(async sql=>{
   const s=(await sql.query('select user_id from sessions where id=$1 for update',[r.visitor!.sessionId])).rows[0];
   const challenge=(await sql.query('select * from phone_login_challenges where id=$1 and session_id=$2 for update',[input.challengeId,r.visitor!.sessionId])).rows[0];
   if(!challenge||challenge.consumed_at||Date.parse(challenge.expires_at)<=Date.now()||challenge.attempts>=5||challenge.consent_version!==config.CONSENT_VERSION)return null;
   await sql.query('update phone_login_challenges set attempts=attempts+1 where id=$1',[challenge.id]);
   if(!checkMfaCode(config.PHONE_OTP_SECRET,challenge.id,input.code,challenge.code_hash))return null;
   await lockPhone(sql,challenge.phone);
   let id=await phoneUser(sql,challenge.phone);
   if(s.user_id&&id!==s.user_id)throw new HttpError(409,'Сначала выйдите из текущего аккаунта');
   if(!id)id=(await sql.query("insert into app_users(phone,first_name) values($1,'Клиент') returning id",[challenge.phone])).rows[0].id;
   await sql.query('select id from app_users where id=$1 for update',[id]);
   await sql.query('insert into phone_identities(phone,user_id) values($1,$2) on conflict(phone) do update set verified_at=now()',[challenge.phone,id]);
   await sql.query('insert into phone_registrations(user_id,phone,consent_version) values($1,$2,$3) on conflict(user_id) do update set phone=excluded.phone,consent_version=excluded.consent_version,verified_at=now()',[id,challenge.phone,challenge.consent_version]);
   await mergeFavorites(sql,r.visitor!.sessionId,id!);await mergeSearch(sql,r.visitor!.sessionId,id!);await mergeNotificationReads(sql,r.visitor!.sessionId,id!);
   await sql.query('update sessions set user_id=$2 where id=$1',[r.visitor!.sessionId,id]);
   for(const table of ['user_events','visitor_profiles','leads'])await sql.query(`update ${table} set user_id=$2 where session_id=$1`,[r.visitor!.sessionId,id]);
   await sql.query('update phone_login_challenges set consumed_at=now() where id=$1',[challenge.id]);
   await sql.query("delete from auth_tokens where session_id=$1 and kind='visitor'",[r.visitor!.sessionId]);
   const auth=await issueToken(sql,'visitor',r.visitor!.sessionId);
   return {sessionId:r.visitor!.sessionId,accessToken:auth.token,expiresAt:auth.expiresAt};
  });
  if(!result)throw new HttpError(400,'Код неверный или истёк. Проверьте SMS или запросите новый код.');
  reply.setCookie('pulse_visitor',result.accessToken,{httpOnly:true,secure:config.NODE_ENV==='production',sameSite:'strict',path:'/api/v1',maxAge:30*86400});
  return result;
 });
 app.post('/api/v1/me/account/logout',{preHandler:visitor},async(r,reply)=>{
  await db.query("delete from auth_tokens where session_id=$1 and kind='visitor'",[r.visitor!.sessionId]);
  reply.clearCookie('pulse_visitor',{path:'/api/v1'});return {ok:true};
 });
}
