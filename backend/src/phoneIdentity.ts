import type {Sql} from './database';
import {HttpError} from './security';
export function normalizePhone(value:string){
 let digits=value.replace(/[\s()+-]/g,'');
 if(/^8\d{10}$/.test(digits))digits='7'+digits.slice(1);
 if(!/^[1-9]\d{6,14}$/.test(digits))throw new HttpError(400,'Проверьте номер телефона, включая код страны');
 return '+'+digits;
}
export async function lockPhone(sql:Sql,phone:string){await sql.query('select pg_advisory_xact_lock(hashtext($1))',['pulse-phone:'+phone]);}
export async function phoneUser(sql:Sql,phone:string){
 const identity=(await sql.query('select user_id from phone_identities where phone=$1',[phone])).rows[0];
 if(identity)return identity.user_id as string;
 const matches=(await sql.query(`select u.id from app_users u where '+'||regexp_replace(u.phone,'[^0-9]','','g')=$1 and
 (exists(select 1 from telegram_contact_consent c where c.user_id=u.id and c.accepted_at is not null) or exists(select 1 from phone_registrations r where r.user_id=u.id and r.phone=u.phone))`,[phone])).rows;
 if(matches.length>1)throw new HttpError(409,'Для этого номера требуется помощь команды PULSEDV.RU. Данные аккаунтов сохранены.');
 return matches[0]?.id as string|undefined;
}
export async function acceptTelegramPhone(sql:Sql,telegramId:number,phone:string,version:string,person:{first_name:string;last_name?:string;username?:string}){
 await lockPhone(sql,phone);
 const current=(await sql.query('select * from app_users where telegram_user_id=$1 for update',[telegramId])).rows[0];
 if(!current)throw new HttpError(409,'Откройте приложение заново');
 const owner=await phoneUser(sql,phone),target=owner??current.id;
 if(target!==current.id){
  const canonical=(await sql.query('select * from app_users where id=$1 for update',[target])).rows[0];
  if(canonical.telegram_user_id)throw new HttpError(409,'Номер уже связан с другим Telegram. Обратитесь в PULSEDV.RU.');
  // Only a fresh, unverified Telegram placeholder can be attached automatically.
  // Never silently merge two established customer histories or financial records.
  const dirty=(await sql.query(`select ($2::boolean or exists(select 1 from leads where user_id=$1) or exists(select 1 from partner_profiles where user_id=$1) or exists(select 1 from giveaway_entries where user_id=$1) or exists(select 1 from favorite_sets where owner='user:'||$1::text and cardinality(property_ids)>0) or exists(select 1 from search_profiles where owner='user:'||$1::text)) as dirty`,[current.id,!!current.phone])).rows[0].dirty;
  if(dirty)throw new HttpError(409,'Нужна помощь со связью аккаунтов. Ваши данные сохранены — свяжитесь с PULSEDV.RU.');
  await sql.query('update app_users set telegram_user_id=null,telegram_username=null where id=$1',[current.id]);
  await sql.query('update app_users set telegram_user_id=$2 where id=$1',[target,telegramId]);
  for(const table of ['sessions','user_events','visitor_profiles'])await sql.query(`update ${table} set user_id=$2 where user_id=$1`,[current.id,target]);
 }
 await sql.query('delete from phone_identities where user_id=$1 and phone<>$2',[target,phone]);
 await sql.query('delete from phone_registrations where user_id=$1 and phone<>$2',[target,phone]);
 await sql.query('update app_users set phone=$2,first_name=$3,last_name=$4,telegram_username=$5,updated_at=now() where id=$1',[target,phone,person.first_name,person.last_name??null,person.username??null]);
 await sql.query('insert into phone_identities(phone,user_id) values($1,$2) on conflict(phone) do update set verified_at=now()',[phone,target]);
 await sql.query('insert into telegram_contact_consent(user_id,consent_version,accepted_at) values($1,$2,now()) on conflict(user_id) do update set consent_version=excluded.consent_version,accepted_at=now()',[target,version]);
 return target as string;
}
