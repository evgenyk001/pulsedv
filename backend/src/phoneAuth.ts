import {zvonokCallSender,type PhoneCallSender} from './phoneCall';
import {pwaStartRoute} from '../../packages/browser/pwaLinks';
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
export function registerPhoneAuth(app:FastifyInstance,db:Database,config:RuntimeConfig,visitor:(r:FastifyRequest)=>Promise<void>,send:SmsSender=smsSender(config),call:PhoneCallSender=zvonokCallSender(config)){
 const smsEnabled=()=>!config.PWA_CALL_LOGIN&&!!config.PWA_SMS_LOGIN&&!!config.SMS_RU_API_ID&&config.PHONE_OTP_SECRET.length>=32;
 app.get('/api/v1/public/pwa-manifest',async(r,reply)=>{
  const {route}=z.object({route:z.string().max(512).default('/')}).strict().parse(r.query),path=pwaStartRoute(route);
  reply.header('Cache-Control','no-store').type('application/manifest+json');
  return {id:'/app/',name:'PULSEDV.RU',short_name:'PULSEDV.RU',lang:'ru',start_url:'/app/'+(path==='/'?'':'#'+path),scope:'/app/',display:'standalone',background_color:'#ffffff',theme_color:'#f3f5f8',icons:[{src:'/app/pulse-app-192-v3.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'/app/pulse-app-512-v3.png',sizes:'512x512',type:'image/png',purpose:'any'},{src:'/app/pulse-app-maskable-512-v3.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]};
 });
 const callEnabled=()=>!!config.PWA_CALL_LOGIN&&!!config.ZVONOK_PUBLIC_KEY&&!!config.ZVONOK_CAMPAIGN_ID&&config.PHONE_OTP_SECRET.length>=32;
 app.get('/api/v1/public/pwa',async()=>({phoneLogin:callEnabled()||smsEnabled(),phoneChannel:callEnabled()||!config.PWA_SMS_LOGIN?'call':'sms',push:!!config.WEB_PUSH_PUBLIC_KEY&&!!config.WEB_PUSH_PRIVATE_KEY,pushPublicKey:config.WEB_PUSH_PUBLIC_KEY}));
 for(const channel of ['sms','call'] as const){
 const enabled=channel==='call'?callEnabled:smsEnabled,digits=channel==='call'?4:6,ttl=channel==='call'?180:300,cooldown=channel==='call'?90:60;
 app.post('/api/v1/me/account/'+channel+'/request',{preHandler:visitor,config:{rateLimit:{max:6,timeWindow:'1 hour'}}},async r=>{
  if(!enabled())throw new HttpError(503,channel==='call'?'Вход по звонку пока недоступен':'Вход по SMS пока недоступен');
  const input=z.object({phone:z.string().min(7).max(30),consent:z.literal(true),consentVersion:z.string()}).strict().parse(r.body);
  if(input.consentVersion!==config.CONSENT_VERSION)throw new HttpError(409,'Условия обновились. Перезагрузите приложение');
  const phone=normalizePhone(input.phone),id=randomUUID(),code=generateMfaCode();
  await db.transaction(async sql=>{
   await sql.query('select pg_advisory_xact_lock(739137)');
   await lockPhone(sql,phone);
   const quota=(await sql.query(`select count(*) filter(where phone=$1 and created_at>now()-interval '1 hour')::int as hourly,count(*) filter(where phone=$1)::int as daily,count(*) filter(where phone=$1 and created_at>now()-($2::text||' seconds')::interval)::int as recent,count(*)::int as total from phone_login_challenges where created_at>now()-interval '24 hours'`,[phone,cooldown])).rows[0];
   if(quota.recent||quota.hourly>=3||quota.daily>=6||quota.total>=(channel==='call'?config.CALL_DAILY_LIMIT:config.SMS_DAILY_LIMIT))throw new HttpError(429,'Лимит запросов кода. Попробуйте позже.');
   await sql.query('update phone_login_challenges set consumed_at=now() where phone=$1 and consumed_at is null',[phone]);
   await sql.query("insert into phone_login_challenges(id,session_id,phone,code_hash,consent_version,expires_at) values($1,$2,$3,$4,$5,now()+($6::text||' seconds')::interval)",[id,r.visitor!.sessionId,phone,channel==='sms'?mfaCodeHash(config.PHONE_OTP_SECRET,id,code):'',config.CONSENT_VERSION,ttl]);
   await sql.query("update phone_login_challenges set channel=$2,delivery_state='pending' where id=$1",[id,channel]);
  });
  try{
   const proof=channel==='call'?(await call(phone)).code:(await send(phone,code),code);
   if(!new RegExp('^\\d{'+digits+'}$').test(proof))throw Error('Invalid phone proof');
   const ready=await db.query("update phone_login_challenges set delivery_state='ready',code_hash=$2 where id=$1 and consumed_at is null and expires_at>now() returning id",[id,mfaCodeHash(config.PHONE_OTP_SECRET,id,proof)]);
   if(!ready.rows.length)throw Error('Phone proof superseded');
  }catch{await db.query('update phone_login_challenges set consumed_at=now(),delivery_state=\'failed\' where id=$1',[id]);throw new HttpError(503,channel==='call'?'Не удалось запустить звонок. Попробуйте позже.':'Не удалось отправить SMS. Попробуйте позже.');}
  return {challengeId:id,retryAfter:cooldown,expiresIn:ttl,codeLength:digits,channel};
 });
 app.post('/api/v1/me/account/'+channel+'/verify',{preHandler:visitor,config:{rateLimit:{max:30,timeWindow:'10 minutes'}}},async(r,reply)=>{
  if(!enabled())throw new HttpError(503,channel==='call'?'Вход по звонку пока недоступен':'Вход по SMS пока недоступен');
  const input=z.object({challengeId:z.uuid(),code:z.string().regex(new RegExp('^\\d{'+digits+'}$'))}).strict().parse(r.body);
  const result=await db.transaction(async sql=>{
   const s=(await sql.query('select user_id from sessions where id=$1 for update',[r.visitor!.sessionId])).rows[0];
   const challenge=(await sql.query('select * from phone_login_challenges where id=$1 and session_id=$2 for update',[input.challengeId,r.visitor!.sessionId])).rows[0];
   if(!challenge||challenge.channel!==channel||challenge.delivery_state!=='ready'||challenge.consumed_at||Date.parse(challenge.expires_at)<=Date.now()||challenge.attempts>=(channel==='call'?3:5)||challenge.consent_version!==config.CONSENT_VERSION)return null;
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
   await sql.query("update sessions set user_id=$2,auth_provider=$3,phone_verified_at=now() where id=$1",[r.visitor!.sessionId,id,channel]);
   for(const table of ['user_events','visitor_profiles','leads'])await sql.query(`update ${table} set user_id=$2 where session_id=$1`,[r.visitor!.sessionId,id]);
   await sql.query('update phone_login_challenges set consumed_at=now() where id=$1',[challenge.id]);
   await sql.query("delete from auth_tokens where session_id=$1 and kind='visitor'",[r.visitor!.sessionId]);
   const auth=await issueToken(sql,'visitor',r.visitor!.sessionId);
   return {sessionId:r.visitor!.sessionId,accessToken:auth.token,expiresAt:auth.expiresAt};
  });
  if(!result)throw new HttpError(400,channel==='call'?'Цифры неверные или время истекло. Проверьте входящий номер или запросите новый звонок.':'Код неверный или истёк. Проверьте SMS или запросите новый код.');
  reply.setCookie('pulse_visitor',result.accessToken,{httpOnly:true,secure:config.NODE_ENV==='production',sameSite:'strict',path:'/api/v1',maxAge:30*86400});
  return result;
 });
 }
 app.post('/api/v1/me/account/logout',{preHandler:visitor},async(r,reply)=>{
  await db.query("delete from auth_tokens where session_id=$1 and kind='visitor'",[r.visitor!.sessionId]);
  await db.query('delete from pwa_passkey_grants where session_id=$1',[r.visitor!.sessionId]);
  reply.clearCookie('pulse_visitor',{path:'/api/v1'});return {ok:true};
 });
}
