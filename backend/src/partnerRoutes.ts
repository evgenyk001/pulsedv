import {randomBytes} from 'node:crypto';
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
 if(!p||p.status!=='active')throw new HttpError(404,'Приглашение недоступно. Свяжитесь с PULSE.DV');
 return p;
}
export async function preparePartnerReferral(sql:Sql,code:string|undefined,buyerUserId:string|null){
 if(!code)return null;
 const partner=await resolveCode(sql,code,true);
 if(buyerUserId&&partner.user_id===buyerUserId)throw new HttpError(400,'Собственная покупка не участвует в программе рекомендаций');
 return partner;
}
export async function attachPartnerReferral(sql:Sql,leadId:string,buyerUserId:string|null,phone:string,code:string,partner:any){
 if(normalizePartnerPhone(partner.phone)===phone)throw new HttpError(400,'Собственная покупка не участвует в программе рекомендаций');
 const row=(await sql.query('insert into partner_referrals(partner_id,invitation_id,lead_id,buyer_user_id,normalized_phone,terms_version,attribution_code) values($1,$2,$3,$4,$5,$6,$7) returning id',[partner.id,partner.invitation_id,leadId,buyerUserId,phone,PARTNER_TERMS_VERSION,code])).rows[0];
 await partnerEvent(sql,row.id,'submitted','Покупатель подтвердил рекомендацию. Проверяем уникальность');return row.id as string;
}
async function conflicts(sql:Sql,r:any){
 const matches=(await sql.query(`select l.id,l.name,l.phone,r2.id as referral_id,r2.partner_id,r2.status,r2.rejection_reason,p.name as partner_name
 from leads l left join partner_referrals r2 on r2.lead_id=l.id left join partner_profiles p on p.id=r2.partner_id
 where l.id<>$1 and (l.normalized_phone=$2 or ($3::uuid is not null and l.user_id=$3))
 and (r2.status='accepted' or (l.created_at<$4 and not (coalesce(r2.status,'')='rejected' and coalesce(r2.rejection_reason,'')='unconfirmed')))
 order by l.created_at,l.id limit 20`,[r.lead_id,r.normalized_phone,r.buyer_user_id,r.created_at])).rows;
 const claimed=(await sql.query('select referral_id from partner_client_claims where referral_id<>$1 and (normalized_phone=$2 or ($3::uuid is not null and buyer_user_id=$3))',[r.id,r.normalized_phone,r.buyer_user_id])).rows;
 return {matches,claimed};
}
function rewardDto(row:any,privateView:boolean):PartnerReward{
 const r=camelRow(row);
 return {id:r.id,referralId:r.referralId,commissionRub:Number(r.commissionRub),receivedOn:String(r.receivedOn).slice(0,10),reserveMinor:Number(r.reserveMinor),baseMinor:Number(r.baseMinor),grossMinor:Number(r.grossMinor),status:r.status,recipientType:r.recipientType,requestedAt:r.requestedAt,paidOn:r.paidOn?String(r.paidOn).slice(0,10):null,withheldMinor:Number(r.withheldMinor),paidMinor:Number(r.paidMinor),revision:r.revision,createdAt:r.createdAt,...(privateView?{payoutReference:r.payoutReference,documentReference:r.documentReference}:{})};
}
async function referralDtos(sql:Sql,rows:any[],privateView:boolean):Promise<PartnerReferral[]>{
 if(!rows.length)return [];
 const ids=rows.map(r=>r.id);
 const events=(await sql.query('select id,referral_id,kind,label,created_at from partner_referral_events where referral_id=any($1::uuid[]) order by sequence',[ids])).rows.map(camelRow);
 const rewards=(await sql.query("select * from partner_rewards where referral_id=any($1::uuid[]) order by (status='void'),created_at desc,id desc",[ids])).rows.map(r=>rewardDto(r,privateView));
 return Promise.all(rows.map(async r=>{
  const clash=privateView?await conflicts(sql,r):null;
  return {id:r.id,partnerId:r.partner_id,partnerName:r.partner_name,leadId:privateView?r.lead_id:null,invitationId:r.invitation_id,clientName:privateView?r.client_name:publicClientName(r.client_name||'Покупатель'),...(privateView?{clientPhone:r.client_phone,reviewNote:r.review_note||'',conflictLeads:clash!.matches.map(m=>({id:m.id,label:m.name+' · '+m.phone})),conflictDetails:clash!.matches.map(m=>m.name+' · '+m.phone+(m.partner_name?' · партнёр '+m.partner_name:' · прямое обращение')).join('\n')+(clash!.claimed.length?'\nЕсть подтверждённое закрепление':'')}:{ }),status:r.status,stage:r.stage,stageLabel:partnerStageLabels[r.stage]||'Обращение',conflict:!!clash&&(clash.matches.length>0||clash.claimed.length>0),rejectionReason:r.rejection_reason,revision:r.revision,createdAt:r.created_at instanceof Date?r.created_at.toISOString():r.created_at,acceptedAt:r.accepted_at instanceof Date?r.accepted_at.toISOString():r.accepted_at,events:events.filter(e=>e.referralId===r.id) as any,reward:rewards.find(w=>w.referralId===r.id)??null};
 }));
}
const referralSelect=`select r.*,p.name as partner_name,l.name as client_name,l.phone as client_phone,l.status as stage from partner_referrals r join partner_profiles p on p.id=r.partner_id left join leads l on l.id=r.lead_id`;
export async function guardPartnerFinance(sql:Sql,leadId:string,finance:any,status:string){
 const row=(await sql.query("select w.* from partner_rewards w join partner_referrals r on r.id=w.referral_id where r.lead_id=$1 and w.status<>'void'",[leadId])).rows[0];
 if(row&&(Number(row.commission_rub)!==finance?.commissionRub||String(row.received_on instanceof Date?row.received_on.toISOString().slice(0,10):row.received_on)!==finance?.receivedOn||!['deal','closed'].includes(status)))throw new HttpError(409,'Вознаграждение уже начислено. Сначала отмените неоплаченное начисление в разделе «Партнёры»');
}
export async function partnerLeadChanged(sql:Sql,leadId:string,previous:any,next:any){
 const r=(await sql.query("select id from partner_referrals where lead_id=$1 and status='accepted'",[leadId])).rows[0];if(!r)return;
 if(previous.status!==next.status)await partnerEvent(sql,r.id,'stage',partnerStageLabels[next.status]||'Статус обращения обновлён');
 if(previous.finance?.receivedOn!==next.finance?.receivedOn&&next.finance?.receivedOn)await partnerEvent(sql,r.id,'commission','Комиссия получена агентством. Вознаграждение ожидает проверки');
}
export async function registerPartnerRoutes(app:FastifyInstance,{db,config,visitor,editor,owner}:{db:Database;config:RuntimeConfig;visitor:(r:FastifyRequest)=>Promise<void>;editor:(r:FastifyRequest)=>Promise<void>;owner:(r:FastifyRequest)=>Promise<void>}){
 const authenticated=async(r:FastifyRequest)=>{await visitor(r);if(!r.visitor!.userId)throw new HttpError(403,'Откройте приложение в Telegram для подключения к программе');};
 const profile=async(sql:Sql,userId:string)=>{const p=(await sql.query('select * from partner_profiles where user_id=$1',[userId])).rows[0];if(!p)throw new HttpError(403,'Подключитесь к партнёрской программе');return p;};
 const pageSchema=z.object({page:z.coerce.number().int().min(1).max(100000).default(1),limit:z.coerce.number().int().min(1).max(100).default(30)}).strict();
 app.get('/api/v1/public/partner-program',async()=>({termsVersion:PARTNER_TERMS_VERSION,rewardBps:PARTNER_REWARD_BPS,reserveBps:PARTNER_RESERVE_BPS,botUsername:config.TELEGRAM_BOT_USERNAME}));
 app.get('/api/v1/public/partner-invites/:code',{config:{rateLimit:{max:40,timeWindow:'1 minute'}}},async request=>{
  const p=await resolveCode(db,codeSchema.parse((request.params as any).code));return {partnerName:p.name,code:(request.params as any).code,termsVersion:PARTNER_TERMS_VERSION};
 });
 app.get('/api/v1/me/partner',{preHandler:visitor},async request=>{
  const q=pageSchema.parse(request.query),userId=request.visitor!.userId;
  const emptySummary={accruedMinor:0,paidMinor:0,pendingCount:0,acceptedCount:0};
  if(!userId)return {authenticated:false,partner:null,referrals:[],invitations:[],page:q.page,total:0,hasMore:false,summary:emptySummary};
  const p=(await db.query('select * from partner_profiles where user_id=$1',[userId])).rows[0];
  if(!p)return {authenticated:true,partner:null,referrals:[],invitations:[],page:q.page,total:0,hasMore:false,summary:emptySummary};
  const rows=(await db.query(referralSelect+' where r.partner_id=$1 order by r.created_at desc,r.id limit $2 offset $3',[p.id,q.limit,(q.page-1)*q.limit])).rows;
  const total=Number((await db.query('select count(*) as n from partner_referrals where partner_id=$1',[p.id])).rows[0].n);
  const sums=(await db.query("select coalesce(sum(w.gross_minor) filter(where w.status in ('accrued','requested')),0) as accrued,coalesce(sum(w.paid_minor) filter(where w.status='paid'),0) as paid from partner_rewards w join partner_referrals r on r.id=w.referral_id where r.partner_id=$1",[p.id])).rows[0];
  const counts=(await db.query("select count(*) filter(where status='pending') as pending,count(*) filter(where status='accepted') as accepted from partner_referrals where partner_id=$1",[p.id])).rows[0];
  return {authenticated:true,partner:camelRow(p),referrals:await referralDtos(db,rows,false),invitations:(await db.query('select * from partner_invitations where partner_id=$1 order by created_at desc limit 30',[p.id])).rows.map(camelRow),page:q.page,total,hasMore:q.page*q.limit<total,summary:{accruedMinor:Number(sums.accrued),paidMinor:Number(sums.paid),pendingCount:Number(counts.pending),acceptedCount:Number(counts.accepted)}};
 });
 app.post('/api/v1/me/partner/join',{preHandler:authenticated,config:{rateLimit:{max:5,timeWindow:'1 minute'}}},async request=>{
  const input=z.object({name:z.string().trim().min(2).max(80),phone:phoneSchema,consent:z.literal(true),termsVersion:z.literal(PARTNER_TERMS_VERSION)}).strict().parse(request.body);
  return db.transaction(async sql=>{await sql.query('select id from app_users where id=$1 for update',[request.visitor!.userId]);
   const existing=(await sql.query('select * from partner_profiles where user_id=$1',[request.visitor!.userId])).rows[0];if(existing)return {partner:camelRow(existing)};
   const p=(await sql.query('insert into partner_profiles(user_id,name,phone,code,terms_version) values($1,$2,$3,$4,$5) returning *',[request.visitor!.userId,input.name,input.phone,token('p'),input.termsVersion])).rows[0];return {partner:camelRow(p)};
  });
 });
 app.post('/api/v1/me/partner/invitations',{preHandler:authenticated,config:{rateLimit:{max:10,timeWindow:'1 minute'}}},async request=>{
  const input=z.object({label:z.string().trim().min(2).max(100),idempotencyKey:z.uuid()}).strict().parse(request.body);
  return db.transaction(async sql=>{const p=await profile(sql,request.visitor!.userId!);if(p.status!=='active')throw new HttpError(403,'Новые приглашения временно недоступны');
   const old=(await sql.query('select * from partner_invitations where id=$1 and partner_id=$2',[input.idempotencyKey,p.id])).rows[0];if(old){if(old.label!==input.label)throw new HttpError(409,'Ключ приглашения уже использован');return {invitation:camelRow(old)};}
   const locked=(await sql.query('select status from partner_profiles where id=$1 for update',[p.id])).rows[0];if(locked.status!=='active')throw new HttpError(403,'Новые приглашения временно недоступны');
   const again=(await sql.query('select * from partner_invitations where id=$1',[input.idempotencyKey])).rows[0];if(again){if(again.partner_id!==p.id||again.label!==input.label)throw new HttpError(409,'Ключ приглашения уже использован');return {invitation:camelRow(again)};}
   const invite=(await sql.query('insert into partner_invitations(id,partner_id,code,label) values($1,$2,$3,$4) returning *',[input.idempotencyKey,p.id,token('i'),input.label])).rows[0];return {invitation:camelRow(invite)};
  });
 });
 app.post('/api/v1/me/partner/rewards/:id/request',{preHandler:authenticated},async request=>{
  const id=z.uuid().parse((request.params as any).id),input=z.object({recipientType:z.enum(['person','ip','company','npd'])}).strict().parse(request.body);
  return db.transaction(async sql=>{const p=await profile(sql,request.visitor!.userId!);const w=(await sql.query('select w.* from partner_rewards w join partner_referrals r on r.id=w.referral_id where w.id=$1 and r.partner_id=$2 for update of w',[id,p.id])).rows[0];if(!w)throw new HttpError(404,'Начисление не найдено');
   if(w.status==='requested')return {ok:true};if(w.status!=='accrued')throw new HttpError(409,'Начисление недоступно для оформления');
   await sql.query("update partner_rewards set status='requested',recipient_type=$2,requested_at=now(),revision=revision+1 where id=$1",[id,input.recipientType]);await partnerEvent(sql,w.referral_id,'payout_requested','Партнёр запросил оформление выплаты');return {ok:true};
  });
 });
 app.get('/api/v1/control/partners',{preHandler:editor},async request=>{
  const q=pageSchema.parse(request.query);const total=Number((await db.query('select count(*) as n from partner_referrals')).rows[0].n);
  const rows=(await db.query(referralSelect+' order by r.created_at desc,r.id limit $1 offset $2',[q.limit,(q.page-1)*q.limit])).rows;
  return {partners:(await db.query('select * from partner_profiles order by created_at desc limit 100')).rows.map(camelRow),referrals:await referralDtos(db,rows,true),page:q.page,total,hasMore:q.page*q.limit<total};
 });
 app.get('/api/v1/control/partner-referrals/:id',{preHandler:editor},async request=>{
  const id=z.uuid().parse((request.params as any).id);const rows=(await db.query(referralSelect+' where r.id=$1',[id])).rows;if(!rows.length)throw new HttpError(404,'Рекомендация не найдена');return {referral:(await referralDtos(db,rows,true))[0]};
 });
 app.get('/api/v1/control/leads/:id/partner',{preHandler:editor},async request=>{
  const id=z.uuid().parse((request.params as any).id);const rows=(await db.query(referralSelect+' where r.lead_id=$1',[id])).rows;return {referral:(await referralDtos(db,rows,true))[0]??null};
 });
 app.patch('/api/v1/control/partners/:id',{preHandler:owner},async request=>{
  const id=z.uuid().parse((request.params as any).id),input=z.object({status:z.enum(['active','paused'])}).strict().parse(request.body);
  return db.transaction(async sql=>{const changed=await sql.query('update partner_profiles set status=$2 where id=$1 returning id',[id,input.status]);if(!changed.rows.length)throw new HttpError(404,'Партнёр не найден');await audit(sql,request.member!.id,'partner.status',id,input);return {ok:true};});
 });
 app.post('/api/v1/control/partner-referrals/:id/review',{preHandler:owner},async request=>{
  const id=z.uuid().parse((request.params as any).id),input=z.object({revision:z.number().int().positive(),decision:z.enum(['accept','reject']),contactConfirmed:z.boolean(),reason:z.enum(['existing','duplicate','self','unconfirmed','other']).optional(),note:z.string().trim().min(2).max(1000)}).strict().parse(request.body);
  return db.transaction(async sql=>{
   const base=(await sql.query('select * from partner_referrals where id=$1',[id])).rows[0];if(!base)throw new HttpError(404,'Рекомендация не найдена');
   await lockBuyerIdentity(sql,base.normalized_phone||'',base.buyer_user_id);
   const lead=(await sql.query('select * from leads where id=$1 for update',[base.lead_id])).rows[0];
   const r=(await sql.query('select * from partner_referrals where id=$1 for update',[id])).rows[0];
   if(r.revision!==input.revision||r.status!=='pending')throw new HttpError(409,'Рекомендация уже рассмотрена или изменилась');
   if(input.decision==='accept'){
    if(!lead||!r.normalized_phone||!lead.consent_at||!input.contactConfirmed)throw new HttpError(400,'Подтвердите контакт с покупателем и его обращение');
    const p=(await sql.query('select * from partner_profiles where id=$1',[r.partner_id])).rows[0];
    if((p.user_id&&p.user_id===r.buyer_user_id)||p.phone===r.normalized_phone)throw new HttpError(409,'Собственная покупка не участвует в программе');
    const clash=await conflicts(sql,r);if(clash.matches.length||clash.claimed.length)throw new HttpError(409,'Найдено совпадение в CRM или более ранняя рекомендация. Разберите совпадение перед закреплением');
    await sql.query('insert into partner_client_claims(referral_id,normalized_phone,buyer_user_id) values($1,$2,$3)',[id,r.normalized_phone,r.buyer_user_id]);
    await sql.query("update partner_referrals set status='accepted',accepted_at=now(),reviewed_by=$2,review_note=$3,revision=revision+1 where id=$1",[id,request.member!.id,input.note]);
    await partnerEvent(sql,id,'accepted','Клиент проверен и закреплён за партнёром');await partnerEvent(sql,id,'stage',partnerStageLabels[lead.status]||'Обращение принято');
   }else{
    if(!input.reason)throw new HttpError(400,'Укажите причину отказа');
    await sql.query("update partner_referrals set status='rejected',rejection_reason=$2,review_note=$3,reviewed_by=$4,revision=revision+1 where id=$1",[id,input.reason,input.note,request.member!.id]);await partnerEvent(sql,id,'rejected',partnerRejectReasons[input.reason]);
   }
   await audit(sql,request.member!.id,'partner.review',id,{decision:input.decision});return {ok:true};
  });
 });
 app.post('/api/v1/control/partner-referrals/:id/accrue',{preHandler:owner},async request=>{
  const id=z.uuid().parse((request.params as any).id);z.object({revision:z.number().int().positive()}).strict().parse(request.body);
  const revision=(request.body as any).revision;
  return db.transaction(async sql=>{
   const base=(await sql.query('select * from partner_referrals where id=$1',[id])).rows[0];if(!base)throw new HttpError(404,'Рекомендация не найдена');
   const lead=(await sql.query('select * from leads where id=$1 for update',[base.lead_id])).rows[0];const r=(await sql.query('select * from partner_referrals where id=$1 for update',[id])).rows[0];
   const old=(await sql.query("select * from partner_rewards where referral_id=$1 and status<>'void'",[id])).rows[0];if(old)return {ok:true,reward:rewardDto(old,true)};
   if(r.revision!==revision||r.status!=='accepted')throw new HttpError(409,'Сначала подтвердите актуальное закрепление');
   if(!lead||!['deal','closed'].includes(lead.status)||!lead.finance?.receivedOn||!lead.finance?.commissionRub||lead.finance.receivedOn>businessDay())throw new HttpError(400,'Нужны завершённая сделка и фактическое поступление комиссии в карточке клиента');
   const amount=partnerReward(lead.finance.commissionRub,r.reserve_bps,r.reward_bps);
   const w=(await sql.query('insert into partner_rewards(referral_id,commission_rub,received_on,reserve_minor,base_minor,gross_minor,approved_by) values($1,$2,$3,$4,$5,$6,$7) returning *',[id,amount.commissionRub,lead.finance.receivedOn,amount.reserveMinor,amount.baseMinor,amount.grossMinor,request.member!.id])).rows[0];
   await partnerEvent(sql,id,'accrued','Вознаграждение начислено после проверки полученной комиссии');await audit(sql,request.member!.id,'partner.accrue',id,{grossMinor:amount.grossMinor});return {ok:true,reward:rewardDto(w,true)};
  });
 });
 app.post('/api/v1/control/partner-rewards/:id/pay',{preHandler:owner},async request=>{
  const id=z.uuid().parse((request.params as any).id),input=z.object({revision:z.number().int().positive(),withheldMinor:z.number().int().nonnegative().max(100_000_000_000),paidOn:z.iso.date(),payoutReference:z.string().trim().min(3).max(300),documentReference:z.string().trim().min(3).max(500),documentsChecked:z.literal(true)}).strict().parse(request.body);
  if(input.paidOn>businessDay())throw new HttpError(400,'Фактическая выплата не может быть в будущем');
  return db.transaction(async sql=>{const w=(await sql.query('select * from partner_rewards where id=$1 for update',[id])).rows[0];if(!w)throw new HttpError(404,'Начисление не найдено');
   if(w.revision!==input.revision||!['accrued','requested'].includes(w.status))throw new HttpError(409,'Выплата уже изменилась или недоступна');
   if(input.withheldMinor>Number(w.gross_minor))throw new HttpError(400,'Удержания больше начисления');
   await sql.query("update partner_rewards set status='paid',withheld_minor=$2,paid_minor=gross_minor-$2,paid_on=$3,payout_reference=$4,document_reference=$5,paid_by=$6,revision=revision+1 where id=$1",[id,input.withheldMinor,input.paidOn,input.payoutReference,input.documentReference,request.member!.id]);
   await partnerEvent(sql,w.referral_id,'paid','Выплата подтверждена агентством');await audit(sql,request.member!.id,'partner.pay',id,{paidMinor:Number(w.gross_minor)-input.withheldMinor,paidOn:input.paidOn});return {ok:true};
  });
 });
 app.post('/api/v1/control/partner-rewards/:id/void',{preHandler:owner},async request=>{
  const id=z.uuid().parse((request.params as any).id),input=z.object({revision:z.number().int().positive(),reason:z.string().trim().min(5).max(1000)}).strict().parse(request.body);
  return db.transaction(async sql=>{const w=(await sql.query('select * from partner_rewards where id=$1 for update',[id])).rows[0];if(!w)throw new HttpError(404,'Начисление не найдено');if(w.revision!==input.revision||!['accrued','requested'].includes(w.status))throw new HttpError(409,'Оплаченное начисление нельзя отменить');
   await sql.query("update partner_rewards set status='void',revision=revision+1 where id=$1",[id]);await partnerEvent(sql,w.referral_id,'void','Неоплаченное начисление отменено агентством');await audit(sql,request.member!.id,'partner.void',id,{reason:input.reason});return {ok:true};
  });
 });
}
