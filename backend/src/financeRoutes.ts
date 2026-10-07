import {z} from 'zod';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Database} from './database';
export async function registerFinanceRoutes(app:FastifyInstance,db:Database,control:(r:FastifyRequest)=>Promise<void>){
 app.get('/api/v1/control/finance-summary',{preHandler:control},async request=>{
  const q=z.object({from:z.iso.date(),to:z.iso.date()}).strict().refine(v=>v.from<=v.to&&Date.parse(v.to)-Date.parse(v.from)<=366*86400000,'Выберите период не больше года').parse(request.query);
  const member=request.member!;
  const values:unknown[]=[q.from,q.to];if(member.role==='manager')values.push(member.id);
  const row=(await db.query(`with entries as (
   select nullif(finance->>'commissionRub','')::bigint as commission,nullif(finance->>'agentPayoutRub','')::bigint as payout,
    nullif(finance->>'expectedPaymentOn','')::date as expected_on,nullif(finance->>'receivedOn','')::date as received_on,nullif(finance->>'agentPaidOn','')::date as paid_on
   from leads ${member.role==='manager'?'where manager_id=$3':''}
  ) select coalesce(sum(commission) filter(where received_on is null and expected_on between $1::date and $2::date),0) as expected,
   coalesce(sum(commission) filter(where received_on between $1::date and $2::date),0) as received,
   coalesce(sum(payout) filter(where paid_on between $1::date and $2::date),0) as agent_paid,
   count(*) filter(where received_on between $1::date and $2::date)::int as received_deals from entries`,values)).rows[0];
  return {expected:Number(row.expected),received:Number(row.received),agentPaid:Number(row.agent_paid),balance:Number(row.received)-Number(row.agent_paid),receivedDeals:Number(row.received_deals)};
 });
}
