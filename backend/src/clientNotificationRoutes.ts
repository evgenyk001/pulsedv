import {z} from 'zod';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Database,Sql} from './database';
import {favoriteOwner} from './favoriteRoutes';

// All source rows are scoped before projection. Counts cover the full inbox,
// including messages outside the chat's paginated 50-message window.
const notices=`with owned as (
 select id from leads where session_id=$1::uuid or (user_id=$2::uuid and $2::uuid is not null)
), raw as (
 select 'message:'||m.id as id,'message' as kind,'Сообщение от менеджера' as title,
 left(coalesce(m.document->>'text',''),160) as body,
 (m.document->>'at')::timestamptz as at,
 '/journey?lead='||m.lead_id as href,
 (m.document->>'readAt' is not null) as source_read
 from journey_messages m join owned o on o.id=m.lead_id where m.document->>'author'='manager'
 union all
 select 'collection:'||(c->>'id')||':'||coalesce(c->>'updatedAt',c->>'createdAt'),'collection',
 'Подборка: '||(c->>'title'),'Новые варианты для вашей покупки',
 coalesce(c->>'updatedAt',c->>'createdAt')::timestamptz,
 '/journey?lead='||j.lead_id||'&tab=collections',false
 from client_journeys j join owned o on o.id=j.lead_id
 cross join lateral jsonb_array_elements(coalesce(j.document->'collections','[]'::jsonb)) c where c->>'published'='true'
 union all
 select 'showing:'||(s->>'id')||':'||(s->>'updatedAt'),'showing',
 case when s->>'changeDecision'='declined' then 'Перенос показа отклонён'
 when s->>'changeDecision'='accepted' then 'Новое время показа подтверждено'
 when s->>'status'='confirmed' then 'Показ подтверждён'
 when s->>'status'='cancelled' then 'Показ отменён' else 'Обновление по показу' end,
 'Посмотрите время и детали встречи',(s->>'updatedAt')::timestamptz,
 '/journey?lead='||j.lead_id||'&tab=showings',false
 from client_journeys j join owned o on o.id=j.lead_id
 cross join lateral jsonb_array_elements(coalesce(j.document->'showings','[]'::jsonb)) s
 where s->>'updatedBy'='manager' and s->>'updatedAt' is not null
 union all
 select 'search:'||(f->>'id'),'search',f->>'title',f->>'name',(f->>'at')::timestamptz,
 '/property/'||(f->>'propertyId'),false
 from search_profiles p cross join lateral jsonb_array_elements(p.feed) f
 join catalog_properties c on c.id=f->>'propertyId' and c.status='published' where p.owner=$3
 union all
 select 'partner:'||e.id,'partner',e.label,'Откройте кабинет партнёра для подробностей',e.created_at,
 '/partners?referral='||r.id,false
 from partner_referral_events e join partner_referrals r on r.id=e.referral_id join partner_profiles p on p.id=r.partner_id
 where p.user_id=$2::uuid and e.kind in ('accrued','payout_details','payout_agreed','payout_reopened','paid')
), notices as (
 select r.id,r.kind,r.title,r.body,r.at,r.href,(r.source_read or seen.notice_id is not null) as read
 from raw r left join client_notification_reads seen on seen.owner=$3 and seen.notice_id=r.id where seen.dismissed_at is null
)`;
async function inbox(sql:Sql,args:unknown[]){
 const row=(await sql.query(notices+`select
 (select count(*)::int from notices where not read) as unread_count,
 coalesce((select jsonb_agg(to_jsonb(n) order by n.at desc,n.id) from (select * from notices order by at desc,id limit 80) n),'[]'::jsonb) as items`,args)).rows[0];
 return {items:row.items,unreadCount:row.unread_count};
}
export async function mergeNotificationReads(sql:Sql,sessionId:string,userId:string){
 await sql.query('insert into client_notification_reads(owner,notice_id,read_at,dismissed_at) select $2,notice_id,read_at,dismissed_at from client_notification_reads where owner=$1 on conflict(owner,notice_id) do update set dismissed_at=coalesce(client_notification_reads.dismissed_at,excluded.dismissed_at)',['session:'+sessionId,'user:'+userId]);
 await sql.query('delete from client_notification_reads where owner=$1',['session:'+sessionId]);
 await sql.query('insert into client_journey_preferences(owner,lead_id,pinned_at,hidden_at) select $2,lead_id,pinned_at,hidden_at from client_journey_preferences where owner=$1 on conflict(owner,lead_id) do update set pinned_at=coalesce(client_journey_preferences.pinned_at,excluded.pinned_at),hidden_at=coalesce(client_journey_preferences.hidden_at,excluded.hidden_at)',['session:'+sessionId,'user:'+userId]);
 await sql.query('delete from client_journey_preferences where owner=$1',['session:'+sessionId]);
}
export async function registerClientNotificationRoutes(app:FastifyInstance,db:Database,visitor:(r:FastifyRequest)=>Promise<void>){
 const input=z.union([z.object({ids:z.array(z.string().min(1).max(300)).min(1).max(100)}).strict(),z.object({all:z.literal(true)}).strict()]);
 app.get('/api/v1/me/notifications',{preHandler:visitor},async request=>db.transaction(async sql=>{
  const {owner}=await favoriteOwner(sql,request.visitor!.sessionId);
  return inbox(sql,[request.visitor!.sessionId,request.visitor!.userId??null,owner]);
 }));
 app.post('/api/v1/me/notifications/dismiss',{preHandler:visitor,config:{rateLimit:{max:120,timeWindow:'1 minute'}}},async request=>{
  const command=z.object({ids:z.array(z.string().min(1).max(300)).min(1).max(100)}).strict().parse(request.body);
  return db.transaction(async sql=>{
   const {owner}=await favoriteOwner(sql,request.visitor!.sessionId);
   const args=[request.visitor!.sessionId,request.visitor!.userId??null,owner];
   await sql.query(notices+`insert into client_notification_reads(owner,notice_id,dismissed_at) select $3,id,now() from notices where id=any($4::text[]) on conflict(owner,notice_id) do update set dismissed_at=excluded.dismissed_at`,[...args,command.ids]);
   return inbox(sql,args);
  });
 });
 app.post('/api/v1/me/notifications/read',{preHandler:visitor,config:{rateLimit:{max:60,timeWindow:'1 minute'}}},async request=>{
  const command=input.parse(request.body);
  return db.transaction(async sql=>{
   const {owner}=await favoriteOwner(sql,request.visitor!.sessionId);
   const args=[request.visitor!.sessionId,request.visitor!.userId??null,owner];
   await sql.query(notices+`insert into client_notification_reads(owner,notice_id)
    select $3,id from notices where not read and ($4::boolean or id=any($5::text[])) on conflict do nothing`,[...args,'all' in command,'ids' in command?command.ids:[]]);
   return inbox(sql,args);
  });
 });
}
