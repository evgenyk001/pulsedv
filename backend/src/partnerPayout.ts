import {z} from 'zod';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Database,Sql} from './database';
import type {RuntimeConfig} from './config';
import {HttpError} from './security';
import {audit} from './repository';
import {cleanPayout,payoutError,emptyPayout} from '../../packages/partners/payout';

export const payoutSchema=z.object({method:z.enum(['contact','sbp','bank','cash']),recipientName:z.string().trim().max(200),contactPhone:z.string().max(30),sbpPhone:z.string().max(30).default(''),bankName:z.string().trim().max(200).default(''),account:z.string().max(20).default(''),bic:z.string().max(9).default(''),inn:z.string().max(12).default(''),officeAddress:z.string().trim().max(500).default(''),meetingAt:z.union([z.iso.datetime(),z.literal('')]).default(''),note:z.string().trim().max(1000).default('')}).strict().transform(cleanPayout);
export async function payoutNotice(sql:Sql,config:RuntimeConfig,referralId:string,title:string,owner=false){
 const p=(await sql.query('select p.user_id,p.name from partner_referrals r join partner_profiles p on p.id=r.partner_id where r.id=$1',[referralId])).rows[0];
 if(!p||(!owner&&!p.user_id))return;
 const body=owner?'Партнёр '+p.name+'. Откройте рекомендацию, чтобы согласовать получение.':'Откройте рекомендацию в кабинете партнёра: там способ получения, договорённости и текущий статус.';
 const payload={...(owner?{}:{userId:p.user_id}),title,body,deepLink:config.PUBLIC_ORIGIN+(owner?'/pulsedv/control-center/#/partners?referral=':'/pulsedv/mini-app/#/partners?referral=')+referralId};
 await sql.query('insert into outbox_events(topic,aggregate_type,aggregate_id,payload) values($1,$2,$3,$4::jsonb)',[owner?'manager.journey':'user.partner','partner_referral',referralId,JSON.stringify(payload)]);
}
export function registerPartnerPayoutRoutes(app:FastifyInstance,db:Database,config:RuntimeConfig,owner:(r:FastifyRequest)=>Promise<void>){
 app.post('/api/v1/control/partner-rewards/:id/payout-plan',{preHandler:owner},async r=>{
  const id=z.uuid().parse((r.params as any).id),input=z.object({revision:z.number().int().positive(),decision:z.enum(['request_details','agree','reopen']),payout:payoutSchema.optional(),recipientType:z.enum(['person','ip','company','npd']).optional(),contactConfirmed:z.boolean().optional(),note:z.string().trim().max(1000).default('')}).strict().parse(r.body);
  return db.transaction(async sql=>{
   const base=(await sql.query('select referral_id from partner_rewards where id=$1',[id])).rows[0];if(!base)throw new HttpError(404,'Начисление не найдено');
   await sql.query('select id from partner_referrals where id=$1 for update',[base.referral_id]);
   const w=(await sql.query('select * from partner_rewards where id=$1 for update',[id])).rows[0];
   if(!['accrued','requested'].includes(w.status)||w.revision!==input.revision)throw new HttpError(409,'Начисление изменилось. Обновите карточку');
   if(w.payout_stage==='agreed'&&input.decision!=='reopen')throw new HttpError(409,'Получение уже согласовано. Сначала откройте повторное согласование');
   const p=(await sql.query('select p.name,p.phone from partner_referrals r join partner_profiles p on p.id=r.partner_id where r.id=$1',[w.referral_id])).rows[0];
   const details=input.payout||{...emptyPayout(p.name,p.phone),...(w.payout_details||{}),note:input.note};
   if(input.decision==='agree'){
    const error=payoutError(details,true);if(error)throw new HttpError(400,error);
    if(!input.contactConfirmed)throw new HttpError(400,'Подтвердите согласование с партнёром');
    if(!input.recipientType&&!w.recipient_type)throw new HttpError(400,'Укажите статус получателя');
    if(details.method==='cash'&&Date.parse(details.meetingAt)<=Date.now())throw new HttpError(400,'Выберите будущее время приезда в офис');
   }
   const agreed=input.decision==='agree',stage=agreed?'agreed':'details_needed';
   await sql.query('update partner_rewards set payout_details=$2::jsonb,payout_stage=$3,recipient_type=coalesce($4,recipient_type),payout_agreed_by=$5,payout_agreed_at=case when $6 then now() else null end,revision=revision+1 where id=$1',[id,JSON.stringify(details),stage,input.recipientType??null,agreed?r.member!.id:null,agreed]);
   const label=agreed?'Получение вознаграждения согласовано':input.decision==='reopen'?'Открыто повторное согласование получения':'Команда просит согласовать получение вознаграждения';
   await sql.query('insert into partner_referral_events(referral_id,kind,label) values($1,$2,$3)',[w.referral_id,agreed?'payout_agreed':input.decision==='reopen'?'payout_reopened':'payout_details',label]);
   await audit(sql,r.member!.id,'partner.payout.plan',id,{decision:input.decision,method:details.method});
   await payoutNotice(sql,config,w.referral_id,label);return {ok:true};
  });
 });
}
