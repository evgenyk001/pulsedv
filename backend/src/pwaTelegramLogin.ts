import {createHash,randomBytes} from 'node:crypto';
import {createRemoteJWKSet,jwtVerify} from 'jose';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import {z} from 'zod';
import type {Database,Sql} from './database';
import type {RuntimeConfig} from './config';
import {HttpError,issueToken,tokenHash} from './security';

const issuer='https://oauth.telegram.org';
const keys=createRemoteJWKSet(new URL(issuer+'/.well-known/jwks.json'));
const paths=['/app/','/landing-cinematic/pwa-preview/'] as const;
export type TelegramIdentity={id:number;first_name:string;last_name?:string;username?:string};
export function telegramWebEnabled(config:RuntimeConfig){
 return !!config.PWA_TELEGRAM_CLIENT_SECRET&&/^\d+$/.test(config.PWA_TELEGRAM_CLIENT_ID)&&config.BOT_TOKEN.split(':')[0]===config.PWA_TELEGRAM_CLIENT_ID;
}

export async function exchangeTelegramCode(config:RuntimeConfig,code:string,verifier:string,redirect_uri:string):Promise<TelegramIdentity>{
 const credentials=Buffer.from(config.PWA_TELEGRAM_CLIENT_ID+':'+config.PWA_TELEGRAM_CLIENT_SECRET).toString('base64');
 const response=await fetch(issuer+'/token',{
  method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),
  headers:{Authorization:'Basic '+credentials},
  body:new URLSearchParams({grant_type:'authorization_code',code,code_verifier:verifier,redirect_uri})
 });
 if(!response.ok)throw new Error('Telegram rejected the code');
 const {id_token}=z.object({id_token:z.string().max(16000)}).parse(await response.json());
 const {payload}=await jwtVerify(id_token,keys,{
  issuer,audience:config.PWA_TELEGRAM_CLIENT_ID,algorithms:['RS256'],
  requiredClaims:['sub','iat','exp'],maxTokenAge:'10m',clockTolerance:30
 });
 // Telegram's OIDC subject and numeric Telegram user ID are distinct claims.
 const profile=z.object({id:z.number().int().positive(),given_name:z.string().optional(),family_name:z.string().optional(),preferred_username:z.string().optional(),name:z.string().optional()}).parse(payload);
 return {id:profile.id,first_name:(profile.given_name||profile.name||'Клиент').slice(0,100),last_name:profile.family_name?.slice(0,100),username:profile.preferred_username?.slice(0,64)};
}

export function registerPwaTelegramLogin(app:FastifyInstance,db:Database,config:RuntimeConfig,visitor:(r:FastifyRequest)=>Promise<void>,bind:(sql:Sql,sessionId:string,user:TelegramIdentity)=>Promise<string>,exchange=exchangeTelegramCode){
 const check=()=>{if(!telegramWebEnabled(config))throw new HttpError(503,'Вход через Telegram пока недоступен')};
 app.post('/api/v1/auth/pwa-telegram/start',{preHandler:visitor,config:{rateLimit:{max:10,timeWindow:'1 minute'}}},async r=>{
  check();
  const {base}=z.object({base:z.enum(paths)}).strict().parse(r.body);
  const state=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url');
  const redirect=config.PUBLIC_ORIGIN+base;
  await db.query(`insert into pwa_telegram_login(session_id,state_hash,verifier,redirect_uri,expires_at)
   values($1,$2,$3,$4,now()+interval '10 minutes') on conflict(session_id) do update set state_hash=excluded.state_hash,
   verifier=excluded.verifier,redirect_uri=excluded.redirect_uri,expires_at=excluded.expires_at`,[r.visitor!.sessionId,tokenHash(state),verifier,redirect]);
  const url=new URL(issuer+'/auth');
  url.search=new URLSearchParams({client_id:config.PWA_TELEGRAM_CLIENT_ID,redirect_uri:redirect,response_type:'code',scope:'openid profile',state,
   code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();
  return {url:url.href};
 });
 app.post('/api/v1/auth/pwa-telegram/finish',{preHandler:visitor,config:{rateLimit:{max:10,timeWindow:'1 minute'}}},async(r,reply)=>{
  check();
  const {state,code}=z.object({state:z.string().regex(/^[\w-]{43}$/),code:z.string().min(1).max(4096)}).strict().parse(r.body);
  const sessionId=r.visitor!.sessionId;
  const pending=(await db.query('delete from pwa_telegram_login where session_id=$1 and state_hash=$2 and expires_at>now() returning verifier,redirect_uri',[sessionId,tokenHash(state)])).rows[0];
  if(!pending)throw new HttpError(400,'Срок входа истёк. Начните вход заново.');
  let user:TelegramIdentity;
  try{user=await exchange(config,code,pending.verifier,pending.redirect_uri)}
  catch{throw new HttpError(401,'Не удалось подтвердить вход через Telegram. Попробуйте ещё раз.')}
  const result=await db.transaction(async sql=>{
   await sql.query('select id from sessions where id=$1 for update',[sessionId]);
   const token=r.headers.authorization?.replace(/^Bearer /,'');
   const active=token&&(await sql.query("select 1 from auth_tokens where kind='visitor' and session_id=$1 and token_hash=$2 and expires_at>now()",[sessionId,tokenHash(token)])).rows.length;
   if(!active)throw new HttpError(401,'Сессия истекла. Начните вход заново.');
   const userId=await bind(sql,sessionId,user);
   await sql.query("update sessions set auth_provider='telegram-web' where id=$1",[sessionId]);
   await sql.query('update push_subscriptions set session_id=null,user_id=$2 where session_id=$1',[sessionId,userId]);
   await sql.query("delete from auth_tokens where session_id=$1 and kind='visitor'",[sessionId]);
   const auth=await issueToken(sql,'visitor',sessionId);
   return {sessionId,accessToken:auth.token,expiresAt:auth.expiresAt};
  });
  reply.setCookie('pulse_visitor',result.accessToken,{httpOnly:true,secure:config.NODE_ENV==='production',sameSite:'strict',path:'/api/v1',maxAge:30*86400});
  return result;
 });
}
