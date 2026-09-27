import { z } from 'zod';
import type { FastifyInstance,FastifyRequest } from 'fastify';
import type { Database } from './database';
import { camelRow } from './database';
import { readState } from './repository';
import { listCatalog } from './catalogRepository';
import { buildInterestDNA } from '../../packages/interest-dna';
import type { PulseEvent } from '../../packages/pulse-data/model';
export async function registerInterestRoutes(app:FastifyInstance,db:Database,control:(r:FastifyRequest)=>Promise<void>){
 app.get('/api/v1/control/interest/:sessionId',{preHandler:control},async(request,reply)=>{
  const sessionId=z.uuid().parse((request.params as any).sessionId);const member=request.member!;
  const scoped=member.role==='manager';
  // Check the requested session before resolving any identity or history.
  const session=(await db.query(`select id,user_id from sessions where id=$1 ${scoped?'and exists(select 1 from leads where session_id=sessions.id and manager_id=$2)':''}`,[sessionId,...(scoped?[member.id]:[])])).rows[0];
  if(!session)return reply.code(404).send({error:'Профиль недоступен'});
  const values:unknown[]=[session.id,session.user_id];
  if(scoped)values.push(member.id);
  const rows=(await db.query(`select e.id,e.session_id,e.user_id,e.event_type,e.entity_type,e.entity_id,e.metadata,e.occurred_at as created_at
   from user_events e where (e.session_id=$1 or ($2::uuid is not null and e.user_id=$2))
   and e.occurred_at>=now()-interval '30 days' and e.occurred_at<=now()
   ${scoped?'and exists(select 1 from leads l where l.session_id=e.session_id and l.manager_id=$3)':''}
   order by e.occurred_at desc,e.id limit 5001`,values)).rows;
  const events=rows.slice(0,5000).map(row=>camelRow(row) as PulseEvent);
  const [{state},catalog]=await Promise.all([readState(db),listCatalog(db,{status:'all',limit:2000,view:'match'})]);
  const dna=buildInterestDNA(events,{...state,properties:catalog.items});
  return {dna,events,linked:!!session.user_id,limited:rows.length>5000,catalogLimited:catalog.hasMore,scope:scoped?'assigned':'identity'};
 });
}
