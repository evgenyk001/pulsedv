import * as webpush from 'web-push';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Database} from './database';
import type {RuntimeConfig} from './config';
import {HttpError} from './security';
import {registeredPhone} from './accountRoutes';
export function validPushEndpoint(value:string){
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&u.pathname.length>1&&
  (u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname==='web.push.apple.com'||u.hostname.endsWith('.push.apple.com')||u.hostname.endsWith('.notify.windows.com'));}catch{return false}
}
const key=(bytes:number)=>z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/).refine(v=>Buffer.from(v,'base64url').length===bytes,'Некорректный ключ устройства');
export function registerWebPush(app:FastifyInstance,db:Database,config:RuntimeConfig,visitor:(r:FastifyRequest)=>Promise<void>){
 const account=async(r:FastifyRequest)=>{
  await visitor(r);
  if(r.visitor!.userId&&await registeredPhone(db,r.visitor!.userId,config.CONSENT_VERSION))return;
  if(!r.visitor!.userId&&r.headers.authorization?.startsWith('Bearer ')&&(await db.query("select 1 from leads where session_id=$1 and source='pwa-contact' and user_id is null limit 1",[r.visitor!.sessionId])).rows.length)return;
  throw new HttpError(403,'Сначала отправьте заявку или войдите в аккаунт');
 };
 app.post('/api/v1/me/push/subscribe',{preHandler:account,config:{rateLimit:{max:12,timeWindow:'1 minute'}}},async r=>{
  if(!config.WEB_PUSH_PUBLIC_KEY||!config.WEB_PUSH_PRIVATE_KEY)throw new HttpError(503,'Push-уведомления ещё не настроены');
  const p=z.object({endpoint:z.string().max(3000).refine(validPushEndpoint,'Сервис уведомлений не поддерживается'),keys:z.object({p256dh:key(65),auth:key(16)}).strict()}).strict().parse(r.body);
  if(Buffer.from(p.keys.p256dh,'base64url')[0]!==4)throw new HttpError(400,'Некорректный ключ устройства');
  return db.transaction(async sql=>{
   const {userId,sessionId}=r.visitor!;
   const guestId=userId?null:sessionId;
   await sql.query(userId?'select id from app_users where id=$1 for update':'select id from sessions where id=$1 for update',[userId??sessionId]);
   const existing=(await sql.query('select id,user_id,session_id from push_subscriptions where endpoint=$1 for update',[p.endpoint])).rows[0];
   if(existing&&(existing.user_id!==userId||existing.session_id!==guestId))throw new HttpError(409,'Переподключите уведомления на этом устройстве');
   if(!existing&&Number((await sql.query('select count(*) from push_subscriptions where user_id=$1 or session_id=$2',[userId,guestId])).rows[0].count)>=10)throw new HttpError(409,'Подключено слишком много устройств');
   const row=(await sql.query('insert into push_subscriptions(user_id,endpoint,p256dh,auth,session_id) values($1,$2,$3,$4,$5) on conflict(endpoint) do update set enabled=true,p256dh=excluded.p256dh,auth=excluded.auth,updated_at=now() where push_subscriptions.user_id is not distinct from excluded.user_id and push_subscriptions.session_id is not distinct from excluded.session_id returning id',[userId,p.endpoint,p.keys.p256dh,p.keys.auth,guestId])).rows[0];
   if(!row)throw new HttpError(409,'Переподключите уведомления на этом устройстве');
   return {id:row.id};
  });
 });
 app.post('/api/v1/me/push/unsubscribe',{preHandler:account},async r=>{
  const p=z.object({id:z.uuid()}).strict().parse(r.body);
  await db.query('delete from push_subscriptions where id=$1 and (user_id=$2 or session_id=$3)',[p.id,r.visitor!.userId,r.visitor!.userId?null:r.visitor!.sessionId]);return {ok:true};
 });
}
export function pushRoute(link:unknown,origin:string){
 try{const u=new URL(typeof link==='string'?link:'/app/#/profile',origin);if(u.origin!==origin)return '/app/#/profile';
  if(u.pathname==='/pulsedv/mini-app/'||u.pathname==='/app/')return '/app/'+(u.hash||'#/profile');
 }catch{}return '/app/#/profile';
}
export type PushSend=(sub:webpush.PushSubscription,payload:string,options:webpush.RequestOptions)=>Promise<unknown>;
export async function deliverWebPush(db:Database,config:RuntimeConfig,send:PushSend=webpush.sendNotification){
 if(!config.WEB_PUSH_PUBLIC_KEY||!config.WEB_PUSH_PRIVATE_KEY)return {processed:0};
 const lease=randomUUID();
 const rows=(await db.query(`with picked as (select id from push_deliveries where delivered_at is null and dead_at is null and available_at<=now() and (locked_until is null or locked_until<now()) order by available_at limit 5 for update skip locked)
 update push_deliveries p set locked_until=now()+interval '120 seconds',lock_token=$1,attempts=attempts+1 from picked where p.id=picked.id returning p.*`,[lease])).rows;
 let processed=0;
 for(const d of rows){
  const row=(await db.query(`select s.*,o.topic,o.payload,o.available_at as event_at,o.aggregate_id from push_subscriptions s join outbox_events o on o.id=$2 where s.id=$1 and s.enabled and (s.user_id::text=o.payload->>'userId' or (o.topic='pwa.guest_reply' and s.session_id::text=o.payload->>'sessionId'))`,[d.subscription_id,d.event_id])).rows[0];
  const guest=row?.topic==='pwa.guest_reply';
  const eligible=row&&(guest
   ? (await db.query("select 1 from leads l join sessions s on s.id=l.session_id where l.id=$1 and s.id=$2 and s.user_id is null and l.user_id is null and l.source='pwa-contact'",[row.aggregate_id,row.session_id])).rows.length>0
   : await registeredPhone(db,row.user_id,config.CONSENT_VERSION));
  if(!row||Date.parse(row.event_at)<Date.now()-86400000||!eligible){
   await db.query('update push_deliveries set dead_at=now(),locked_until=null where id=$1 and lock_token=$2',[d.id,lease]);continue;
  }
  if(row.topic==='user.search_updates'){
   const consent=(await db.query('select settings,consent_key from search_profiles where owner=$1',['user:'+row.user_id])).rows[0];
   const ids=Array.isArray(row.payload.propertyIds)?row.payload.propertyIds:[];
   const visible=ids.length?(await db.query("select id from catalog_properties where id=any($1::text[]) and status='published'",[ids])).rows.length:0;
   if(!consent?.settings.push||consent.consent_key!==row.payload.consentKey||visible!==ids.length||!ids.length){await db.query('update push_deliveries set dead_at=now(),locked_until=null where id=$1 and lock_token=$2',[d.id,lease]);continue;}
  }
  if(row.topic==='user.broadcast_pwa'){
   const consent=(await db.query("select p.enabled,p.consent_key,p.consent_version,b.status from pwa_announcement_subscriptions p join broadcasts b on b.id=$2 join pwa_announcement_receipts a on a.id::text=$3 and a.user_id=p.user_id and a.campaign_id=b.id where p.user_id=$1",[row.user_id,row.payload.campaignId,row.payload.receiptId])).rows[0];
   if(!consent?.enabled||consent.consent_key!==row.payload.consentKey||consent.consent_version!==config.CONSENT_VERSION||consent.status==='cancelled'){
    await db.query('update push_deliveries set dead_at=now(),locked_until=null where id=$1 and lock_token=$2',[d.id,lease]);continue;
   }
  }
  if(row.topic==='user.showing_reminder'){
   const lead=(await db.query('select l.user_id,l.status,j.document from leads l left join client_journeys j on j.lead_id=l.id where l.id=$1',[row.aggregate_id])).rows[0];
   const showing=(lead?.document?.showings??[]).find((s:any)=>s.id===row.payload.showingId),at=Date.parse(showing?.at),hours=Number(row.payload.hours);
   if(!lead||lead.user_id!==row.user_id||['deal','closed','lost'].includes(lead.status)||showing?.status!=='confirmed'||at!==Date.parse(row.payload.at)||![24,2].includes(hours)||at<=Date.now()||Date.now()>at-hours*3600000+30*60000){
    await db.query('update push_deliveries set dead_at=now(),locked_until=null where id=$1 and lock_token=$2',[d.id,lease]);continue;
   }
  }
  if(row.topic==='user.giveaway'&&!(await db.query('select id from giveaway_entries where id::text=$1 and user_id=$2 and status=$3',[row.payload.entryId,row.user_id,row.payload.status])).rows.length){
   await db.query('update push_deliveries set dead_at=now(),locked_until=null where id=$1 and lock_token=$2',[d.id,lease]);continue;
  }
  try{
   // Private conversation text, phone numbers and security codes never appear on a lock screen.
   const tab=guest&&['collections','showings'].includes(row.payload.tab)?row.payload.tab:null;
   const title=tab==='collections'?'Новая подборка квартир':tab==='showings'?'Обновление по показу':row.topic==='user.broadcast_pwa'?'Новый анонс PULSEDV.RU':row.topic==='user.partner'?'Обновление в партнёрском кабинете':row.topic==='user.giveaway'?'Обновление по розыгрышу':row.topic==='user.search_updates'?'Обновление по вашему поиску':row.topic==='user.showing_reminder'?'Напоминание о показе':'Сообщение от PULSEDV.RU';
   const guestRoute='#/journey?lead='+row.aggregate_id+(tab?'&tab='+tab:'');
   const guestUrl='/landing-cinematic/pwa-preview/?pushRoute='+encodeURIComponent(guestRoute)+guestRoute;
   await send({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}},JSON.stringify({title,body:'Откройте приложение, чтобы посмотреть подробности.',url:guest?guestUrl:pushRoute(row.payload.deepLink,config.PUBLIC_ORIGIN),tag:'pulse-'+d.event_id}),{TTL:3600,timeout:8000,vapidDetails:{subject:config.WEB_PUSH_SUBJECT,publicKey:config.WEB_PUSH_PUBLIC_KEY,privateKey:config.WEB_PUSH_PRIVATE_KEY}});
   await db.query('update push_deliveries set delivered_at=now(),locked_until=null where id=$1 and lock_token=$2',[d.id,lease]);processed++;
  }catch(e){
   const status=(e as any)?.statusCode;
   if(status===404||status===410){await db.query('delete from push_subscriptions where id=$1',[d.subscription_id]);continue;}
   const permanent=[400,401,403,413].includes(status)||d.attempts>=8;
   await db.query("update push_deliveries set locked_until=null,dead_at=case when $3 then now() else null end,available_at=now()+($4::text||' seconds')::interval where id=$1 and lock_token=$2",[d.id,lease,permanent,Math.min(3600,30*2**d.attempts)]);
  }
 }
 return {processed};
}
