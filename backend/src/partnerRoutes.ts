import {assessPartnerRisk,recordRiskReview,requireRiskReviewed} from './partnerAntifraud';
import {registerPartnerPayoutRoutes,payoutSchema,payoutNotice} from './partnerPayout';
import {payoutError} from '../../packages/partners/payout';
import {randomBytes,createHash,randomUUID} from 'node:crypto';
import {offerText,offerSections,OFFER_VERSION,OFFER_VERSIONS} from '../../packages/partners/offer';
import {claimExpiresOn,claimDateError,claimMonths} from '../../packages/partners/policy';
import {z} from 'zod';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Database,Sql} from './database';
import type {RuntimeConfig} from './config';
import {camelRow} from './database';
import {HttpError} from './security';
import {audit} from './repository';
import {phoneSchema} from './validation';
import {businessDay} from '../../packages/pulse-data/business';
import {PARTNER_TERMS_VERSION,PARTNER_REWARD_BPS,PARTNER_RESERVE_BPS,partnerReward,partnerRejectReasons,partnerStageLabels,publicClientName,normalizePartnerPhone,type PartnerReferral,type PartnerReward} from '../../packages/partners/model';

const dateOnly=(v:any)=>v?(v instanceof Date?v.toISOString():String(v)).slice(0,10):null;
const codeSchema=z.string().regex(/^[a-zA-Z0-9_-]{12,64}$/);
const token=(prefix:string)=>prefix+randomBytes(12).toString('hex');
export async function partnerEvent(sql:Sql,id:string,kind:string,label:string){await sql.query('insert into partner_referral_events(referral_id,kind,label) values($1,$2,$3)',[id,kind,label]);}
export async function lockBuyerIdentity(sql:Sql,phone:string,userId:string|null){
 const keys=['partner-phone:'+normalizePartnerPhone(phone),...(userId?['partner-user:'+userId]:[])].sort();
 for(const key of keys)await sql.query('select pg_advisory_xact_lock(hashtext($1))',[key]);
}
async function resolveCode(sql:Sql,code:string,lock=false){
 let p=(await sql.query('select *,null::uuid as invitation_id from partner_profiles where code=$1'+(lock?' for update':''),[code])).rows[0];
 if(!p){const invite=(await sql.query('select * from partner_invitations where code=$1',[code])).rows[0];if(invite)p={...(await sql.query('select * from partner_profiles where id=$1'+(lock?' for update':''),[invite.partner_id])).rows[0],invitation_id:invite.id};}
 if(!p||p.status!=='active'||p.terms_version!==PARTNER_TERMS_VERSION)throw new HttpError(404,'Приглашение недоступно. Свяжитесь с PULSE.DV');
 return p;
}
export async function preparePartnerReferral(sql:Sql,code:string|undefined,buyerUserId:string|null,phone?:string){
 if(!code)return null;
 const partner=await resolveCode(sql,code,true);
 if(buyerUserId&&partner.user_id===buyerUserId)throw new HttpError(400,'Собственная покупка не участвует в программе рекомендаций');
 if(phone){
  const reserved=await activeReservation(sql,phone);
  const target=(await sql.query(reservationSelect+" where i.code=$1 and b.released_at is null and b.converted_referral_id is null and b.expires_at>now()",[code])).rows[0];
  if(target&&target.normalized_phone!==phone)throw new HttpError(409,'Это приглашение предназначено для другого номера. Уточните ссылку у партнёра');
  if(reserved&&reserved.partner_id!==partner.id)throw new HttpError(409,'Рекомендация для этого клиента уже зарегистрирована. Можно отправить обычную заявку без новой рекомендации');
  const reservation=target??reserved;
  if(reservation){
   if(await identityUnavailable(sql,phone,buyerUserId,reservation.id))throw new HttpError(409,'Клиент уже известен агентству или закреплён. Можно отправить обычную заявку без новой рекомендации');
   partner.reservation=reservation;partner.invitation_id=reservation.invitation_id;
  }else if(await identityUnavailable(sql,phone,buyerUserId))throw new HttpError(409,'Клиент не уникальный или уже закреплён. Можно отправить обычную заявку без новой рекомендации');
 }
 return partner;
}
export async function attachPartnerReferral(sql:Sql,leadId:string,buyerUserId:string|null,phone:string,code:string,partner:any,deviceId?:string,ipHash?:string){
 if(normalizePartnerPhone(partner.phone)===phone)throw new HttpError(400,'Собственная покупка не участвует в программе рекомендаций');
 const row=(await sql.query('insert into partner_referrals(partner_id,invitation_id,lead_id,buyer_user_id,normalized_phone,terms_version,attribution_code) values($1,$2,$3,$4,$5,$6,$7) returning id',[partner.id,partner.invitation_id,leadId,buyerUserId,phone,partner.terms_version,code])).rows[0];
 await partnerEvent(sql,row.id,'submitted','Покупатель подтвердил рекомендацию. Проверяем уникальность');
 await sql.query('update partner_referrals set antifraud_device_id=$2,antifraud_ip_hash=$3 where id=$1',[row.id,deviceId??null,ipHash??null]);
 const risk=await assessPartnerRisk(sql,row.id);
 await sql.query('update partner_referrals set antifraud_initial=$2::jsonb where id=$1',[row.id,JSON.stringify(risk)]);
 await partnerEvent(sql,row.id,'manual_review','Рекомендация получена. Ожидает проверки команды PULSE');
 return row.id as string;
}
// Compare timestamps inside PostgreSQL: JavaScript Date would discard microseconds.
function priorityTime(alias:string){return `coalesce((select b.created_at from partner_client_reservations b where b.invitation_id=${alias}.invitation_id and b.normalized_phone=${alias}.normalized_phone and b.released_at is null and b.expires_at>=${alias}.created_at),${alias}.created_at)`;}
export async function conflicts(sql:Sql,r:any){
 const matches=(await sql.query(`select l.id,l.name,l.phone,r2.id as referral_id,r2.partner_id,r2.status,r2.rejection_reason,p.name as partner_name
 from leads l left join partner_referrals r2 on r2.lead_id=l.id left join partner_profiles p on p.id=r2.partner_id
 where l.id<>$1 and (l.normalized_phone=$2 or ($3::uuid is not null and l.user_id=$3))
 and (r2.status='accepted' or (l.created_at<(select ${priorityTime('original')} from partner_referrals original where original.id=$4) and not (coalesce(r2.status,'')='rejected' and coalesce(r2.rejection_reason,'')='unconfirmed')))
 order by l.created_at,l.id limit 20`,[r.lead_id,r.normalized_phone,r.buyer_user_id,r.id])).rows;
 const claimed=(await sql.query('select referral_id from partner_client_claims where referral_id<>$1 and (normalized_phone=$2 or ($3::uuid is not null and buyer_user_id=$3))',[r.id,r.normalized_phone,r.buyer_user_id])).rows;
 const partner=(await sql.query('select user_id,phone from partner_profiles where id=$1',[r.partner_id])).rows[0];
 const self=!!partner&&((!!r.buyer_user_id&&partner.user_id===r.buyer_user_id)||(!!r.normalized_phone&&partner.phone===r.normalized_phone));
 return {matches,claimed,self};
}
async function lockReferral(sql:Sql,id:string){
 const base=(await sql.query('select r.*,l.user_id as lead_user_id from partner_referrals r left join leads l on l.id=r.lead_id where r.id=$1',[id])).rows[0];
 if(!base)throw new HttpError(404,'Рекомендация не найдена');
 const expectedUser=base.buyer_user_id??base.lead_user_id??null;
 await lockBuyerIdentity(sql,base.normalized_phone||'',expectedUser);
 const lead=(await sql.query('select * from leads where id=$1 for update',[base.lead_id])).rows[0];
 const r=(await sql.query('select * from partner_referrals where id=$1 for update',[id])).rows[0];
 const actualUser=r.buyer_user_id??lead?.user_id??null;
 if(actualUser!==expectedUser)throw new HttpError(409,'Данные покупателя обновились. Повторите проверку');
 r.buyer_user_id=actualUser;
 return {r,lead};
}
async function requireUniqueForFinance(sql:Sql,r:any){
 const clash=await conflicts(sql,r);
 if(clash.self)throw new HttpError(409,'Собственная покупка не участвует в партнёрском вознаграждении');
 if(clash.matches.length||clash.claimed.length)throw new HttpError(409,'Выявлено совпадение покупателя. Разберите закрепление перед начислением или выплатой');
 await requireRiskReviewed(sql,r);
}
const reservationSelect=`select b.*,i.code,i.label,exists(select 1 from partner_referrals r where r.partner_id=b.partner_id and r.invitation_id=b.invitation_id) as submitted from partner_client_reservations b join partner_invitations i on i.id=b.invitation_id`;
function reservationDto(row:any){return {id:row.id,code:row.code,label:row.label,phoneHint:'••• '+row.normalized_phone.slice(-4),submitted:row.submitted===true,expiresAt:row.expires_at instanceof Date?row.expires_at.toISOString():row.expires_at,createdAt:row.created_at instanceof Date?row.created_at.toISOString():row.created_at};}
async function activeReservation(sql:Sql,phone:string){return (await sql.query(reservationSelect+" where b.normalized_phone=$1 and b.released_at is null and b.converted_referral_id is null and b.expires_at>now()",[phone])).rows[0];}
async function identityUnavailable(sql:Sql,phone:string,userId:string|null=null,reservationId:string|null=null){
 const known=(await sql.query(`select l.id from leads l left join partner_referrals r on r.lead_id=l.id
 where (l.normalized_phone=$1 or ($2::uuid is not null and l.user_id=$2))
 and ($3::uuid is null or l.created_at<(select created_at from partner_client_reservations where id=$3))
 and not (coalesce(r.status,'')='rejected' and coalesce(r.rejection_reason,'')='unconfirmed') limit 1`,[phone,userId,reservationId])).rows.length;
 const claimed=(await sql.query('select referral_id from partner_client_claims where normalized_phone=$1 or ($2::uuid is not null and buyer_user_id=$2)',[phone,userId])).rows.length;
 return !!(known||claimed);
}
function rewardDto(row:any,privateView:boolean):PartnerReward{
 const r=camelRow(row);
 const coordination={payoutDetails:r.payoutDetails??null,payoutStage:r.payoutStage??null};
 return {id:r.id,referralId:r.referralId,commissionRub:Number(r.commissionRub),receivedOn:String(r.receivedOn).slice(0,10),dealOn:r.dealOn?String(r.dealOn).slice(0,10):null,reserveMinor:Number(r.reserveMinor),baseMinor:Number(r.baseMinor),grossMinor:Number(r.grossMinor),status:r.status,recipientType:r.recipientType,requestedAt:r.requestedAt,paidOn:r.paidOn?String(r.paidOn).slice(0,10):null,withheldMinor:Number(r.withheldMinor),paidMinor:Number(r.paidMinor),revision:r.revision,createdAt:r.createdAt,...coordination,...(privateView?{payoutReference:r.payoutReference,documentReference:r.documentReference}:{})};
}
async function referralDtos(sql:Sql,rows:any[],privateView:boolean):Promise<PartnerReferral[]>{
 if(!rows.length)return [];
 const ids=rows.map(r=>r.id);
 const events=(await sql.query('select id,referral_id,kind,label,created_at from partner_referral_events where referral_id=any($1::uuid[]) order by sequence',[ids])).rows.map(camelRow);
 const rewards=(await sql.query("select * from partner_rewards where referral_id=any($1::uuid[]) order by (status='void'),created_at desc,id desc",[ids])).rows.map(r=>rewardDto(r,privateView));
 const riskReviews=privateView?(await sql.query('select v.id,v.referral_id,v.stage,v.note,v.created_at,m.name as reviewer_name from partner_risk_reviews v left join team_members m on m.id=v.reviewer_id where v.referral_id=any($1::uuid[]) order by v.created_at desc,v.id desc',[ids])).rows.map(camelRow):[];
 return Promise.all(rows.map(async r=>{
  const clash=privateView?await conflicts(sql,{...r,buyer_user_id:r.buyer_user_id??r.lead_user_id}):null;
  return {id:r.id,partnerId:r.partner_id,partnerName:r.partner_name,leadId:privateView?r.lead_id:null,invitationId:r.invitation_id,clientName:privateView?r.client_name:publicClientName(r.client_name||'Покупатель'),...(privateView?{partnerContact:{phone:r.partner_phone,telegramUsername:r.partner_telegram||null},clientPhone:r.client_phone,reviewNote:r.review_note||'',antifraud:await assessPartnerRisk(sql,r.id),riskReviews:riskReviews.filter(v=>v.referralId===r.id).map(v=>({id:v.id,stage:v.stage,note:v.note,reviewerName:v.reviewerName,createdAt:v.createdAt})),conflictLeads:clash!.matches.map(m=>({id:m.id,label:m.name+' · '+m.phone})),conflictDetails:clash!.matches.map(m=>m.name+' · '+m.phone+(m.partner_name?' · партнёр '+m.partner_name:' · прямое обращение')).join('\n')+(clash!.claimed.length?'\nЕсть подтверждённое закрепление':'')+(clash!.self?'\nСобственная покупка партнёра':'')}:{ }),termsVersion:r.terms_version,claimStartedOn:dateOnly(r.claim_started_on),claimExpiresOn:dateOnly(r.claim_expires_on),dealConfirmedOn:dateOnly(r.deal_confirmed_on),status:r.status,stage:r.stage,stageLabel:partnerStageLabels[r.stage]||'Обращение',conflict:!!clash&&(clash.matches.length>0||clash.claimed.length>0||clash.self),rejectionReason:r.rejection_reason,revision:r.revision,createdAt:r.created_at instanceof Date?r.created_at.toISOString():r.created_at,acceptedAt:r.accepted_at instanceof Date?r.accepted_at.toISOString():r.accepted_at,events:events.filter(e=>e.referralId===r.id) as any,reward:rewards.find(w=>w.referralId===r.id)??null};
 }));
}
function referralFilter(filter:string){
 if(filter==='payments')return " and exists(select 1 from partner_rewards w where w.referral_id=r.id)";
 if(filter==='pending')return " and r.status='pending'";
 if(filter==='payouts')return " and exists(select 1 from partner_rewards w where w.referral_id=r.id and w.status in ('accrued','requested'))";
 if(filter==='conflicts')return ` and (exists(select 1 from partner_profiles p where p.id=r.partner_id and (p.phone=r.normalized_phone or p.user_id=coalesce(r.buyer_user_id,(select user_id from leads where id=r.lead_id)))) or exists(select 1 from partner_client_claims c where c.referral_id<>r.id and (c.normalized_phone=r.normalized_phone or c.buyer_user_id=coalesce(r.buyer_user_id,(select user_id from leads where id=r.lead_id)))) or exists(select 1 from leads x left join partner_referrals t on t.lead_id=x.id where x.id<>r.lead_id and (x.normalized_phone=r.normalized_phone or x.user_id=coalesce(r.buyer_user_id,(select user_id from leads where id=r.lead_id))) and (t.status='accepted' or (x.created_at<${priorityTime('r')} and not (coalesce(t.status,'')='rejected' and coalesce(t.rejection_reason,'')='unconfirmed')))))`;
 return '';
}
const referralSelect=`select r.*,p.name as partner_name,p.phone as partner_phone,pu.telegram_username as partner_telegram,l.name as client_name,l.phone as client_phone,l.user_id as lead_user_id,l.status as stage from partner_referrals r join partner_profiles p on p.id=r.partner_id left join app_users pu on pu.id=p.user_id left join leads l on l.id=r.lead_id`;
export async function guardPartnerFinance(sql:Sql,leadId:string,finance:any,status:string){
 const row=(await sql.query("select w.* from partner_rewards w join partner_referrals r on r.id=w.referral_id where r.lead_id=$1 and w.status<>'void'",[leadId])).rows[0];
 if(row&&(Number(row.commission_rub)!==finance?.commissionRub||String(row.received_on instanceof Date?row.received_on.toISOString().slice(0,10):row.received_on)!==finance?.receivedOn||!['deal','closed'].includes(status)))throw new HttpError(409,'Вознаграждение уже начислено. Сначала отмените неоплаченное начисление в разделе «Партнёры»');
}
export async function partnerLeadChanged(sql:Sql,leadId:string,previous:any,next:any){
 const r=(await sql.query("select id from partner_referrals where lead_id=$1 and status='accepted'",[leadId])).rows[0];if(!r)return;
 if(['deal','closed'].includes(next.status))await sql.query('update partner_referrals set deal_confirmed_on=coalesce(deal_confirmed_on,$2::date) where id=$1',[r.id,businessDay()]);
 if(previous.status!==next.status)await partnerEvent(sql,r.id,'stage',partnerStageLabels[next.status]||'Статус обращения обновлён');
 if(previous.finance?.receivedOn!==next.finance?.receivedOn&&next.finance?.receivedOn)await partnerEvent(sql,r.id,'commission','Комиссия получена агентством. Вознаграждение ожидает проверки');
}
export async function registerPartnerRoutes(app:FastifyInstance,{db,config,visitor,editor,owner}:{db:Database;config:RuntimeConfig;visitor:(r:FastifyRequest)=>Promise<void>;editor:(r:FastifyRequest)=>Promise<void>;owner:(r:FastifyRequest)=>Promise<void>}){
 registerPartnerPayoutRoutes(app,db,config,owner);
 const operator={name:config.LEGAL_OPERATOR_NAME,inn:config.LEGAL_OPERATOR_INN,email:config.LEGAL_CONTACT_EMAIL,address:config.LEGAL_OPERATOR_ADDRESS,registration:config.LEGAL_OPERATOR_REGISTRATION};
 const published=config.PARTNER_OFFER_PUBLISHED&&config.PARTNER_OFFER_APPROVED_VERSION===OFFER_VERSION&&Object.values(operator).every(Boolean);
 const acceptance=async(sql:Sql,p:any)=>{const text=offerText(),hash=createHash('sha256').update(JSON.stringify({version:OFFER_VERSION,text,operator})).digest('hex');await sql.query('insert into partner_terms_acceptances(partner_id,terms_version,document_text,document_sha256,operator_snapshot,publication_state) values($1,$2,$3,$4,$5::jsonb,$6)',[p.id,OFFER_VERSION,text,hash,JSON.stringify(operator),published?'published':'draft']);};
 const requirePublished=()=>{if(!published)throw new HttpError(409,'Программа ещё готовится к запуску: окончательная оферта не опубликована');};
 const authenticated=async(r:FastifyRequest)=>{await visitor(r);if(!r.visitor!.userId)throw new HttpError(403,'Откройте приложение в Telegram для подключения к программе');};
 const profile=async(sql:Sql,userId:string)=>{const p=(await sql.query('select * from partner_profiles where user_id=$1',[userId])).rows[0];if(!p)throw new HttpError(403,'Подключитесь к партнёрской программе');return p;};
 const pageSchema=z.object({page:z.coerce.number().int().min(1).max(100000).default(1),limit:z.coerce.number().int().min(1).max(100).default(30),filter:z.enum(['all','payments','pending','conflicts','payouts']).default('all')}).strict();
 app.get('/api/v1/public/partner-program',async()=>({termsVersion:PARTNER_TERMS_VERSION,rewardBps:PARTNER_REWARD_BPS,reserveBps:PARTNER_RESERVE_BPS,botUsername:config.TELEGRAM_BOT_USERNAME,offerUrl:'/partner-offer/',offerPublished:published}));
 app.get('/api/v1/public/partner-offer',async request=>{const version=z.enum(OFFER_VERSIONS).default(OFFER_VERSION).parse((request.query as any).version);return {version,sections:offerSections(version),operator,published:version===OFFER_VERSION&&published};});
 app.get('/api/v1/public/partner-invites/:code',{config:{rateLimit:{max:40,timeWindow:'1 minute'}}},async request=>{
  const p=await resolveCode(db,codeSchema.parse((request.params as any).code));return {partnerName:p.name,code:(request.params as any).code,termsVersion:PARTNER_TERMS_VERSION};
 });
 app.get('/api/v1/me/partner',{preHandler:visitor},async request=>{
  const q=pageSchema.parse(request.query),userId=request.visitor!.userId;
  const emptySummary={accruedMinor:0,paidMinor:0,pendingCount:0,acceptedCount:0};
  if(!userId)return {authenticated:false,partner:null,referrals:[],invitations:[],page:q.page,total:0,hasMore:false,summary:emptySummary};
  const p=(await db.query('select * from partner_profiles where user_id=$1',[userId])).rows[0];
  if(!p)return {authenticated:true,partner:null,referrals:[],invitations:[],page:q.page,total:0,hasMore:false,summary:emptySummary};
  const rows=(await db.query(referralSelect+' where r.partner_id=$1'+referralFilter(q.filter)+' order by r.created_at desc,r.id limit $2 offset $3',[p.id,q.limit,(q.page-1)*q.limit])).rows;
  const total=Number((await db.query('select count(*) as n from partner_referrals r where partner_id=$1'+referralFilter(q.filter),[p.id])).rows[0].n);
  const sums=(await db.query("select coalesce(sum(w.gross_minor) filter(where w.status in ('accrued','requested')),0) as accrued,coalesce(sum(w.paid_minor) filter(where w.status='paid'),0) as paid from partner_rewards w join partner_referrals r on r.id=w.referral_id where r.partner_id=$1",[p.id])).rows[0];
  const counts=(await db.query("select count(*) filter(where status='pending') as pending,count(*) filter(where status='accepted') as accepted from partner_referrals where partner_id=$1",[p.id])).rows[0];
  return {authenticated:true,partner:camelRow(p),referrals:await referralDtos(db,rows,false),invitations:(await db.query('select i.*,exists(select 1 from partner_referrals r where r.invitation_id=i.id) as submitted from partner_invitations i where partner_id=$1 order by created_at desc limit 30',[p.id])).rows.map(camelRow),reservations:(await db.query(reservationSelect+' where b.partner_id=$1 and b.released_at is null and b.converted_referral_id is null and b.expires_at>now() order by b.created_at desc limit 200',[p.id])).rows.map(reservationDto),page:q.page,total,hasMore:q.page*q.limit<total,summary:{accruedMinor:Number(sums.accrued),paidMinor:Number(sums.paid),pendingCount:Number(counts.pending),acceptedCount:Number(counts.accepted)}};
 });
 app.post('/api/v1/me/partner/join',{preHandler:authenticated,config:{rateLimit:{max:5,timeWindow:'1 minute'}}},async request=>{
  const input=z.object({name:z.string().trim().min(2).max(80),phone:phoneSchema,consent:z.literal(true),termsVersion:z.literal(PARTNER_TERMS_VERSION)}).strict().parse(request.body);
  requirePublished();
  return db.transaction(async sql=>{await sql.query('select id from app_users where id=$1 for update',[request.visitor!.userId]);
   const existing=(await sql.query('select * from partner_profiles where user_id=$1',[request.visitor!.userId])).rows[0];if(existing)return {partner:camelRow(existing)};
   const p=(await sql.query('insert into partner_profiles(user_id,name,phone,code,terms_version) values($1,$2,$3,$4,$5) returning *',[request.visitor!.userId,input.name,input.phone,token('p'),input.termsVersion])).rows[0];await acceptance(sql,p);return {partner:camelRow(p)};
  });
 });
 app.post('/api/v1/me/partner/terms',{preHandler:authenticated},async request=>{
  z.object({consent:z.literal(true),termsVersion:z.literal(OFFER_VERSION)}).strict().parse(request.body);requirePublished();
  return db.transaction(async sql=>{const p=(await sql.query('select * from partner_profiles where user_id=$1 for update',[request.visitor!.userId])).rows[0];if(!p)throw new HttpError(404,'Партнёр не найден');if(p.terms_version===OFFER_VERSION)return {ok:true};await acceptance(sql,p);await sql.query('update partner_profiles set terms_version=$2,terms_accepted_at=now() where id=$1',[p.id,OFFER_VERSION]);return {ok:true};});
 });
 app.post('/api/v1/me/partner/invitations',{preHandler:authenticated,config:{rateLimit:{max:10,timeWindow:'1 minute'}}},async request=>{
  const input=z.object({label:z.string().trim().min(2).max(100),idempotencyKey:z.uuid()}).strict().parse(request.body);
  return db.transaction(async sql=>{const p=await profile(sql,request.visitor!.userId!);if(p.status!=='active'||p.terms_version!==OFFER_VERSION)throw new HttpError(403,'Новые приглашения временно недоступны');
   const old=(await sql.query('select * from partner_invitations where id=$1 and partner_id=$2',[input.idempotencyKey,p.id])).rows[0];if(old){if(old.label!==input.label)throw new HttpError(409,'Ключ приглашения уже использован');return {invitation:camelRow(old)};}
   const locked=(await sql.query('select status from partner_profiles where id=$1 for update',[p.id])).rows[0];if(locked.status!=='active')throw new HttpError(403,'Новые приглашения временно недоступны');
   const again=(await sql.query('select * from partner_invitations where id=$1',[input.idempotencyKey])).rows[0];if(again){if(again.partner_id!==p.id||again.label!==input.label)throw new HttpError(409,'Ключ приглашения уже использован');return {invitation:camelRow(again)};}
   const invite=(await sql.query('insert into partner_invitations(id,partner_id,code,label) values($1,$2,$3,$4) returning *',[input.idempotencyKey,p.id,token('i'),input.label])).rows[0];return {invitation:camelRow(invite)};
  });
 });
 app.post('/api/v1/me/partner/reservations',{preHandler:authenticated,config:{rateLimit:{max:10,timeWindow:'1 minute'}}},async request=>{
  const input=z.object({phone:phoneSchema,label:z.string().trim().min(2).max(100),contactConsent:z.literal(true),idempotencyKey:z.uuid()}).strict().parse(request.body);
  requirePublished();
  return db.transaction(async sql=>{
   await lockBuyerIdentity(sql,input.phone,null);
   const p=await profile(sql,request.visitor!.userId!);
   await sql.query('select id from partner_profiles where id=$1 for update',[p.id]);
   const current=await profile(sql,request.visitor!.userId!);
   if(current.status!=='active'||current.terms_version!==OFFER_VERSION)throw new HttpError(403,'Примите актуальные условия и проверьте статус программы');
   if(normalizePartnerPhone(p.phone)===input.phone)return {outcome:'self',message:'Собственная покупка не участвует в программе'};
   const old=(await sql.query(reservationSelect+' where b.id=$1',[input.idempotencyKey])).rows[0];
   if(old){
    if(old.partner_id!==p.id||old.normalized_phone!==input.phone||old.label!==input.label)throw new HttpError(409,'Ключ проверки уже использован');
    if(old.converted_referral_id)return {outcome:'confirmed',message:'Клиент уже закреплён за вами. Этапы покупки доступны в рекомендациях'};
    if(old.released_at||new Date(old.expires_at).getTime()<=Date.now())return {outcome:'expired',message:'Срок предварительной брони истёк. Выполните новую проверку'};
    return {outcome:'reserved',message:'Номер проверен. Предварительная бронь оформлена за вами',reservation:reservationDto(old)};
   }
   const budget=(await sql.query('update partner_profiles set identity_check_day=$2,identity_check_count=case when identity_check_day=$2 then identity_check_count+1 else 1 end where id=$1 and (identity_check_day is distinct from $2 or identity_check_count<100) returning id',[p.id,businessDay()])).rows;
   if(!budget.length)throw new HttpError(429,'Дневной лимит проверок исчерпан. Свяжитесь с PULSE');
   if(await identityUnavailable(sql,input.phone))return {outcome:'not_unique',message:'Клиента нельзя добавить: он уже обращался к нам или закреплён. Если нужна проверка результата, напишите команде PULSE'};
   const held=await activeReservation(sql,input.phone);
   if(held)return held.partner_id===p.id?{outcome:'reserved',message:'Этот номер уже забронирован за вами',reservation:reservationDto(held)}:{outcome:'not_unique',message:'Клиента нельзя добавить: он уже обращался к нам или закреплён. Если нужна проверка результата, напишите команде PULSE'};
   const count=Number((await sql.query("select count(*) as n from partner_client_reservations where partner_id=$1 and created_at>now()-interval '1 day'",[p.id])).rows[0].n);
   if(count>=20)throw new HttpError(429,'На сегодня доступно 20 проверок с бронью. Для большего потока свяжитесь с PULSE');
   const activeCount=Number((await sql.query("select count(*) as n from partner_client_reservations where partner_id=$1 and released_at is null and converted_referral_id is null and expires_at>now()",[p.id])).rows[0].n);
   if(activeCount>=20)throw new HttpError(429,'Достигнут лимит 20 активных броней. Дождитесь подтверждения покупателей или свяжитесь с PULSE');
   await sql.query('update partner_client_reservations set released_at=now() where normalized_phone=$1 and released_at is null and converted_referral_id is null and expires_at<=now()',[input.phone]);
   const invitation=(await sql.query('insert into partner_invitations(id,partner_id,code,label) values($1,$2,$3,$4) returning *',[randomUUID(),p.id,token('i'),input.label])).rows[0];
   const row=(await sql.query('insert into partner_client_reservations(id,partner_id,invitation_id,normalized_phone) values($1,$2,$3,$4) returning *',[input.idempotencyKey,p.id,invitation.id,input.phone])).rows[0];
   return {outcome:'reserved',message:'Номер подходит. Он защищён за вами на 7 дней — отправьте клиенту ссылку',reservation:reservationDto({...row,code:invitation.code,label:invitation.label})};
  });
 });
 app.post('/api/v1/me/partner/rewards/:id/request',{preHandler:authenticated},async request=>{
  const id=z.uuid().parse((request.params as any).id),input=z.object({recipientType:z.enum(['person','ip','company','npd']),revision:z.number().int().positive().optional(),payout:payoutSchema.optional()}).strict().parse(request.body);
  return db.transaction(async sql=>{const p=await profile(sql,request.visitor!.userId!);const base=(await sql.query('select w.referral_id from partner_rewards w join partner_referrals r on r.id=w.referral_id where w.id=$1 and r.partner_id=$2',[id,p.id])).rows[0];if(!base)throw new HttpError(404,'Начисление не найдено');await sql.query('select id from partner_referrals where id=$1 for update',[base.referral_id]);const w=(await sql.query('select * from partner_rewards where id=$1 for update',[id])).rows[0];
   if(!['accrued','requested'].includes(w.status))throw new HttpError(409,'Начисление недоступно для оформления');
   if(input.payout){if(input.revision!==w.revision)throw new HttpError(409,'Данные выплаты изменились. Обновите кабинет');if(w.payout_stage==='agreed')throw new HttpError(409,'Получение уже согласовано. Свяжитесь с командой для изменения');const error=payoutError(input.payout);if(error)throw new HttpError(400,error);}
   else if(w.status==='requested')return {ok:true};
   await sql.query("update partner_rewards set status='requested',recipient_type=$2,requested_at=now(),payout_details=coalesce($3::jsonb,payout_details),payout_stage=case when $3::jsonb is null then payout_stage when $3::jsonb->>'method'='contact' then 'details_needed' else 'details_received' end,revision=revision+1 where id=$1",[id,input.recipientType,input.payout?JSON.stringify(input.payout):null]);await partnerEvent(sql,w.referral_id,'payout_requested','Партнёр запросил оформление выплаты');await payoutNotice(sql,config,w.referral_id,'Нужно согласовать выплату партнёру',true);return {ok:true};
  });
 });
 app.post('/api/v1/me/partner/rewards/:id/change-request',{preHandler:authenticated},async request=>{
  const id=z.uuid().parse((request.params as any).id),input=z.object({revision:z.number().int().positive()}).strict().parse(request.body);
  return db.transaction(async sql=>{
   const p=await profile(sql,request.visitor!.userId!);
   const base=(await sql.query('select w.referral_id from partner_rewards w join partner_referrals r on r.id=w.referral_id where w.id=$1 and r.partner_id=$2',[id,p.id])).rows[0];
   if(!base)throw new HttpError(404,'Начисление не найдено');
   await sql.query('select id from partner_referrals where id=$1 for update',[base.referral_id]);
   const w=(await sql.query('select * from partner_rewards where id=$1 for update',[id])).rows[0];
   if(w.revision!==input.revision||w.payout_stage!=='agreed'||!['accrued','requested'].includes(w.status))throw new HttpError(409,'Получение уже изменилось или выплата выполнена');
   await sql.query("update partner_rewards set payout_stage='details_needed',payout_agreed_by=null,payout_agreed_at=null,revision=revision+1 where id=$1",[id]);
   await partnerEvent(sql,w.referral_id,'payout_reopened','Партнёр попросил изменить договорённость о получении');
   await payoutNotice(sql,config,w.referral_id,'Партнёр просит изменить получение вознаграждения',true);
   return {ok:true};
  });
 });
 app.get('/api/v1/me/partner/referrals/:id',{preHandler:authenticated},async request=>{
  const id=z.uuid().parse((request.params as any).id),rows=(await db.query(referralSelect+' where r.id=$1 and p.user_id=$2',[id,request.visitor!.userId])).rows;
  if(!rows.length)throw new HttpError(404,'Рекомендация не найдена');return {referral:(await referralDtos(db,rows,false))[0]};
 });
 app.get('/api/v1/control/partners',{preHandler:editor},async request=>{
  const q=pageSchema.extend({reservationPage:z.coerce.number().int().min(1).max(100000).default(1)}).parse(request.query);const total=Number((await db.query('select count(*) as n from partner_referrals r where true'+referralFilter(q.filter))).rows[0].n);
  const reservationTotal=Number((await db.query('select count(*) as n from partner_client_reservations where released_at is null and converted_referral_id is null and expires_at>now()')).rows[0].n);
  const rows=(await db.query(referralSelect+' where true'+referralFilter(q.filter)+' order by r.created_at desc,r.id limit $1 offset $2',[q.limit,(q.page-1)*q.limit])).rows;
  const counts=(await db.query("select count(*)::int as total,count(*) filter(where status='pending')::int as pending,count(*) filter(where exists(select 1 from partner_rewards w where w.referral_id=r.id and w.status='requested'))::int as requested,count(*) filter(where "+referralFilter('conflicts').slice(5)+")::int as conflicts from partner_referrals r")).rows[0];
  return {securityAttempts:(await db.query('select a.id,a.reason,a.created_at,p.name as partner_name from partner_security_attempts a left join partner_profiles p on p.id=a.partner_id order by a.created_at desc,a.id desc limit 20')).rows.map(camelRow),reservationTotal,reservationPage:q.reservationPage,reservationHasMore:q.reservationPage*30<reservationTotal,counts,reservations:(await db.query(reservationSelect.replace('select b.*','select p.name as partner_name,b.*')+" join partner_profiles p on p.id=b.partner_id where b.released_at is null and b.converted_referral_id is null and b.expires_at>now() order by b.created_at desc,b.id limit 30 offset $1",[(q.reservationPage-1)*30])).rows.map(row=>({...reservationDto(row),partnerName:row.partner_name,phone:row.normalized_phone})),partners:(await db.query('select * from partner_profiles order by created_at desc limit 100')).rows.map(camelRow),referrals:await referralDtos(db,rows,true),page:q.page,total,hasMore:q.page*q.limit<total};
 });
 app.get('/api/v1/control/partner-referrals/:id',{preHandler:editor},async request=>{
  const id=z.uuid().parse((request.params as any).id);const rows=(await db.query(referralSelect+' where r.id=$1',[id])).rows;if(!rows.length)throw new HttpError(404,'Рекомендация не найдена');return {referral:(await referralDtos(db,rows,true))[0]};
 });
 app.get('/api/v1/control/leads/:id/partner',{preHandler:editor},async request=>{
  const id=z.uuid().parse((request.params as any).id);const rows=(await db.query(referralSelect+' where r.lead_id=$1',[id])).rows;return {referral:(await referralDtos(db,rows,true))[0]??null};
 });
 app.post('/api/v1/control/partner-reservations/:id/release',{preHandler:owner},async request=>{
  const id=z.uuid().parse((request.params as any).id),{reason}=z.object({reason:z.string().trim().min(10).max(1000)}).strict().parse(request.body);
  return db.transaction(async sql=>{
   const base=(await sql.query('select * from partner_client_reservations where id=$1',[id])).rows[0];if(!base)throw new HttpError(404,'Бронь не найдена');
   await lockBuyerIdentity(sql,base.normalized_phone||'',null);
   const row=(await sql.query('select * from partner_client_reservations where id=$1 for update',[id])).rows[0];
   if(row.converted_referral_id)throw new HttpError(409,'Клиент уже закреплён. Предварительную бронь снять нельзя');
   if(row.released_at)return {ok:true};
   await sql.query('update partner_client_reservations set released_at=now() where id=$1',[id]);
   await audit(sql,request.member!.id,'partner.reservation.release',id,{reason,partnerId:row.partner_id});return {ok:true};
  });
 });
 app.patch('/api/v1/control/partners/:id',{preHandler:owner},async request=>{
  const id=z.uuid().parse((request.params as any).id),input=z.object({status:z.enum(['active','paused'])}).strict().parse(request.body);
  return db.transaction(async sql=>{const changed=await sql.query('update partner_profiles set status=$2 where id=$1 returning id',[id,input.status]);if(!changed.rows.length)throw new HttpError(404,'Партнёр не найден');await audit(sql,request.member!.id,'partner.status',id,input);return {ok:true};});
 });
 app.post('/api/v1/control/partner-referrals/:id/review',{preHandler:owner},async request=>{
  const id=z.uuid().parse((request.params as any).id),input=z.object({revision:z.number().int().positive(),decision:z.enum(['accept','reject']),contactConfirmed:z.boolean(),riskAcknowledged:z.boolean().default(false),riskFingerprint:z.string().regex(/^[a-f0-9]{64}$/).optional(),reason:z.enum(['existing','duplicate','self','unconfirmed','fraud','other']).optional(),note:z.string().trim().min(2).max(1000)}).strict().parse(request.body);
  return db.transaction(async sql=>{
   const {r,lead}=await lockReferral(sql,id);
   if(r.revision!==input.revision||r.status!=='pending')throw new HttpError(409,'Рекомендация уже рассмотрена или изменилась');
   if(input.decision==='accept'){
    if(!lead||!r.normalized_phone||!lead.consent_at||!input.contactConfirmed)throw new HttpError(400,'Подтвердите контакт с покупателем и его обращение');
    const p=(await sql.query('select * from partner_profiles where id=$1',[r.partner_id])).rows[0];
    if((p.user_id&&p.user_id===r.buyer_user_id)||p.phone===r.normalized_phone)throw new HttpError(409,'Собственная покупка не участвует в программе');
    const clash=await conflicts(sql,r);if(clash.matches.length||clash.claimed.length)throw new HttpError(409,'Найдено совпадение в CRM или более ранняя рекомендация. Разберите совпадение перед закреплением');
    await recordRiskReview(sql,id,request.member!.id,input.note,'accept',input.riskFingerprint,input.riskAcknowledged);
    await sql.query('insert into partner_client_claims(referral_id,normalized_phone,buyer_user_id) values($1,$2,$3)',[id,r.normalized_phone,r.buyer_user_id]);
    await sql.query('update partner_client_reservations set converted_referral_id=$3 where normalized_phone=$1 and partner_id=$2 and released_at is null and converted_referral_id is null',[r.normalized_phone,r.partner_id,id]);
    const start=claimMonths(r.terms_version)?businessDay():null;
    await sql.query("update partner_referrals set status='accepted',accepted_at=now(),reviewed_by=$2,review_note=$3,claim_started_on=$4,claim_expires_on=$5,deal_confirmed_on=$6,buyer_user_id=$7,revision=revision+1 where id=$1",[id,request.member!.id,input.note,start,start?claimExpiresOn(start,claimMonths(r.terms_version)):null,['deal','closed'].includes(lead.status)?businessDay():null,r.buyer_user_id]);
    await partnerEvent(sql,id,'accepted','Клиент проверен и закреплён за партнёром');await partnerEvent(sql,id,'stage',partnerStageLabels[lead.status]||'Обращение принято');
   }else{
    if(!input.reason)throw new HttpError(400,'Укажите причину отказа');
    await sql.query("update partner_referrals set status='rejected',rejection_reason=$2,review_note=$3,reviewed_by=$4,revision=revision+1 where id=$1",[id,input.reason,input.note,request.member!.id]);await partnerEvent(sql,id,'rejected',partnerRejectReasons[input.reason]);
   }
   await audit(sql,request.member!.id,'partner.review',id,{decision:input.decision});return {ok:true};
  });
 });
 app.post('/api/v1/control/partner-referrals/:id/risk-review',{preHandler:owner},async request=>{
  const id=z.uuid().parse((request.params as any).id),input=z.object({revision:z.number().int().positive(),contactConfirmed:z.literal(true),riskAcknowledged:z.boolean(),riskFingerprint:z.string().regex(/^[a-f0-9]{64}$/),note:z.string().trim().min(10).max(1000)}).strict().parse(request.body);
  return db.transaction(async sql=>{
   const {r,lead}=await lockReferral(sql,id);
   if(r.revision!==input.revision||r.status!=='accepted'||!lead?.consent_at)throw new HttpError(409,'Обновите закрепление перед проверкой');
   const clash=await conflicts(sql,r);if(clash.self||clash.matches.length||clash.claimed.length)throw new HttpError(409,'Сначала разберите конфликт покупателя');
   await recordRiskReview(sql,id,request.member!.id,input.note,'finance',input.riskFingerprint,input.riskAcknowledged);
   await sql.query('update partner_referrals set reviewed_by=$2,revision=revision+1 where id=$1',[id,request.member!.id]);
   await audit(sql,request.member!.id,'partner.risk.review',id,{note:input.note,fingerprint:input.riskFingerprint});return {ok:true};
  });
 });
 app.post('/api/v1/control/partner-referrals/:id/accrue',{preHandler:owner},async request=>{
  const id=z.uuid().parse((request.params as any).id);const {revision,dealOn:inputDealOn}=z.object({revision:z.number().int().positive(),dealOn:z.iso.date().optional()}).strict().parse(request.body);
  return db.transaction(async sql=>{
   const {r,lead}=await lockReferral(sql,id);
   if(r.status!=='accepted')throw new HttpError(409,'Сначала подтвердите актуальное закрепление');
   await requireUniqueForFinance(sql,r);
   const old=(await sql.query("select * from partner_rewards where referral_id=$1 and status<>'void'",[id])).rows[0];if(old)return {ok:true,reward:rewardDto(old,true)};
   if(r.revision!==revision)throw new HttpError(409,'Сначала подтвердите актуальное закрепление');
   if(!lead||!['deal','closed'].includes(lead.status)||!lead.finance?.receivedOn||!lead.finance?.commissionRub||lead.finance.receivedOn>businessDay())throw new HttpError(400,'Нужны завершённая сделка и фактическое поступление комиссии в карточке клиента');
   const date=dateOnly;const dealOn=inputDealOn||date(r.deal_confirmed_on)||businessDay();const error=claimDateError(date(r.claim_started_on),date(r.claim_expires_on),dealOn);if(error)throw new HttpError(400,error);
   await sql.query('update partner_referrals set deal_confirmed_on=$2 where id=$1',[id,dealOn]);
   const amount=partnerReward(lead.finance.commissionRub,r.reserve_bps,r.reward_bps);
   const w=(await sql.query("insert into partner_rewards(referral_id,commission_rub,received_on,reserve_minor,base_minor,gross_minor,approved_by,deal_on,payout_stage) values($1,$2,$3,$4,$5,$6,$7,$8,'details_needed') returning *",[id,amount.commissionRub,lead.finance.receivedOn,amount.reserveMinor,amount.baseMinor,amount.grossMinor,request.member!.id,dealOn])).rows[0];
   await partnerEvent(sql,id,'accrued','Вознаграждение начислено после проверки полученной комиссии');await payoutNotice(sql,config,id,'Вознаграждение начислено — выберите способ получения');await audit(sql,request.member!.id,'partner.accrue',id,{grossMinor:amount.grossMinor,dealOn});return {ok:true,reward:rewardDto(w,true)};
  });
 });
 app.post('/api/v1/control/partner-rewards/:id/pay',{preHandler:owner},async request=>{
  const id=z.uuid().parse((request.params as any).id),input=z.object({revision:z.number().int().positive(),withheldMinor:z.number().int().nonnegative().max(100_000_000_000),paidOn:z.iso.date(),payoutReference:z.string().trim().min(3).max(300),documentReference:z.string().trim().min(3).max(500),documentsChecked:z.literal(true)}).strict().parse(request.body);
  if(input.paidOn>businessDay())throw new HttpError(400,'Фактическая выплата не может быть в будущем');
  return db.transaction(async sql=>{const base=(await sql.query('select referral_id from partner_rewards where id=$1',[id])).rows[0];if(!base)throw new HttpError(404,'Начисление не найдено');const {r}=await lockReferral(sql,base.referral_id);
   const w=(await sql.query('select * from partner_rewards where id=$1 for update',[id])).rows[0];
   await requireUniqueForFinance(sql,r);
   if(w.revision!==input.revision||!['accrued','requested'].includes(w.status))throw new HttpError(409,'Выплата уже изменилась или недоступна');
   if(input.withheldMinor>Number(w.gross_minor))throw new HttpError(400,'Удержания больше начисления');
   if(w.payout_stage&&(w.payout_stage!=='agreed'||!w.payout_details||payoutError(w.payout_details,true)))throw new HttpError(409,'Сначала согласуйте с партнёром способ получения');
   await sql.query("update partner_rewards set status='paid',withheld_minor=$2,paid_minor=gross_minor-$2,paid_on=$3,payout_reference=$4,document_reference=$5,paid_by=$6,revision=revision+1 where id=$1",[id,input.withheldMinor,input.paidOn,input.payoutReference,input.documentReference,request.member!.id]);
   await partnerEvent(sql,w.referral_id,'paid','Выплата подтверждена агентством');await payoutNotice(sql,config,w.referral_id,'Выплата вознаграждения подтверждена');await audit(sql,request.member!.id,'partner.pay',id,{paidMinor:Number(w.gross_minor)-input.withheldMinor,paidOn:input.paidOn});return {ok:true};
  });
 });
 app.post('/api/v1/control/partner-rewards/:id/void',{preHandler:owner},async request=>{
  const id=z.uuid().parse((request.params as any).id),input=z.object({revision:z.number().int().positive(),reason:z.string().trim().min(5).max(1000)}).strict().parse(request.body);
  return db.transaction(async sql=>{const base=(await sql.query('select referral_id from partner_rewards where id=$1',[id])).rows[0];if(!base)throw new HttpError(404,'Начисление не найдено');await sql.query('select id from partner_referrals where id=$1 for update',[base.referral_id]);const w=(await sql.query('select * from partner_rewards where id=$1 for update',[id])).rows[0];if(w.revision!==input.revision||!['accrued','requested'].includes(w.status))throw new HttpError(409,'Оплаченное начисление нельзя отменить');
   await sql.query("update partner_rewards set status='void',revision=revision+1 where id=$1",[id]);await partnerEvent(sql,w.referral_id,'void','Неоплаченное начисление отменено агентством');await audit(sql,request.member!.id,'partner.void',id,{reason:input.reason});return {ok:true};
  });
 });
}
