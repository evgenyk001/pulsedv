import {z} from 'zod';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Database} from './database';
import type {LossSummary} from '../../packages/pulse-data/loss';
export async function registerLossRoutes(app:FastifyInstance,db:Database,control:(r:FastifyRequest)=>Promise<void>){
 app.get('/api/v1/control/loss-summary',{preHandler:control},async request=>{
  const q=z.object({from:z.iso.date(),to:z.iso.date()}).strict().refine(v=>v.from<=v.to&&Date.parse(v.to)-Date.parse(v.from)<=366*86400000,'Выберите период не больше года').parse(request.query);
  const scoped=request.member!.role==='manager';
  const rows=(await db.query(`select coalesce(loss_reason,'unspecified') as reason,lost_at is null as undated,count(*)::int as count from leads where status='lost' ${scoped?'and manager_id=$3':''} and (lost_at is null or (lost_at>=($1::date::timestamp at time zone 'Asia/Vladivostok') and lost_at<(($2::date+1)::timestamp at time zone 'Asia/Vladivostok'))) group by 1,2`,scoped?[q.from,q.to,request.member!.id]:[q.from,q.to])).rows;
  const total=rows.filter(r=>!r.undated).reduce((n,r)=>n+Number(r.count),0);
  return {total,undated:rows.filter(r=>r.undated).reduce((n,r)=>n+Number(r.count),0),items:rows.filter(r=>!r.undated).map(r=>({reason:r.reason,count:Number(r.count),percent:total?Math.round(Number(r.count)/total*100):0})).sort((a,b)=>b.count-a.count||a.reason.localeCompare(b.reason))} satisfies LossSummary;
 });
}
