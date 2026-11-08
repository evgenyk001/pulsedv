import {randomUUID,randomBytes,randomInt} from 'node:crypto';
import {z} from 'zod';
import {generateRegistrationOptions,verifyRegistrationResponse,generateAuthenticationOptions,verifyAuthenticationResponse,type RegistrationResponseJSON,type AuthenticationResponseJSON} from '@simplewebauthn/server';
import type {Database,Sql} from './database';
import type {RuntimeConfig} from './config';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import {HttpError,tokenHash,issueToken} from './security';
import {registeredPhone} from './accountRoutes';
import {mergeFavorites} from './favoriteRoutes';
import {mergeSearch} from './searchRoutes';
import {mergeNotificationReads} from './clientNotificationRoutes';
export async function pwaGrantValid(sql:Sql,r:FastifyRequest,fresh=false){
 const token=r.headers['x-partner-unlock'];if(typeof token!=='string'||token.length>1024)return false;
 return !!(await sql.query(`select g.token_hash from pwa_passkey_grants g join pwa_passkey_users u on u.user_id=g.user_id and u.revision=g.revision where g.token_hash=$1 and g.user_id=$2 and g.session_id=$3 and g.expires_at>now() ${fresh?"and g.created_at>now()-interval '1 minute'":''} and exists(select 1 from pwa_passkeys k where k.user_id=g.user_id)`,[tokenHash(token),r.visitor!.userId,r.visitor!.sessionId])).rows.length;
}
export async function requirePwaPartner(sql:Sql,r:FastifyRequest,fresh=false){
 const provider=(await sql.query('select auth_provider from sessions where id=$1',[r.visitor!.sessionId])).rows[0]?.auth_provider;
 if(provider!=='sms'&&provider!=='call'&&provider!=='passkey')return false;
 if(!await pwaGrantValid(sql,r,fresh))throw new HttpError(423,fresh?'Подтвердите действие ключом доступа':'Откройте партнёрский кабинет ключом доступа');
 return true;
}
async function grant(sql:Sql,r:FastifyRequest,userId:string){
 const token=randomBytes(32).toString('base64url');
 await sql.query('delete from pwa_passkey_grants where user_id=$1 and (session_id=$2 or expires_at<=now())',[userId,r.visitor!.sessionId]);
 await sql.query('insert into pwa_passkey_grants(token_hash,user_id,session_id,revision) select $1,user_id,$3,revision from pwa_passkey_users where user_id=$2',[tokenHash(token),userId,r.visitor!.sessionId]);return token;
}
const body=z.object({challengeId:z.uuid(),response:z.record(z.string(),z.unknown())}).strict();
export function registerPwaPasskeys(app:FastifyInstance,db:Database,config:RuntimeConfig,visitor:(r:FastifyRequest)=>Promise<void>){
 const rpID=new URL(config.PUBLIC_ORIGIN).hostname;
 const account=async(r:FastifyRequest)=>{await visitor(r);if(!await registeredPhone(db,r.visitor!.userId,config.CONSENT_VERSION))throw new HttpError(403,'Подтвердите номер телефона');};
 const opts={preHandler:account,config:{rateLimit:{max:15,timeWindow:'1 minute'}}};
 async function challenge(sql:Sql,r:FastifyRequest,kind:string,value:string,userId:string|null){
  await sql.query('update pwa_passkey_challenges set used_at=now() where session_id=$1 and kind=$2 and used_at is null',[r.visitor!.sessionId,kind]);
  const id=randomUUID();await sql.query("insert into pwa_passkey_challenges(id,session_id,user_id,kind,challenge,guard_revision,legacy_revision) values($1,$2,$3,$4,$5,(select revision from pwa_passkey_users where user_id=$3),(select revision from partner_biometric_credentials where user_id=$3 and active))",[id,r.visitor!.sessionId,userId,kind,value]);return id;
 }
 app.get('/api/v1/me/account/passkeys',opts,async r=>{
  const id=r.visitor!.userId!;
  const keys=(await db.query('select id,name,created_at,last_used_at from pwa_passkeys where user_id=$1 order by created_at',[id])).rows;
  const legacy=!!(await db.query('select user_id from partner_biometric_credentials where user_id=$1 and active',[id])).rows.length;
  return {authenticated:true,enabled:keys.length>0,legacyApprovalRequired:legacy&&!keys.length,keys:keys.map(k=>({id:k.id,name:k.name,createdAt:k.created_at,lastUsedAt:k.last_used_at}))};
 });
 app.post('/api/v1/me/account/passkeys/register/options',opts,async r=>{
  const input=z.object({approvalCode:z.string().regex(/^\d{8}$/).optional()}).strict().parse(r.body);
  const result=await db.transaction(async sql=>{
   const session=(await sql.query('select * from sessions where id=$1 for update',[r.visitor!.sessionId])).rows[0],id=r.visitor!.userId!;
   await sql.query('select id from app_users where id=$1 for update',[id]);
   const keys=(await sql.query('select id,transports from pwa_passkeys where user_id=$1',[id])).rows;
   if(keys.length>=5)throw new HttpError(409,'Можно подключить до пяти ключей');
   if(keys.length){if(!await pwaGrantValid(sql,r,true))throw new HttpError(423,'Сначала подтвердите действующий ключ доступа');}
   else{
    if(!['sms','call'].includes(session.auth_provider)||!session.phone_verified_at||Date.parse(session.phone_verified_at)<Date.now()-300000)throw new HttpError(428,'Для подключения ключа заново подтвердите номер телефона');
    const legacy=(await sql.query('select revision from partner_biometric_credentials where user_id=$1 and active',[id])).rows[0];
    if(legacy){
     const a=(await sql.query('select * from pwa_legacy_approvals where user_id=$1 and expires_at>now() and revision=$2 for update',[id,legacy.revision])).rows[0];
     if(!a||a.attempts>=5)return null;
     if(a.approved_session_id!==r.visitor!.sessionId){
      await sql.query('update pwa_legacy_approvals set attempts=attempts+1 where user_id=$1',[id]);
      if(!input.approvalCode||a.code_hash!==tokenHash(a.id+':'+input.approvalCode))return null;
      await sql.query("update pwa_legacy_approvals set approved_session_id=$2,code_hash='' where user_id=$1",[id,r.visitor!.sessionId]);
     }
    }
   }
   await sql.query('insert into pwa_passkey_users(user_id,handle) values($1,$2) on conflict(user_id) do nothing',[id,randomBytes(32).toString('base64url')]);
   const u=(await sql.query('select handle from pwa_passkey_users where user_id=$1',[id])).rows[0];
   const options=await generateRegistrationOptions({rpName:'PULSEDV.RU',rpID,userID:new Uint8Array(Buffer.from(u.handle,'base64url')),userName:'PULSEDV.RU · '+id.slice(0,8),attestationType:'none',supportedAlgorithmIDs:[-7,-257],authenticatorSelection:{residentKey:'required',userVerification:'required'},excludeCredentials:keys.map(k=>({id:k.id,transports:k.transports}))});
   return {options,challengeId:await challenge(sql,r,'registration',options.challenge,id)};
  });
  if(!result)throw new HttpError(403,'Введите действующий код подключения из защищённого кабинета Telegram');return result;
 });
 app.post('/api/v1/me/account/passkeys/register/verify',opts,async r=>{
  const input=body.parse(r.body);const result=await db.transaction(async sql=>{
   await sql.query('select id from sessions where id=$1 for update',[r.visitor!.sessionId]);
   const id=r.visitor!.userId!;await sql.query('select id from app_users where id=$1 for update',[id]);
   const c=(await sql.query("select * from pwa_passkey_challenges where id=$1 and session_id=$2 and user_id=$3 and kind='registration' and used_at is null and expires_at>now() for update",[input.challengeId,r.visitor!.sessionId,id])).rows[0];if(!c)return null;
   await sql.query('update pwa_passkey_challenges set used_at=now() where id=$1',[c.id]);
   const current=(await sql.query('select revision from pwa_passkey_users where user_id=$1',[id])).rows[0];
   const legacy=(await sql.query('select revision from partner_biometric_credentials where user_id=$1 and active',[id])).rows[0];
   if(current?.revision!==c.guard_revision||(legacy?.revision??null)!==c.legacy_revision)return null;
   if(legacy&&!(await sql.query('select user_id from pwa_legacy_approvals where user_id=$1 and approved_session_id=$2 and revision=$3 and expires_at>now()',[id,r.visitor!.sessionId,legacy.revision])).rows.length&&!(await pwaGrantValid(sql,r,true)))return null;
   let v;try{v=await verifyRegistrationResponse({response:input.response as unknown as RegistrationResponseJSON,expectedChallenge:c.challenge,expectedOrigin:config.PUBLIC_ORIGIN,expectedRPID:rpID,requireUserVerification:true})}catch{return null}
   if(!v.verified)return null;const key=v.registrationInfo.credential;
   if((await sql.query('select id from pwa_passkeys where id=$1',[key.id])).rows.length)return null;
   await sql.query('insert into pwa_passkeys(id,user_id,public_key,counter,transports) values($1,$2,$3,$4,$5::jsonb)',[key.id,id,Buffer.from(key.publicKey).toString('base64url'),key.counter,JSON.stringify(key.transports??[])]);
   await sql.query('update pwa_passkey_users set revision=gen_random_uuid() where user_id=$1',[id]);await sql.query('delete from pwa_passkey_grants where user_id=$1',[id]);
   return {grant:await grant(sql,r,id)};
  });if(!result)throw new HttpError(400,'Не удалось подтвердить ключ. Начните подключение заново');return result;
 });
 for(const kind of ['unlock','login'] as const){
  const pre=kind==='login'?visitor:account;
  app.post('/api/v1/me/account/passkeys/'+kind+'/options',{preHandler:pre,config:{rateLimit:{max:15,timeWindow:'1 minute'}}},async r=>db.transaction(async sql=>{
   const keys=kind==='unlock'?(await sql.query('select id,transports from pwa_passkeys where user_id=$1',[r.visitor!.userId])).rows:[];
   if(kind==='unlock'&&!keys.length)throw new HttpError(409,'Сначала подключите ключ доступа');
   const options=await generateAuthenticationOptions({rpID,userVerification:'required',...(kind==='unlock'?{allowCredentials:keys.map(k=>({id:k.id,transports:k.transports}))}:{})});
   return {options,challengeId:await challenge(sql,r,kind,options.challenge,kind==='unlock'?r.visitor!.userId:null)};
  }));
  app.post('/api/v1/me/account/passkeys/'+kind+'/verify',{preHandler:pre,config:{rateLimit:{max:20,timeWindow:'1 minute'}}},async(r,reply)=>{
   const input=body.parse(r.body);const result=await db.transaction(async sql=>{
    const session=(await sql.query('select user_id from sessions where id=$1 for update',[r.visitor!.sessionId])).rows[0];
    const c=(await sql.query('select * from pwa_passkey_challenges where id=$1 and session_id=$2 and kind=$3 and used_at is null and expires_at>now() for update',[input.challengeId,r.visitor!.sessionId,kind])).rows[0];if(!c)return null;
    await sql.query('update pwa_passkey_challenges set used_at=now() where id=$1',[c.id]);
    const response=input.response as unknown as AuthenticationResponseJSON;
    if(typeof response.id!=='string'||response.id.length>1500)return null;
    const key=(await sql.query('select k.*,u.handle from pwa_passkeys k join pwa_passkey_users u on u.user_id=k.user_id where k.id=$1 for update of k',[response.id])).rows[0];
    if(!key||(kind==='unlock'&&(key.user_id!==r.visitor!.userId||c.user_id!==key.user_id))||(session.user_id&&session.user_id!==key.user_id))return null;
    if(response.response?.userHandle&&response.response.userHandle!==key.handle)return null;
    if(!await registeredPhone(sql,key.user_id,config.CONSENT_VERSION))return null;
    let v;try{v=await verifyAuthenticationResponse({response,expectedChallenge:c.challenge,expectedOrigin:config.PUBLIC_ORIGIN,expectedRPID:rpID,requireUserVerification:true,credential:{id:key.id,publicKey:new Uint8Array(Buffer.from(key.public_key,'base64url')),counter:Number(key.counter),transports:key.transports}})}catch{return null}
    if(!v.verified)return null;
    await sql.query('update pwa_passkeys set counter=$2,last_used_at=now() where id=$1',[key.id,v.authenticationInfo.newCounter]);
    if(kind==='unlock')return {grant:await grant(sql,r,key.user_id)};
    await mergeFavorites(sql,r.visitor!.sessionId,key.user_id);await mergeSearch(sql,r.visitor!.sessionId,key.user_id);await mergeNotificationReads(sql,r.visitor!.sessionId,key.user_id);
    await sql.query("update sessions set user_id=$2,auth_provider='passkey' where id=$1",[r.visitor!.sessionId,key.user_id]);
    for(const table of ['user_events','visitor_profiles','leads'])await sql.query(`update ${table} set user_id=$2 where session_id=$1`,[r.visitor!.sessionId,key.user_id]);
    await sql.query("delete from auth_tokens where session_id=$1 and kind='visitor'",[r.visitor!.sessionId]);const token=await issueToken(sql,'visitor',r.visitor!.sessionId);
    return {grant:await grant(sql,r,key.user_id),sessionId:r.visitor!.sessionId,accessToken:token.token,expiresAt:token.expiresAt};
   });
   if(!result)throw new HttpError(400,'Ключ не подтверждён. Повторите вход или используйте SMS');
   if('accessToken' in result)reply.setCookie('pulse_visitor',result.accessToken!,{httpOnly:true,secure:config.NODE_ENV==='production',sameSite:'strict',path:'/api/v1',maxAge:30*86400});return result;
  });
 }
 app.post('/api/v1/me/account/passkeys/lock',opts,async r=>{await db.query('delete from pwa_passkey_grants where user_id=$1 and session_id=$2',[r.visitor!.userId,r.visitor!.sessionId]);return {ok:true};});
 app.post('/api/v1/me/account/passkeys/remove',opts,async r=>{
  const {id}=z.object({id:z.string().min(1).max(1500)}).strict().parse(r.body);
  return db.transaction(async sql=>{await sql.query('select id from app_users where id=$1 for update',[r.visitor!.userId]);if(!await pwaGrantValid(sql,r,true))throw new HttpError(423,'Подтвердите удаление ключом доступа');await sql.query('delete from pwa_passkeys where id=$1 and user_id=$2',[id,r.visitor!.userId]);await sql.query('update pwa_passkey_users set revision=gen_random_uuid() where user_id=$1',[r.visitor!.userId]);await sql.query('delete from pwa_passkey_grants where user_id=$1',[r.visitor!.userId]);return {ok:true};});
 });
 // A protected Telegram account must approve its first PWA key; SMS alone cannot silently bypass it.
 app.post('/api/v1/me/partner-security/pwa-approval',opts,async r=>{
  const session=(await db.query('select auth_provider from sessions where id=$1',[r.visitor!.sessionId])).rows[0];
  if(session?.auth_provider!=='telegram')throw new HttpError(403,'Подтвердите действие в Telegram');
  const token=r.headers['x-partner-unlock'];
  return db.transaction(async sql=>{
   await sql.query('select id from app_users where id=$1 for update',[r.visitor!.userId]);
   const valid=typeof token==='string'?(await sql.query("select c.revision from partner_biometric_credentials c join partner_biometric_grants g on g.user_id=c.user_id and g.revision=c.revision where c.user_id=$1 and c.active and g.token_hash=$2 and g.session_id=$3 and g.expires_at>now() and g.created_at>now()-interval '1 minute'",[r.visitor!.userId,tokenHash(token),r.visitor!.sessionId])).rows[0]:null;
   if(!valid)throw new HttpError(423,'Подтвердите действие биометрией Telegram');
   const recent=(await sql.query("select user_id from pwa_legacy_approvals where user_id=$1 and created_at>now()-interval '60 seconds'",[r.visitor!.userId])).rows[0];if(recent)throw new HttpError(429,'Повторите через минуту');
   const id=randomUUID(),code=String(randomInt(0,100000000)).padStart(8,'0');await sql.query("insert into pwa_legacy_approvals(user_id,id,code_hash,revision) values($1,$2,$3,$4) on conflict(user_id) do update set id=excluded.id,code_hash=excluded.code_hash,revision=excluded.revision,attempts=0,approved_session_id=null,created_at=now(),expires_at=now()+interval '5 minutes'",[r.visitor!.userId,id,tokenHash(id+':'+code),valid.revision]);return {code,expiresIn:300};
  });
 });
}
