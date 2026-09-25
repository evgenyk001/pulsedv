import { randomUUID } from 'node:crypto';
import type { Database } from './database';
import type { NotificationOutboxRepository } from './notificationWorker';
export function outboxRepository(db:Database):NotificationOutboxRepository{
 const leases=new Map<string,string>();
 return {
  async claimBatch(limit){const token=randomUUID();const result=await db.query(`with picked as (
   select id from outbox_events where processed_at is null and dead_at is null and available_at<=now() and (locked_until is null or locked_until<now()) order by created_at limit $1 for update skip locked
   ) update outbox_events o set locked_until=now()+interval '120 seconds',lock_token=$2,attempts=o.attempts+1 from picked where o.id=picked.id returning o.*`,[limit,token]);
   return result.rows.map(row=>{leases.set(row.id,token);return {id:row.id,topic:row.topic,aggregateType:row.aggregate_type,aggregateId:row.aggregate_id,payload:row.payload,attempts:row.attempts};});},
  async managerTelegramUserId(id){const row=(await db.query('select telegram_user_id from team_members where id=$1 and active=true',[id])).rows[0];return row?.telegram_user_id?.toString()??null;},
  async userTelegramUserId(id){const row=(await db.query('select telegram_user_id from app_users where id=$1',[id])).rows[0];return row?.telegram_user_id?.toString()??null;},
  async markProcessed(id){await db.query('update outbox_events set processed_at=now(),locked_until=null,lock_token=null,last_error=null where id=$1 and lock_token=$2',[id,leases.get(id)]);leases.delete(id);},
  async markFailed(id,error,next){await db.query('update outbox_events set last_error=$2,available_at=$3,locked_until=null,lock_token=null,dead_at=case when attempts>=8 then now() else null end where id=$1 and lock_token=$4',[id,error.slice(0,500),next,leases.get(id)]);leases.delete(id);}
 };
}
