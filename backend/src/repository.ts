import type { Sql } from './database';
import { camelRow } from './database';
import type { LeadEngineRepository } from './leadEngineService';
import type { PulseState } from '../../packages/pulse-data/model';
export async function readState(sql:Sql):Promise<{state:PulseState;version:number}>{const row=(await sql.query('select document,version from app_config where singleton=true')).rows[0];if(!row)throw new Error('Run migrations before starting API');return {state:row.document,version:row.version};}
export function leadRepository(sql:Sql):LeadEngineRepository {
 return {
  async insertEvents(events){let accepted=0;const affected=new Set<string>();for(const e of events){const result=await sql.query('insert into user_events(idempotency_key,session_id,user_id,event_type,entity_type,entity_id,metadata,occurred_at) values($1,$2,$3,$4,$5,$6,$7::jsonb,$8) on conflict(idempotency_key) do nothing returning id',[e.idempotencyKey,e.sessionId,e.userId,e.eventType,e.entityType,e.entityId,JSON.stringify(e.metadata),e.createdAt]);if(result.rows.length){accepted++;affected.add(e.sessionId);}}return {accepted,duplicates:events.length-accepted,affectedSessionIds:[...affected]};},
  async listEvents(sessionId){return (await sql.query("select id,session_id,user_id,event_type,entity_type,entity_id,metadata,occurred_at as created_at from user_events where session_id=$1 and occurred_at>now()-interval '30 days' order by occurred_at desc limit 2000",[sessionId])).rows.map(r=>camelRow(r) as any);},
  async getScoringConfig(){return (await readState(sql)).state.leadEngine;},
  async upsertProfile(sessionId,r){const result=await sql.query(`insert into visitor_profiles(session_id,user_id,score,priority,score_reasons,top_property_id,city,mortgage_program,next_action,event_count,last_seen_at)
   select id,user_id,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,coalesce($10::timestamptz,now()) from sessions where id=$1
   on conflict(session_id) do update set user_id=excluded.user_id,score=excluded.score,priority=excluded.priority,score_reasons=excluded.score_reasons,top_property_id=excluded.top_property_id,city=excluded.city,mortgage_program=excluded.mortgage_program,next_action=excluded.next_action,event_count=excluded.event_count,last_seen_at=excluded.last_seen_at returning *`,[sessionId,r.score,r.priority,JSON.stringify(r.reasons),r.topPropertyId,r.city,r.mortgageProgram,r.recommendedAction,r.eventCount,r.lastIntentAt]);return camelRow(result.rows[0]) as any;},
  async findActiveLeadBySession(id){const row=(await sql.query("select * from leads where session_id=$1 and status not in ('closed','lost','deal') order by created_at desc limit 1",[id])).rows[0];return row?camelRow(row) as any:null;},
  async updateLeadIntent(id,r){await sql.query('update leads set score=$2,priority=$3,score_reasons=$4::jsonb,top_property_id=$5,city=$6,mortgage_program=$7,next_action=$8 where id=$1',[id,r.score,r.priority,JSON.stringify(r.reasons),r.topPropertyId,r.city,r.mortgageProgram,r.recommendedAction]);},
  async appendScoreHistory(profileId,leadId,r){await sql.query('insert into lead_score_history(profile_id,lead_id,score,priority,reasons) values($1,$2,$3,$4,$5::jsonb)',[profileId,leadId,r.score,r.priority,JSON.stringify(r.reasons)]);},
  async listManagers(){return (await sql.query("select m.id,m.active,m.cities,(select count(*)::int from crm_tasks t where t.assigned_to=m.id and t.status<>'done') as open_tasks from team_members m where m.active=true order by m.id for update")).rows.map(r=>camelRow(r) as any);},
  async assignLead(id,managerId){await sql.query('update leads set manager_id=$2 where id=$1',[id,managerId]);},
  async findOpenTask(id){const row=(await sql.query("select * from crm_tasks where lead_id=$1 and status<>'done' limit 1 for update",[id])).rows[0];return row?camelRow(row) as any:null;},
  async createTask(t){const row=(await sql.query('insert into crm_tasks(lead_id,profile_id,session_id,assigned_to,title,reason,priority,due_at) values($1,$2,$3,$4,$5,$6,$7,$8) returning *',[t.leadId,t.profileId,t.sessionId,t.assignedTo,t.title,t.reason,t.priority,t.dueAt])).rows[0];return camelRow(row) as any;},
  async escalateTask(id,t){await sql.query('update crm_tasks set priority=$2,reason=$3,due_at=least(due_at,$4::timestamptz) where id=$1',[id,t.priority,t.reason,t.dueAt]);},
  async enqueueOutbox(e){await sql.query('insert into outbox_events(topic,aggregate_type,aggregate_id,payload) values($1,$2,$3,$4::jsonb)',[e.topic,e.aggregateType,e.aggregateId,JSON.stringify(e.payload)]);}
 };
}
export async function audit(sql:Sql,memberId:string,action:string,entityId:string|null,details:Record<string,unknown>={}){await sql.query('insert into audit_log(member_id,action,entity_id,details) values($1,$2,$3,$4::jsonb)',[memberId,action,entityId,JSON.stringify(details)]);}
