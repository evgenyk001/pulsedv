import {
  DEFAULT_LEAD_ENGINE_CONFIG,
  scoreLeadEvents,
  type LeadEngineConfig,
  type LeadEngineEvent,
  type LeadPriority,
  type LeadScoreResult,
} from "../../packages/lead-engine";

export type StoredEvent=LeadEngineEvent&{
  id:string;
  sessionId:string;
  userId:string|null;
};

export type IngestEvent=Omit<StoredEvent,"id"> & {
  idempotencyKey:string;
};

export type LeadRecord={
  id:string;
  sessionId:string|null;
  managerId:string|null;
  status:"new"|"contacted"|"qualified"|"showing"|"booking"|"deal"|"closed"|"lost";
  score:number;
  priority:LeadPriority;
};

export type ManagerCandidate={
  id:string;
  active:boolean;
  cities:string[];
  openTasks:number;
};

export type ProfileRecord={id:string;sessionId:string;score:number;priority:LeadPriority};

export type TaskRecord={
  id:string;
  leadId:string;
  priority:Exclude<LeadPriority,"cold">;
  status:"today"|"in_progress"|"waiting"|"done";
  dueAt:string;
};

export type LeadEngineRepository={
  insertEvents(events:IngestEvent[]):Promise<{accepted:number;duplicates:number;affectedSessionIds:string[]}>;
  listEvents(sessionId:string):Promise<StoredEvent[]>;
  getScoringConfig():Promise<LeadEngineConfig|null>;
  upsertProfile(sessionId:string,result:LeadScoreResult):Promise<ProfileRecord>;
  findActiveLeadBySession(sessionId:string):Promise<LeadRecord|null>;
  updateLeadIntent(leadId:string,result:LeadScoreResult):Promise<void>;
  appendScoreHistory(profileId:string,leadId:string|null,result:LeadScoreResult):Promise<void>;
  listManagers():Promise<ManagerCandidate[]>;
  assignLead(leadId:string,managerId:string):Promise<void>;
  findOpenTask(leadId:string):Promise<TaskRecord|null>;
  createTask(input:{
    leadId:string;profileId:string;sessionId:string;assignedTo:string|null;
    title:string;reason:string;priority:Exclude<LeadPriority,"cold">;dueAt:string;
  }):Promise<TaskRecord>;
  escalateTask(taskId:string,input:{priority:Exclude<LeadPriority,"cold">;reason:string;dueAt:string}):Promise<void>;
  enqueueOutbox(input:{
    topic:string;aggregateType:string;aggregateId:string|null;payload:Record<string,unknown>;
  }):Promise<void>;
};

const priorityRank:Record<LeadPriority,number>={cold:0,warm:1,hot:2,urgent:3};

function dueAt(priority:Exclude<LeadPriority,"cold">,now:Date){
  const minutes=priority==="urgent"?5:priority==="hot"?15:60;
  return new Date(now.getTime()+minutes*60_000).toISOString();
}

export function chooseManager(candidates:ManagerCandidate[],city:string|null){
  const active=candidates.filter(manager=>manager.active);
  const cityMatched=city?active.filter(manager=>manager.cities.length===0||manager.cities.includes(city)):[];
  const pool=cityMatched.length?cityMatched:active;
  return [...pool].sort((a,b)=>a.openTasks-b.openTasks||a.id.localeCompare(b.id))[0]??null;
}

function managerTopic(priority:LeadPriority){
  if(priority==="urgent")return"manager.urgent_lead";
  if(priority==="hot")return"manager.hot_lead";
  return"manager.new_lead";
}

export async function processSessionIntent(
  repo:LeadEngineRepository,
  sessionId:string,
  now=new Date()
){
  const [events,config]=await Promise.all([repo.listEvents(sessionId),repo.getScoringConfig()]);
  const result=scoreLeadEvents(events,config??DEFAULT_LEAD_ENGINE_CONFIG);
  const profile=await repo.upsertProfile(sessionId,result);
  const lead=await repo.findActiveLeadBySession(sessionId);

  await repo.appendScoreHistory(profile.id,lead?.id??null,result);

  if(!lead)return{profile,result,lead:null,task:null};

  await repo.updateLeadIntent(lead.id,result);

  let managerId=lead.managerId;
  if(!managerId){
    const manager=chooseManager(await repo.listManagers(),result.city);
    if(manager){
      managerId=manager.id;
      await repo.assignLead(lead.id,manager.id);
    }
  }

  if(result.priority==="cold")return{profile,result,lead:{...lead,managerId},task:null};

  const priority=result.priority as Exclude<LeadPriority,"cold">;
  const existingTask=await repo.findOpenTask(lead.id);
  let task=existingTask;

  if(!existingTask){
    task=await repo.createTask({
      leadId:lead.id,
      profileId:profile.id,
      sessionId,
      assignedTo:managerId,
      title:priority==="urgent"?"Связаться с горячим лидом":"Связаться с лидом",
      reason:result.recommendedAction,
      priority,
      dueAt:dueAt(priority,now),
    });
  }else if(priorityRank[priority]>priorityRank[existingTask.priority]){
    const candidateDue=dueAt(priority,now);
    const nextDue=Date.parse(candidateDue)<Date.parse(existingTask.dueAt)?candidateDue:existingTask.dueAt;
    await repo.escalateTask(existingTask.id,{priority,reason:result.recommendedAction,dueAt:nextDue});
  }

  const previousPriority=lead.priority;
  const crossedHotBoundary=priorityRank[result.priority]>=priorityRank.hot&&priorityRank[previousPriority]<priorityRank.hot;
  const becameUrgent=result.priority==="urgent"&&previousPriority!=="urgent";
  const isNewLead=lead.status==="new"&&lead.score===0;

  if(managerId&&(crossedHotBoundary||becameUrgent||isNewLead)){
    await repo.enqueueOutbox({
      topic:managerTopic(result.priority),
      aggregateType:"lead",
      aggregateId:lead.id,
      payload:{
        leadId:lead.id,
        managerId,
        score:result.score,
        priority:result.priority,
        city:result.city,
        topPropertyId:result.topPropertyId,
        nextAction:result.recommendedAction,
        taskId:task?.id??null,
      },
    });
  }

  return{profile,result,lead:{...lead,managerId},task};
}

export async function ingestEventBatch(repo:LeadEngineRepository,events:IngestEvent[]){
  if(events.length===0)return{accepted:0,duplicates:0,profiles:[]};
  if(events.length>100)throw new Error("event batch too large");

  const inserted=await repo.insertEvents(events);
  const profiles=[];
  for(const sessionId of inserted.affectedSessionIds){
    profiles.push(await processSessionIntent(repo,sessionId));
  }
  return{accepted:inserted.accepted,duplicates:inserted.duplicates,profiles};
}
