import type {FastifyInstance,FastifyRequest} from 'fastify';
import {z} from 'zod';
import QRCode from 'qrcode';
import type {Database,Sql} from './database';
import type {RuntimeConfig} from './config';
import {attribution} from '../../packages/journey/attribution';
import {HttpError} from './security';
import {randomUUID} from 'node:crypto';

const input=z.object({id:z.uuid(),search:z.string().max(3000).default(''),referrer:z.string().max(2000).default('')}).strict();
const token=(id:string)=>'acq_'+id.replaceAll('-','');
const telegram=(id:string,username:string)=>'https://t.me/'+username+'?startapp='+token(id);
function tokenId(value:string|null|undefined){
 if(!value||!/^acq_[a-f0-9]{32}$/.test(value))return null;
 const v=value.slice(4);return [v.slice(0,8),v.slice(8,12),v.slice(12,16),v.slice(16,20),v.slice(20)].join('-');
}
export async function linkAcquisition(sql:Sql,sessionId:string,startParam:string|null){
 const id=tokenId(startParam);if(!id)return;
 await sql.query(`insert into acquisition_sessions(visit_id,session_id) select id,$2 from acquisition_visits where id=$1 and surface='landing' and created_at>now()-interval '30 days' on conflict do nothing`,[id,sessionId]);
 await sql.query(`update sessions s set acquisition_id=v.id,source=v.source,medium=nullif(v.medium,''),campaign=nullif(v.campaign,'') from acquisition_visits v where s.id=$2 and s.acquisition_id is null and v.id=$1 and v.surface='landing' and v.created_at>now()-interval '30 days'`,[id,sessionId]);
}
export function registerAcquisitionRoutes(app:FastifyInstance,db:Database,config:RuntimeConfig,visitor:(r:FastifyRequest)=>Promise<void>,control:(r:FastifyRequest)=>Promise<void>){
 app.post('/api/v1/public/traffic',{config:{rateLimit:{max:30,timeWindow:'1 minute'}}},async(r,reply)=>{
  const body=input.parse(r.body),a=attribution(body.search,body.referrer,config.PUBLIC_ORIGIN);
  await db.query(`insert into acquisition_visits(id,surface,source,medium,campaign,content,term,referrer) values($1,'landing',$2,$3,$4,$5,$6,$7) on conflict do nothing`,[body.id,a.source,a.medium,a.campaign,a.content,a.term,a.referrer]);
  reply.setCookie('pulse_acquisition',body.id,{httpOnly:true,secure:config.NODE_ENV==='production',sameSite:'lax',path:'/api/v1',maxAge:30*86400});
  return {id:body.id,url:telegram(body.id,config.TELEGRAM_BOT_USERNAME),go:'/api/v1/public/traffic/'+body.id+'/go',qr:'/api/v1/public/traffic/'+body.id+'/qr'};
 });
 app.get('/api/v1/public/traffic/:id/go',{config:{rateLimit:{max:60,timeWindow:'1 minute'}}},async(r,reply)=>{
  const id=z.uuid().parse((r.params as any).id),placement=z.enum(['primary','social','qr']).catch('primary').parse((r.query as any).placement);
  // Count navigation on our own server, before handing it over to Telegram.
  await db.query(`insert into acquisition_clicks(id,visit_id,placement) select $1,id,$3 from acquisition_visits where id=$2 and surface='landing' and created_at>now()-interval '30 days'`,[randomUUID(),id,placement]);
  return reply.redirect(telegram(id,config.TELEGRAM_BOT_USERNAME));
 });
 app.get('/api/v1/public/traffic/:id/qr',{config:{rateLimit:{max:30,timeWindow:'1 minute'}}},async(r,reply)=>{
  const id=z.uuid().parse((r.params as any).id);
  if(!(await db.query("select 1 from acquisition_visits where id=$1 and surface='landing' and created_at>now()-interval '30 days'",[id])).rows.length)throw new HttpError(404,'Переход не найден');
  return reply.type('image/svg+xml').send(await QRCode.toString(telegram(id,config.TELEGRAM_BOT_USERNAME),{type:'svg',margin:2,errorCorrectionLevel:'M'}));
 });
 app.post('/api/v1/public/traffic/click',{config:{rateLimit:{max:60,timeWindow:'1 minute'}}},async r=>{
  const body=z.object({id:z.uuid(),visitId:z.uuid(),placement:z.enum(['primary','social','qr'])}).strict().parse(r.body);
  await db.query(`insert into acquisition_clicks(id,visit_id,placement) select $1,id,$3 from acquisition_visits where id=$2 and surface='landing' and created_at>now()-interval '30 days' on conflict do nothing`,[body.id,body.visitId,body.placement]);
  return {ok:true};
 });
 app.post('/api/v1/me/acquisition',{preHandler:visitor},async r=>{
  const body=input.parse(r.body),a=attribution(body.search,body.referrer,config.PUBLIC_ORIGIN),sessionId=r.visitor!.sessionId;
  await db.transaction(async sql=>{
   await sql.query('select id from sessions where id=$1 for update',[sessionId]);
   const cookie=z.uuid().safeParse(r.cookies.pulse_acquisition);
   if(cookie.success)await linkAcquisition(sql,sessionId,token(cookie.data));
   const session=(await sql.query('select telegram_start_param from sessions where id=$1',[sessionId])).rows[0];
   const parent=tokenId(session.telegram_start_param)||(cookie.success?cookie.data:null);
   const landing=parent?(await sql.query("select * from acquisition_visits where id=$1 and surface='landing' and created_at>now()-interval '30 days'",[parent])).rows[0]:null;
   const source=new URLSearchParams(body.search).has('utm_source')?a:(landing||a);
   await sql.query(`insert into acquisition_visits(id,surface,source,medium,campaign,content,term,referrer) values($1,'miniapp',$2,$3,$4,$5,$6,$7) on conflict do nothing`,[body.id,source.source,source.medium||'',source.campaign||'',source.content||'',source.term||'',source.referrer||'']);
   await sql.query(`insert into acquisition_sessions(visit_id,session_id) select id,$2 from acquisition_visits where id=$1 and surface='miniapp' on conflict do nothing`,[body.id,sessionId]);
   await sql.query(`update sessions set acquisition_id=$2,source=$3,medium=nullif($4,''),campaign=nullif($5,'') where id=$1 and acquisition_id is null`,[sessionId,body.id,a.source,a.medium,a.campaign]);
  });return {ok:true};
 });
 app.get('/api/v1/control/traffic',{preHandler:control},async r=>{
  if(r.member!.role==='manager')throw new HttpError(403,'Общую статистику источников видит администратор');
  const items=(await db.query(`select v.source,v.medium,v.campaign,v.content,v.term,
   count(*) filter(where v.surface='landing')::int as landing,
   count(*) filter(where v.surface='landing' and exists(select 1 from acquisition_clicks c where c.visit_id=v.id))::int as clicks,
   count(*) filter(where v.surface='miniapp')::int as miniapp,
   count(*) filter(where v.surface='landing' and exists(select 1 from acquisition_sessions a where a.visit_id=v.id))::int as opened,
   count(*) filter(where exists(select 1 from sessions s join leads l on l.session_id=s.id where s.acquisition_id=v.id and l.created_at>=v.created_at))::int as contacts
   from acquisition_visits v where v.created_at>=now()-interval '90 days' group by 1,2,3,4,5 order by count(*) desc,v.source,v.campaign limit 501`)).rows;
  return {items:items.slice(0,500),limited:items.length>500,days:90};
 });
}
