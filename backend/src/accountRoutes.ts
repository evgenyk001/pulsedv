import type {FastifyInstance,FastifyRequest} from 'fastify';
import {z} from 'zod';
import type {Database,Sql} from './database';
import type {RuntimeConfig} from './config';
import {HttpError} from './security';
export async function registeredPhone(db:Sql,userId:string|null,consentVersion?:string){
 if(!userId)return false;
 return !!(await db.query(`select u.id from app_users u where u.id=$1 and u.phone is not null and (exists(select 1 from telegram_contact_consent c where c.user_id=u.id and c.accepted_at is not null and ($2::text is null or c.consent_version=$2)) or exists(select 1 from phone_registrations p where p.user_id=u.id and p.phone=u.phone and ($2::text is null or p.consent_version=$2)))`,[userId,consentVersion??null])).rows.length;
}
export function registerAccountRoutes(app:FastifyInstance,db:Database,config:RuntimeConfig,visitor:(r:FastifyRequest)=>Promise<void>,editor:(r:FastifyRequest)=>Promise<void>){
 app.get('/api/v1/me/account',{preHandler:visitor},async r=>{
  const user=r.visitor!.userId?(await db.query('select first_name,last_name,phone,telegram_user_id is not null as telegram_linked from app_users where id=$1',[r.visitor!.userId])).rows[0]:null;
  return {authenticated:!!r.visitor!.userId,registered:await registeredPhone(db,r.visitor!.userId,config.CONSENT_VERSION),requiresPhone:config.REQUIRE_TELEGRAM_PHONE,botUsername:config.TELEGRAM_BOT_USERNAME,consentVersion:config.CONSENT_VERSION,name:user?[user.first_name,user.last_name].filter(Boolean).join(' '):null,phone:user?.phone??null,telegramLinked:!!user?.telegram_linked};
 });
 app.post('/api/v1/me/account/contact-request',{preHandler:visitor,config:{rateLimit:{max:10,timeWindow:'1 minute'}}},async r=>{
  const input=z.object({consent:z.literal(true),consentVersion:z.string()}).strict().parse(r.body);
  if(input.consentVersion!==config.CONSENT_VERSION)throw new HttpError(409,'Условия обновились. Перезагрузите приложение');
  if(!r.visitor!.userId)throw new HttpError(401,'Откройте приложение через Telegram');
  // Repeated clicks must not erase a previously accepted registration.
  await db.query('insert into telegram_contact_consent(user_id,consent_version) values($1,$2) on conflict(user_id) do update set requested_at=now(),consent_version=excluded.consent_version',[r.visitor!.userId,config.CONSENT_VERSION]);
  return {ok:true};
 });
 app.get('/api/v1/control/registrations',{preHandler:editor},async r=>{
  const q=z.object({page:z.coerce.number().int().min(1).max(100000).default(1),q:z.string().trim().max(100).default('')}).parse(r.query);
  const where="u.phone is not null and (c.accepted_at is not null or p.verified_at is not null) and strpos(lower(concat_ws(' ',u.first_name,u.last_name,u.phone,u.telegram_username,u.telegram_user_id::text)),lower($1))>0";
  const total=Number((await db.query('select count(*) from app_users u left join telegram_contact_consent c on c.user_id=u.id left join phone_registrations p on p.user_id=u.id and p.phone=u.phone where '+where,[q.q])).rows[0].count);
  const items=(await db.query('select u.id,u.first_name,u.last_name,u.phone,u.telegram_username,u.telegram_user_id::text,coalesce(c.accepted_at,p.verified_at) as accepted_at from app_users u left join telegram_contact_consent c on c.user_id=u.id left join phone_registrations p on p.user_id=u.id and p.phone=u.phone where '+where+' order by coalesce(c.accepted_at,p.verified_at) desc,u.id limit 50 offset $2',[q.q,(q.page-1)*50])).rows;
  return {items,total,page:q.page,hasMore:q.page*50<total};
 });
}
