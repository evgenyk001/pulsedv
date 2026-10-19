import {createHash,createHmac,randomBytes} from 'node:crypto';
import type {FastifyRequest,FastifyReply} from 'fastify';
import type {Sql} from './database';
import {HttpError} from './security';
import type {PartnerRisk,PartnerRiskSignal} from '../../packages/partners/model';

const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const iso=(v:any)=>v instanceof Date?v.toISOString():String(v);
declare module 'fastify' {interface FastifyRequest {antifraudDevice?:string;antifraudIp?:string}}

export function antifraudCollector(sql:Sql,production:boolean){
 let secret:string|undefined;
 return async(request:FastifyRequest,reply:FastifyReply)=>{
  const path=request.url.split('?')[0];
  if(!(path==='/api/v1/auth/session'||path==='/api/v1/auth/telegram'||path==='/api/v1/leads'||path.startsWith('/api/v1/me/partner')))return;
  secret??=(await sql.query('select secret from antifraud_secret where singleton=true')).rows[0]?.secret;
  if(!secret)throw new HttpError(503,'Примените миграцию антифрода перед приёмом обращений');
  const supplied=request.cookies.pulse_device;
  let device=supplied&&/^[a-f0-9]{64}$/.test(supplied)?(await sql.query('select id from antifraud_devices where token_hash=$1',[hash(supplied)])).rows[0]:null;
  if(!device){
   const token=randomBytes(32).toString('hex');
   device=(await sql.query('insert into antifraud_devices(token_hash) values($1) returning id',[hash(token)])).rows[0];
   reply.setCookie('pulse_device',token,{httpOnly:true,secure:production,sameSite:'strict',path:'/api/v1',maxAge:180*86400});
  }
  request.antifraudDevice=device.id;
  // request.ip uses the configured trusted proxy boundary, never a client-provided IP field.
  request.antifraudIp=createHmac('sha256',secret).update('ip:'+request.ip).digest('hex');
 };
}
export async function observeVisitor(sql:Sql,request:FastifyRequest,sessionId:string){
 if(!request.antifraudDevice||!request.antifraudIp)return;
 const agent=hash((request.headers['user-agent']||'').slice(0,512));
 await sql.query(`insert into antifraud_observations(session_id,device_id,ip_hash,agent_hash) values($1,$2,$3,$4)
 on conflict(session_id,device_id,ip_hash) do update set agent_hash=excluded.agent_hash,last_seen_at=now() where antifraud_observations.agent_hash<>excluded.agent_hash or antifraud_observations.last_seen_at<now()-interval '5 minutes'`,[sessionId,request.antifraudDevice,request.antifraudIp,agent]);
 await sql.query("update antifraud_devices set last_seen_at=now() where id=$1 and last_seen_at<now()-interval '1 hour'",[request.antifraudDevice]);
}

export async function assessPartnerRisk(sql:Sql,id:string):Promise<PartnerRisk>{
 const r=(await sql.query(`select r.*,l.user_id as lead_user_id,l.session_id,p.user_id as partner_user_id
 from partner_referrals r left join leads l on l.id=r.lead_id join partner_profiles p on p.id=r.partner_id where r.id=$1`,[id])).rows[0];
 if(!r)throw new HttpError(404,'Рекомендация не найдена');
 const buyer=r.buyer_user_id??r.lead_user_id;
 const signals:PartnerRiskSignal[]=[];
 const add=(code:string,label:string,severity:PartnerRiskSignal['severity'],evidence:string[]=[])=>signals.push({code,label,severity,evidence});
 add('phone_manual','Принадлежность номера проверяется при разговоре с покупателем; автоматического подтверждения номера нет','info');
 if(!buyer)add('telegram_missing','Покупатель не подтвердил вход через Telegram','info');
 if(!r.antifraud_device_id)add('device_missing','Нет сохранённой метки приложения: распознавание повторного устройства ограничено','info');
 const recent="o.last_seen_at>now()-interval '90 days'";
 const buyerDevices=buyer?(await sql.query(`select o.device_id,max(o.last_seen_at) as seen from antifraud_observations o join sessions s on s.id=o.session_id where s.user_id=$1 and o.device_id is not null and ${recent} group by o.device_id order by seen desc,o.device_id limit 51`,[buyer])).rows.map(v=>v.device_id as string):[];
 if(buyerDevices.length>50)add('device_churn','У аккаунта более 50 меток приложения за 90 дней: требуется проверка массовой смены окружения','high');
 const devices=[...new Set([...(r.antifraud_device_id?[r.antifraud_device_id]:[]),...buyerDevices])];
 if(devices.length){
  const users=(await sql.query(`select distinct s.user_id,(s.user_id=$2::uuid) as partner_match from antifraud_observations o join sessions s on s.id=o.session_id
   where o.device_id=any($1::uuid[]) and ${recent} and s.user_id is not null order by partner_match desc,s.user_id limit 21`,[devices,r.partner_user_id])).rows.map(v=>v.user_id as string);
  if(r.partner_user_id&&users.includes(r.partner_user_id))add('partner_device','Метка приложения покупателя встречалась у пригласившего партнёра','high',[r.partner_user_id]);
  const shared=(await sql.query(`select o.device_id from antifraud_observations o join sessions s on s.id=o.session_id where o.device_id=any($1::uuid[]) and ${recent} and s.user_id is not null group by o.device_id having count(distinct s.user_id)>=3 order by o.device_id limit 20`,[devices])).rows.map(v=>v.device_id as string);
  if(shared.length)add('device_accounts','На одной метке приложения замечены минимум три аккаунта','review',shared);
  const direct=(await sql.query(`select distinct l.id from leads l
   where l.antifraud_device_id=any($1::uuid[]) and l.id<>$2 and not exists(select 1 from partner_referrals prior where prior.lead_id=l.id) and l.created_at<$3 and l.created_at>now()-interval '90 days'
   and (l.user_id is distinct from $4::uuid or l.normalized_phone is distinct from $5::text) order by l.id limit 20`,[devices,r.lead_id,r.created_at,buyer,r.normalized_phone])).rows.map(v=>v.id as string);
  if(direct.length)add('device_direct_client','С этой меткой приложения связано более раннее прямое обращение с другими контактами','high',direct);
 }
 if(r.antifraud_ip_hash&&r.partner_user_id){
  const same=(await sql.query(`select 1 from antifraud_observations o join sessions s on s.id=o.session_id where o.ip_hash=$1 and s.user_id=$2 and ${recent} limit 1`,[r.antifraud_ip_hash,r.partner_user_id])).rows.length;
  if(same)add('partner_network','Покупатель и партнёр использовали одну сеть; само по себе это не нарушение','info');
 }
 if(r.antifraud_ip_hash){
  const networkUsers=(await sql.query("select distinct s.user_id from antifraud_observations o join sessions s on s.id=o.session_id where o.ip_hash=$1 and o.last_seen_at>now()-interval '24 hours' and s.user_id is not null order by s.user_id limit 6",[r.antifraud_ip_hash])).rows.map(v=>v.user_id as string);
  if(networkUsers.length>=5)add('network_accounts','За сутки из одной сети обращались не менее пяти аккаунтов; требуется проверка сочетания признаков','review');
 }
 const many=(await sql.query(`select id from partner_referrals where partner_id=$1 and created_at>now()-interval '24 hours' order by id limit 11`,[r.partner_id])).rows.map(v=>v.id as string);
 if(many.length>=10)add('partner_velocity','Не менее десяти рекомендаций от партнёра за сутки','review');
 // Initial adverse evidence survives cookie rotation and the rolling observation window.
 const initial=r.antifraud_initial as PartnerRisk|null;
 for(const previous of initial?.signals??[]){
  if(previous.severity==='info')continue;
  const current=signals.find(s=>s.code===previous.code);
  if(current)current.evidence=[...new Set([...current.evidence,...previous.evidence])].sort();else signals.push(previous);
 }
 signals.sort((a,b)=>a.code.localeCompare(b.code));
 const fingerprint=hash(JSON.stringify({version:1,buyer:buyer??null,phone:r.normalized_phone??null,device:r.antifraud_device_id,signals:signals.filter(s=>s.severity!=='info').map(s=>({...s,evidence:[...s.evidence].sort()}))}));
 const level=signals.some(s=>s.severity==='high')?'high':signals.some(s=>s.severity==='review')?'review':'clear';
 const review=(await sql.query('select fingerprint,created_at,stage from partner_risk_reviews where referral_id=$1 order by created_at desc,id desc limit 1',[id])).rows[0];
 return {version:1,level,signals,fingerprint,checkedAt:new Date().toISOString(),manualRequired:true,phoneVerification:'manual',reviewed:!!review&&review.fingerprint===fingerprint,reviewedAt:review?iso(review.created_at):null};
}
export async function recordRiskReview(sql:Sql,id:string,reviewer:string,note:string,stage:'accept'|'finance',fingerprint?:string,acknowledged=false){
 const risk=await assessPartnerRisk(sql,id);
 if(fingerprint&&fingerprint!==risk.fingerprint)throw new HttpError(409,'Результаты автопроверки изменились. Обновите рекомендацию');
 if(risk.level!=='clear'&&(!acknowledged||fingerprint!==risk.fingerprint))throw new HttpError(409,'Откройте актуальную автопроверку, разберите сигналы и подтвердите их проверку');
 if(risk.level!=='clear'&&note.trim().length<10)throw new HttpError(400,'Опишите результат разбора сигналов: минимум 10 символов');
 await sql.query('insert into partner_risk_reviews(referral_id,stage,fingerprint,assessment,reviewer_id,note) values($1,$2,$3,$4::jsonb,$5,$6)',[id,stage,risk.fingerprint,JSON.stringify(risk),reviewer,note]);
 return risk;
}
export async function requireRiskReviewed(sql:Sql,r:any){
 if(!r.reviewed_by)throw new HttpError(409,'Нужна ручная проверка закрепления владельцем в Control');
 const risk=await assessPartnerRisk(sql,r.id);
 if(!risk.reviewed)throw new HttpError(409,'Нужна актуальная ручная проверка антифрода перед начислением или выплатой');
}
