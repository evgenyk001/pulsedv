import {randomBytes,randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Database,Sql} from './database';
import type {RuntimeConfig} from './config';
import {HttpError,tokenHash,generateMfaCode} from './security';
const proof=z.object({token:z.string().min(32).max(1024),deviceId:z.string().min(1).max(256)}).strict();
const secret=()=>randomBytes(32).toString('base64url');
const credential=async(sql:Sql,userId:string)=>(await sql.query('select * from partner_biometric_credentials where user_id=$1',[userId])).rows[0];
async function userLock(sql:Sql,id:string){await sql.query('select id from app_users where id=$1 for update',[id]);}
export async function requirePartnerBiometric(db:Sql,r:FastifyRequest,fresh=false){
 const id=r.visitor?.userId;if(!id)return;
 const c=await credential(db,id);if(!c?.active)return;
 const token=r.headers['x-partner-unlock'];
 if(typeof token!=='string'||token.length>1024)throw new HttpError(423,'Подтвердите вход в партнёрский кабинет');
 const grant=(await db.query("select token_hash from partner_biometric_grants where token_hash=$1 and user_id=$2 and session_id=$3 and revision=$4 and expires_at>now()"+(fresh?" and created_at>now()-interval '1 minute'":""),[tokenHash(token),id,r.visitor!.sessionId,c.revision])).rows[0];
 if(!grant)throw new HttpError(423,fresh?'Подтвердите изменение данных ещё раз':'Подтвердите вход в партнёрский кабинет');
}
async function issueGrant(sql:Sql,r:FastifyRequest,revision:string){
 const token=secret();await sql.query('delete from partner_biometric_grants where user_id=$1 and (expires_at<=now() or session_id=$2)',[r.visitor!.userId,r.visitor!.sessionId]);
 await sql.query("insert into partner_biometric_grants(token_hash,user_id,session_id,revision,expires_at) values($1,$2,$3,$4,now()+interval '10 minutes')",[tokenHash(token),r.visitor!.userId,r.visitor!.sessionId,revision]);return {grant:token};
}
export function registerPartnerBiometricRoutes(app:FastifyInstance,db:Database,config:RuntimeConfig,visitor:(r:FastifyRequest)=>Promise<void>){
 const authenticated=async(r:FastifyRequest)=>{await visitor(r);if(!r.visitor?.userId)throw new HttpError(403,'Откройте приложение в Telegram');};
 const options={preHandler:authenticated,config:{rateLimit:{max:10,timeWindow:'1 minute'}}};
 app.get('/api/v1/me/partner-security',{preHandler:visitor},async r=>{const c=r.visitor?.userId?await credential(db,r.visitor.userId):null;return {authenticated:!!r.visitor?.userId,enabled:!!c?.active};});
 app.post('/api/v1/me/partner-security/prepare',options,async r=>{
  const {deviceId}=z.object({deviceId:z.string().min(1).max(256)}).strict().parse(r.body);
  return db.transaction(async sql=>{await userLock(sql,r.visitor!.userId!);const c=await credential(sql,r.visitor!.userId!);if(c?.active)throw new HttpError(409,'Защита уже включена. Сначала отключите её или восстановите доступ');const token=secret();
   await sql.query('insert into partner_biometric_credentials(user_id,device_hash,token_hash) values($1,$2,$3) on conflict(user_id) do update set device_hash=excluded.device_hash,token_hash=excluded.token_hash,revision=gen_random_uuid(),created_at=now()',[r.visitor!.userId,tokenHash(deviceId),tokenHash(token)]);return {token};});
 });
 for(const action of ['activate','unlock'] as const)app.post('/api/v1/me/partner-security/'+action,options,async r=>{
  const input=proof.parse(r.body);return db.transaction(async sql=>{await userLock(sql,r.visitor!.userId!);const c=await credential(sql,r.visitor!.userId!);
   if(!c||c.token_hash!==tokenHash(input.token)||c.device_hash!==tokenHash(input.deviceId)||(action==='activate'&&Date.now()-new Date(c.created_at).getTime()>300000)||(action==='unlock'&&!c.active))throw new HttpError(403,'Не удалось подтвердить устройство. Восстановите доступ через Telegram');
   if(action==='activate'){await sql.query('update partner_biometric_credentials set active=true where user_id=$1',[r.visitor!.userId]);await sql.query('delete from partner_biometric_recovery where user_id=$1',[r.visitor!.userId]);}return issueGrant(sql,r,c.revision);});
 });
 app.post('/api/v1/me/partner-security/lock',options,async r=>{await db.query('delete from partner_biometric_grants where user_id=$1 and session_id=$2',[r.visitor!.userId,r.visitor!.sessionId]);return {ok:true};});
 app.post('/api/v1/me/partner-security/disable',options,async r=>db.transaction(async sql=>{await userLock(sql,r.visitor!.userId!);await requirePartnerBiometric(sql,r,true);await sql.query('delete from partner_biometric_credentials where user_id=$1',[r.visitor!.userId]);await sql.query('delete from partner_biometric_grants where user_id=$1',[r.visitor!.userId]);return {ok:true};}));
 app.post('/api/v1/me/partner-security/recovery',options,async r=>{
  if(!config.BOT_TOKEN)throw new HttpError(503,'Восстановление станет доступно после подключения Telegram-бота');
  return db.transaction(async sql=>{const id=r.visitor!.userId!;await userLock(sql,id);if(!(await credential(sql,id))?.active)throw new HttpError(409,'Защита уже отключена');
   const old=(await sql.query('select created_at from partner_biometric_recovery where user_id=$1',[id])).rows[0];if(old&&Date.now()-new Date(old.created_at).getTime()<60000)throw new HttpError(429,'Повторный код можно запросить через минуту');
   const code=generateMfaCode(),challenge=randomUUID();await sql.query("insert into partner_biometric_recovery(user_id,id,session_id,code_hash,expires_at) values($1,$2,$3,$4,now()+interval '5 minutes') on conflict(user_id) do update set id=excluded.id,session_id=excluded.session_id,code_hash=excluded.code_hash,expires_at=excluded.expires_at,created_at=now(),attempts=0",[id,challenge,r.visitor!.sessionId,tokenHash(challenge+':'+code)]);
   await sql.query("insert into outbox_events(topic,aggregate_type,aggregate_id,payload) values('user.partner_security_code','partner_security',$1,$2::jsonb)",[challenge,JSON.stringify({userId:id,challengeId:challenge,title:'PULSEDV.RU · восстановление доступа',body:'Код: '+code+'\nОн отключит защиту партнёрского кабинета по Face ID или отпечатку. Никому не сообщайте код. Действует 5 минут.'})]);return {queued:true};});
 });
 app.post('/api/v1/me/partner-security/recover',options,async r=>{
  const {code}=z.object({code:z.string().regex(/^\d{6}$/)}).strict().parse(r.body);
  const result=await db.transaction(async sql=>{const id=r.visitor!.userId!;await userLock(sql,id);const c=(await sql.query('select * from partner_biometric_recovery where user_id=$1 and session_id=$2 and expires_at>now() and attempts<5 for update',[id,r.visitor!.sessionId])).rows[0];if(!c)return false;
   await sql.query('update partner_biometric_recovery set attempts=attempts+1 where user_id=$1',[id]);if(c.code_hash!==tokenHash(c.id+':'+code))return false;
   await sql.query('delete from partner_biometric_credentials where user_id=$1',[id]);await sql.query('delete from partner_biometric_grants where user_id=$1',[id]);await sql.query('delete from partner_biometric_recovery where user_id=$1',[id]);return true;});
  if(!result)throw new HttpError(400,'Код неверный или истёк. Запросите новый код');return {ok:true};
 });
}
