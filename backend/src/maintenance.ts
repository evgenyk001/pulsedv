import {rm,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import type {Database} from './database';
import type {RuntimeConfig} from './config';

type LegacyAttachment={url?:unknown};

const cutoff=(days:number)=>new Date(Date.now()-days*86400_000).toISOString();

export async function runSecurityMaintenance(db:Database,config:RuntimeConfig){
 const clientCutoff=cutoff(config.CLIENT_DATA_RETENTION_DAYS);
 const analyticsCutoff=cutoff(config.ANALYTICS_RETENTION_DAYS);
 const auditCutoff=cutoff(config.AUDIT_RETENTION_DAYS);
 const outboxCutoff=cutoff(config.OUTBOX_RETENTION_DAYS);
 const media:{leadId:string;legacy:string[]}[]=[];

 const result=await db.transaction(async sql=>{
  await sql.query('delete from auth_tokens where expires_at<=now()');
  await sql.query('delete from control_login_challenges where expires_at<now()-interval \'1 day\' or consumed_at is not null and consumed_at<now()-interval \'1 day\'');
  await sql.query("delete from outbox_events where topic='manager.security_code' and created_at<now()-interval '10 minutes'");

  const old=(await sql.query("select l.id,j.document from leads l left join client_journeys j on j.lead_id=l.id where l.status in ('closed','lost') and l.updated_at<$1 and l.phone<>'Удалено' order by l.updated_at limit 500",[clientCutoff])).rows;
  const leadIds=old.map(row=>String(row.id));
  for(const row of old){
   const messages=Array.isArray(row.document?.messages)?row.document.messages:[];
   const legacy=messages.map((m:any)=>(m?.attachment as LegacyAttachment|undefined)?.url).filter((url:unknown):url is string=>typeof url==='string'&&/^\/media\/chat\/[A-Za-z0-9._-]+$/.test(url));
   media.push({leadId:String(row.id),legacy});
  }
  if(leadIds.length){
   await sql.query('delete from client_journeys where lead_id=any($1::uuid[])',[leadIds]);
   await sql.query('delete from crm_tasks where lead_id=any($1::uuid[])',[leadIds]);
   await sql.query('delete from lead_score_history where lead_id=any($1::uuid[])',[leadIds]);
   await sql.query("update leads set user_id=null,session_id=null,idempotency_key=null,name='Удалено',phone='Удалено',comment=null,request_context='{}'::jsonb,manager_id=null,score=0,priority='cold',score_reasons='[]'::jsonb,top_property_id=null,city=null,mortgage_program=null,next_action=null where id=any($1::uuid[])",[leadIds]);
  }

  const sessionRows=(await sql.query("select s.id from sessions s where s.last_seen_at<$1 and not exists(select 1 from leads l where l.session_id=s.id) limit 2000",[clientCutoff])).rows;
  const sessionIds=sessionRows.map(row=>String(row.id));
  if(sessionIds.length){
   await sql.query("delete from favorite_sets where owner=any($1::text[])",[sessionIds.map(id=>'session:'+id)]);
   await sql.query('delete from sessions where id=any($1::uuid[])',[sessionIds]);
  }

  const userRows=(await sql.query("select u.id from app_users u where u.last_seen_at<$1 and not exists(select 1 from leads l where l.user_id=u.id) and not exists(select 1 from sessions s where s.user_id=u.id) limit 2000",[clientCutoff])).rows;
  const userIds=userRows.map(row=>String(row.id));
  if(userIds.length){
   await sql.query("delete from favorite_sets where owner=any($1::text[])",[userIds.map(id=>'user:'+id)]);
   await sql.query('delete from app_users where id=any($1::uuid[])',[userIds]);
  }

  const events=await sql.query('delete from user_events where occurred_at<$1',[analyticsCutoff]);
  const scores=await sql.query('delete from lead_score_history where created_at<$1',[analyticsCutoff]);
  const audits=await sql.query('delete from audit_log where created_at<$1',[auditCutoff]);
  const outbox=await sql.query("delete from outbox_events where created_at<$1 and (processed_at is not null or dead_at is not null)",[outboxCutoff]);

  return{
   anonymizedLeads:leadIds.length,
   deletedSessions:sessionIds.length,
   deletedUsers:userIds.length,
   deletedEvents:events.rowCount??0,
   deletedScoreHistory:scores.rowCount??0,
   deletedAudit:audits.rowCount??0,
   deletedOutbox:outbox.rowCount??0,
  };
 });

 for(const item of media){
  await rm(join(config.MEDIA_ROOT,'private','chat',item.leadId),{recursive:true,force:true}).catch(()=>{});
  for(const url of item.legacy){
   const file=url.slice('/media/chat/'.length);
   await unlink(join(config.MEDIA_ROOT,'chat',file)).catch(()=>{});
  }
 }
 return result;
}
