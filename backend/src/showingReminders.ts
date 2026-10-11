import type {Database,Sql} from './database';
import type {Journey} from '../../packages/journey/model';
import type {OutboxRecord} from './notificationWorker';

const topics="('manager.showing_reminder','user.showing_reminder')";
export function isShowingReminder(topic:string){return topic==='manager.showing_reminder'||topic==='user.showing_reminder'}

// Caller holds the lead row lock, the same lock used by journey and lead changes.
export async function syncShowingReminders(sql:Sql,leadId:string,origin:string,now=new Date()){
 const lead=(await sql.query('select * from leads where id=$1',[leadId])).rows[0];
 if(!lead)return;
 const journey=(await sql.query('select document from client_journeys where lead_id=$1',[leadId])).rows[0]?.document as Journey|undefined;
 const keys:string[]=[];
 if(!['deal','closed','lost'].includes(lead.status))for(const showing of journey?.showings??[]){
  const at=new Date(showing.at).getTime();
  if(showing.status!=='confirmed'||!Number.isFinite(at)||at<=now.getTime())continue;
  const name=(await sql.query('select name from catalog_properties where id=$1',[showing.propertyId])).rows[0]?.name??'Выбранный объект';
  for(const hours of [24,2])for(const target of [{kind:'manager',id:lead.manager_id},{kind:'user',id:lead.user_id}]){
   if(!target.id)continue;
   const key=['showing',leadId,showing.id,new Date(at).toISOString(),hours,target.kind,target.id].join(':');keys.push(key);
   const due=at-hours*3600000;
   // A late confirmation does not produce a burst of already-missed reminders.
   if(due<=now.getTime())continue;
   const time=new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Vladivostok',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(at));
   const payload={showingId:showing.id,at:new Date(at).toISOString(),hours,[target.kind==='manager'?'managerId':'userId']:target.id,title:`Показ через ${hours===24?'24 часа':'2 часа'}`,body:`${name} · ${time} (Владивосток). ${target.kind==='manager'?'Проверьте детали встречи в карточке клиента.':'Детали и перенос — в вашем обращении.'}`,deepLink:origin+(target.kind==='manager'?'/pulsedv/control-center/#/leads?lead='+leadId:'/pulsedv/mini-app/#/journey?lead='+leadId)};
   await sql.query(`insert into outbox_events(topic,aggregate_type,aggregate_id,payload,available_at,dedup_key) values($1,'lead',$2,$3::jsonb,$4,$5)
    on conflict(dedup_key) where dedup_key is not null do update set processed_at=null,dead_at=null,attempts=0,last_error=null,available_at=excluded.available_at,payload=excluded.payload
    where outbox_events.last_error='Showing reminder superseded'`,[target.kind+'.showing_reminder',leadId,JSON.stringify(payload),new Date(due).toISOString(),key]);
  }
 }
 await sql.query(`update outbox_events set processed_at=$3,locked_until=null,lock_token=null,last_error='Showing reminder superseded' where aggregate_id=$1 and topic in ${topics} and processed_at is null and not (dedup_key=any($2::text[]))`,[leadId,keys,now.toISOString()]);
}

// Rebuild missing schedules after restarts/assignment changes, in bounded pages.
export async function scheduleShowingReminders(db:Database,origin:string,now=new Date()){
 let cursor='00000000-0000-0000-0000-000000000000',checked=0;
 for(;;){
  const rows=(await db.query(`select l.id from leads l where l.id>$1 and (exists(select 1 from client_journeys j where j.lead_id=l.id and exists(select 1 from jsonb_array_elements(coalesce(j.document->'showings','[]'::jsonb)) s where s->>'status'='confirmed' and (s->>'at')::timestamptz>$2)) or exists(select 1 from outbox_events o where o.aggregate_id=l.id and o.topic in ${topics} and o.processed_at is null)) order by l.id limit 200`,[cursor,now.toISOString()])).rows;
  for(const row of rows)await db.transaction(async sql=>{await sql.query('select id from leads where id=$1 for update',[row.id]);await syncShowingReminders(sql,row.id,origin,now);checked++});
  if(rows.length<200)break;cursor=rows.at(-1)!.id;
 }
 return {checked};
}

// Validate the current schedule and recipient immediately before contacting Telegram.
export async function currentShowingReminder(db:Sql,event:OutboxRecord,lease:string|undefined,now=new Date()){
 const row=(await db.query(`select l.status,l.manager_id,l.user_id,j.document,o.processed_at,o.lock_token from outbox_events o join leads l on l.id=o.aggregate_id left join client_journeys j on j.lead_id=l.id where o.id=$1`,[event.id])).rows[0];
 if(!row||row.processed_at||row.lock_token!==lease||['deal','closed','lost'].includes(row.status))return false;
 const recipient=event.topic.startsWith('manager.')?row.manager_id:row.user_id;
 if(!recipient||recipient!==event.payload[event.topic.startsWith('manager.')?'managerId':'userId'])return false;
 const showing=(row.document?.showings??[]).find((s:any)=>s.id===event.payload.showingId);
 return !!showing&&showing.status==='confirmed'&&new Date(showing.at).getTime()===new Date(String(event.payload.at)).getTime()&&new Date(showing.at).getTime()>now.getTime();
}
