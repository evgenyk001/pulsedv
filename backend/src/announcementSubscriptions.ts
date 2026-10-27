import type {Sql} from './database';
/** Defaults never overwrite a choice already saved by the user. */
export async function ensureAnnouncementSubscription(sql:Sql,userId:string){
 await sql.query('insert into announcement_subscriptions(user_id,enabled) values($1,true) on conflict(user_id) do nothing',[userId]);
}
