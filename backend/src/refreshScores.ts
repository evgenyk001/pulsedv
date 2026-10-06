import type {Database} from './database';
import {leadRepository} from './repository';
import {scoreLeadEvents} from '../../packages/lead-engine';
// Small batches, no notifications/tasks: expiration must not create a second sales workflow.
export async function refreshStoredScores(db:Database){
 return db.transaction(async sql=>{
  const rows=(await sql.query("select id from sessions where score_refreshed_at is null or score_refreshed_at<now()-interval '6 hours' order by score_refreshed_at nulls first,id limit 50 for update skip locked")).rows;
  const repo=leadRepository(sql);const config=await repo.getScoringConfig();
  for(const row of rows){
   const result=scoreLeadEvents(await repo.listEvents(row.id),config??undefined);
   await repo.upsertProfile(row.id,result);
   const leads=(await sql.query("select id from leads where session_id=$1 and status not in ('closed','lost','deal') order by id for update",[row.id])).rows;
   for(const lead of leads)await repo.updateLeadIntent(lead.id,result);
   await sql.query('update sessions set score_refreshed_at=now() where id=$1',[row.id]);
  }
  return rows.length;
 });
}
