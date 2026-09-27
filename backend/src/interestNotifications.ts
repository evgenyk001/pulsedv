import type { Sql } from './database';
import { camelRow } from './database';
import { buildInterestDNA } from '../../packages/interest-dna';
import type { PulseEvent } from '../../packages/pulse-data/model';
import { readState } from './repository';
/** Run inside the ingest transaction. Reuse the durable outbox; no second queue. */
export async function enqueueInterestChange(sql:Sql,sessionId:string,publicOrigin:string,now=new Date()){
 const lead=(await sql.query("select id,manager_id from leads where session_id=$1 and manager_id is not null and status not in ('closed','lost','deal') order by created_at desc limit 1 for update",[sessionId])).rows[0];
 if(!lead)return false;
 const rows=(await sql.query("select id,session_id,user_id,event_type,entity_type,entity_id,metadata,occurred_at as created_at from user_events where session_id=$1 and occurred_at >= $2 order by occurred_at desc,id limit 2000",[sessionId,new Date(now.getTime()-30*86400000).toISOString()])).rows;
 const {state}=await readState(sql);const dna=buildInterestDNA(rows.map(row=>camelRow(row) as PulseEvent),state,now);
 const change=dna.changes.find(c=>(c.id.startsWith('request:')||c.id.startsWith('return:'))&&Date.parse(c.at)>=now.getTime()-5*60000);
 if(!change)return false;
 const cooling=(await sql.query("select id from outbox_events where topic='manager.interest_changed' and aggregate_id=$1 and created_at>$2 limit 1",[lead.id,new Date(now.getTime()-12*3600000).toISOString()])).rows.length;
 if(cooling)return false;
 const result=await sql.query("insert into outbox_events(topic,aggregate_type,aggregate_id,payload) values('manager.interest_changed','lead',$1,$2::jsonb) on conflict do nothing returning id",[lead.id,JSON.stringify({managerId:lead.manager_id,signalKey:change.id,title:change.title,body:change.detail,deepLink:publicOrigin+'/pulsedv/control-center/#/leads?lead='+lead.id})]);
 return result.rows.length>0;
}
