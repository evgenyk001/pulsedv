import { randomUUID } from 'node:crypto';
import {currentShowingReminder} from './showingReminders';
import type { Database } from './database';
import type { NotificationOutboxRepository } from './notificationWorker';
export function outboxRepository(db:Database):NotificationOutboxRepository{
 const leases=new Map<string,string>();
 return {
  async canDeliver(event){
   if(event.topic==='manager.security_code'){
    const challengeId=event.payload.challengeId;
    if(typeof challengeId!=='string'||typeof event.payload.expiresAt!=='string'||Date.parse(event.payload.expiresAt)<=Date.now())return false;
    return !!(await db.query('select id from control_login_challenges where id=$1 and member_id=$2 and consumed_at is null and expires_at>now()',[challengeId,event.payload.managerId])).rows.length;
   }
   if(event.topic==='user.search_updates'){
    const row=(await db.query('select settings,consent_key from search_profiles where owner=$1',[event.payload.owner])).rows[0];
    if(!row?.settings.telegram||row.consent_key!==event.payload.consentKey||Date.parse(String(event.payload.at))<Date.now()-86400000)return false;
    const ids=Array.isArray(event.payload.propertyIds)?event.payload.propertyIds:[];
    const visible=(await db.query("select id from catalog_properties where id=any($1::text[]) and status='published'",[ids])).rows;
    return ids.length>0&&visible.length===ids.length;
   }
   return currentShowingReminder(db,event,leases.get(event.id));
  },
  async claimBatch(limit){const token=randomUUID();const result=await db.query(`with picked as (
   select id from outbox_events where processed_at is null and dead_at is null and available_at<=now() and (locked_until is null or locked_until<now()) order by (topic='manager.security_code') desc,created_at limit $1 for update skip locked
   ) update outbox_events o set locked_until=now()+interval '120 seconds',lock_token=$2,attempts=o.attempts+1 from picked where o.id=picked.id returning o.*`,[limit,token]);
   return result.rows.sort((a,b)=>Number(b.topic==='manager.security_code')-Number(a.topic==='manager.security_code')||new Date(a.created_at).getTime()-new Date(b.created_at).getTime()).map(row=>{leases.set(row.id,token);return {id:row.id,topic:row.topic,aggregateType:row.aggregate_type,aggregateId:row.aggregate_id,payload:row.payload,attempts:row.attempts};});},
  async managerTelegramUserId(id){const row=(await db.query('select telegram_user_id from team_members where id=$1 and active=true',[id])).rows[0];return row?.telegram_user_id?.toString()??null;},
  async ownerTelegramUserId(){const row=(await db.query("select telegram_user_id from team_members where role='owner' and active=true order by id limit 1")).rows[0];return row?.telegram_user_id?.toString()??null;},
  async userTelegramUserId(id){const row=(await db.query('select telegram_user_id from app_users where id=$1',[id])).rows[0];return row?.telegram_user_id?.toString()??null;},
  async markSkipped(id,reason='Showing reminder superseded'){await db.query("update outbox_events set processed_at=now(),locked_until=null,lock_token=null,last_error=$3,payload=case when topic='manager.security_code' then '{}'::jsonb else payload end where id=$1 and lock_token=$2",[id,leases.get(id),reason]);leases.delete(id);},
  async markProcessed(id){await db.query("update outbox_events set processed_at=now(),locked_until=null,lock_token=null,last_error=null,payload=case when topic='manager.security_code' then '{}'::jsonb else payload end where id=$1 and lock_token=$2",[id,leases.get(id)]);leases.delete(id);},
  async markFailed(id,error,next){await db.query('update outbox_events set last_error=$2,available_at=$3,locked_until=null,lock_token=null,dead_at=case when attempts>=8 then now() else null end where id=$1 and lock_token=$4',[id,error.slice(0,500),next,leases.get(id)]);leases.delete(id);}
 };
}
