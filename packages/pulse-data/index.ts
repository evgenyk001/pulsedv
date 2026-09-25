import { runtime, stageState, updateRemote, enqueueEvent } from "./runtime";
import { DEFAULT_LEAD_ENGINE_CONFIG, scoreLeadEvents, type LeadPriority } from "../lead-engine";
import { DEFAULT_STATE, DEFAULT_PROPERTIES, DEFAULT_BANNERS, DEFAULT_MORTGAGE_PROGRAMS, type PropertyStatus, type PulseProperty, type PulseBanner, type MortgageProgramRule, type PulseSelectConfig, type PulseContentConfig, type PulseState, type PulseLead, type PulseVisitorProfile, type PulseTask, type PulseEvent } from "./model";
export * from "./model";
const STATE_KEY="pulse.dv.control.state.v1";
const LEADS_KEY="pulse.dv.control.leads.v1";
const EVENTS_KEY="pulse.dv.control.events.v1";
const SESSION_KEY="pulse.dv.session.v1";
const PROFILES_KEY="pulse.dv.control.profiles.v1";
const TASKS_KEY="pulse.dv.control.tasks.v1";
export const PULSE_STATE_EVENT="pulse:control-state";
export const PULSE_LEADS_EVENT="pulse:control-leads";
export const PULSE_EVENTS_EVENT="pulse:control-events";
export const PULSE_PROFILES_EVENT="pulse:control-profiles";
export const PULSE_TASKS_EVENT="pulse:control-tasks";

const now=()=>new Date().toISOString();
const id=()=>typeof crypto!=="undefined"&&"randomUUID" in crypto?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36);
const canStore=()=>typeof window!=="undefined"&&!!window.localStorage;

function mergeState(input:Partial<PulseState>|null|undefined):PulseState{
  return {
    ...DEFAULT_STATE,
    ...(input||{}),
    properties:Array.isArray(input?.properties)?input!.properties:DEFAULT_STATE.properties,
    banners:Array.isArray(input?.banners)?input!.banners:DEFAULT_STATE.banners,
    mortgagePrograms:Array.isArray(input?.mortgagePrograms)?input!.mortgagePrograms:DEFAULT_STATE.mortgagePrograms,
    select:{...DEFAULT_STATE.select,...(input?.select||{}),weights:{...DEFAULT_STATE.select.weights,...(input?.select?.weights||{})}},
    content:{...DEFAULT_STATE.content,...(input?.content||{})},
    leadEngine:{
      ...DEFAULT_STATE.leadEngine,
      ...(input?.leadEngine||{}),
      thresholds:{...DEFAULT_STATE.leadEngine.thresholds,...(input?.leadEngine?.thresholds||{})},
      rules:Array.isArray(input?.leadEngine?.rules)?input!.leadEngine.rules:DEFAULT_STATE.leadEngine.rules,
    },
    updatedAt:input?.updatedAt||DEFAULT_STATE.updatedAt
  };
}

export function getPulseState():PulseState{
  if(runtime.enabled)return runtime.snapshot.state;
  if(!canStore())return DEFAULT_STATE;
  try{return mergeState(JSON.parse(localStorage.getItem(STATE_KEY)||"null"))}
  catch{return DEFAULT_STATE}
}

export function setPulseState(next:PulseState){
  if(runtime.enabled){stageState(next);return;}
  if(!canStore())return;
  const value={...next,updatedAt:now()};
  localStorage.setItem(STATE_KEY,JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(PULSE_STATE_EVENT));
}

export function updatePulseState(updater:(state:PulseState)=>PulseState){
  const current=getPulseState();
  setPulseState(updater(current));
}

export function subscribePulseState(listener:()=>void){
  if(typeof window==="undefined")return()=>{};
  const local=()=>listener();
  const storage=(event:StorageEvent)=>{if(event.key===STATE_KEY)listener()};
  window.addEventListener(PULSE_STATE_EVENT,local);
  window.addEventListener("storage",storage);
  return()=>{window.removeEventListener(PULSE_STATE_EVENT,local);window.removeEventListener("storage",storage)};
}

export function listPulseLeads():PulseLead[]{
  if(runtime.enabled)return runtime.snapshot.leads;
  if(!canStore())return[];
  try{const value=JSON.parse(localStorage.getItem(LEADS_KEY)||"[]");return Array.isArray(value)?value:[]}
  catch{return[]}
}
export function addPulseLead(payload:Omit<PulseLead,"id"|"status"|"manager"|"createdAt"|"updatedAt"|"sessionId"|"userId"|"score"|"priority"|"scoreReasons"|"topPropertyId"|"city"|"mortgageProgram"|"nextAction">){
  if(runtime.enabled)throw new Error("Use the asynchronous lead API");
  const created=now();
  const currentSession=sessionId();
  const lead:PulseLead={
    ...payload,id:id(),status:"new",manager:null,createdAt:created,updatedAt:created,
    sessionId:currentSession,userId:null,score:0,priority:"cold",scoreReasons:[],
    topPropertyId:payload.propertyId,city:null,mortgageProgram:null,nextAction:null
  };
  const leads=[lead,...listPulseLeads()];
  localStorage.setItem(LEADS_KEY,JSON.stringify(leads));
  window.dispatchEvent(new CustomEvent(PULSE_LEADS_EVENT));
  recordPulseEvent({eventType:"lead_created",entityType:"lead",entityId:lead.id,metadata:{source:lead.source,propertyId:lead.propertyId}});
  return lead;
}
export function updatePulseLead(idValue:string,patch:Partial<Pick<PulseLead,"status"|"manager"|"comment"|"nextAction">>){
  if(runtime.enabled){void updateRemote("leads",idValue,patch).catch(()=>{});return;}
  if(!canStore())return;
  const leads=listPulseLeads().map(lead=>lead.id===idValue?{...lead,...patch,updatedAt:now()}:lead);
  localStorage.setItem(LEADS_KEY,JSON.stringify(leads));
  window.dispatchEvent(new CustomEvent(PULSE_LEADS_EVENT));
}
export function subscribePulseLeads(listener:()=>void){
  if(typeof window==="undefined")return()=>{};
  const local=()=>listener();
  const storage=(event:StorageEvent)=>{if(event.key===LEADS_KEY)listener()};
  window.addEventListener(PULSE_LEADS_EVENT,local);window.addEventListener("storage",storage);
  return()=>{window.removeEventListener(PULSE_LEADS_EVENT,local);window.removeEventListener("storage",storage)};
}


export function listPulseProfiles():PulseVisitorProfile[]{
  if(runtime.enabled)return runtime.snapshot.profiles;
  if(!canStore())return[];
  try{const value=JSON.parse(localStorage.getItem(PROFILES_KEY)||"[]");return Array.isArray(value)?value:[]}
  catch{return[]}
}
export function subscribePulseProfiles(listener:()=>void){
  if(typeof window==="undefined")return()=>{};
  const local=()=>listener();
  const storage=(event:StorageEvent)=>{if(event.key===PROFILES_KEY)listener()};
  window.addEventListener(PULSE_PROFILES_EVENT,local);window.addEventListener("storage",storage);
  return()=>{window.removeEventListener(PULSE_PROFILES_EVENT,local);window.removeEventListener("storage",storage)};
}

export function listPulseTasks():PulseTask[]{
  if(runtime.enabled)return runtime.snapshot.tasks;
  if(!canStore())return[];
  try{const value=JSON.parse(localStorage.getItem(TASKS_KEY)||"[]");return Array.isArray(value)?value:[]}
  catch{return[]}
}
export function updatePulseTask(idValue:string,patch:Partial<Pick<PulseTask,"status"|"title"|"reason"|"dueAt">>){
  if(runtime.enabled){void updateRemote("tasks",idValue,patch).catch(()=>{});return;}
  if(!canStore())return;
  const tasks=listPulseTasks().map(task=>task.id===idValue?{...task,...patch,updatedAt:now()}:task);
  localStorage.setItem(TASKS_KEY,JSON.stringify(tasks));
  window.dispatchEvent(new CustomEvent(PULSE_TASKS_EVENT));
}
export function subscribePulseTasks(listener:()=>void){
  if(typeof window==="undefined")return()=>{};
  const local=()=>listener();
  const storage=(event:StorageEvent)=>{if(event.key===TASKS_KEY)listener()};
  window.addEventListener(PULSE_TASKS_EVENT,local);window.addEventListener("storage",storage);
  return()=>{window.removeEventListener(PULSE_TASKS_EVENT,local);window.removeEventListener("storage",storage)};
}

function dueAtFor(priority:Exclude<LeadPriority,"cold">){
  const minutes=priority==="urgent"?5:priority==="hot"?15:60;
  return new Date(Date.now()+minutes*60_000).toISOString();
}

function syncSessionSignals(session:string,events:PulseEvent[]){
  if(!canStore())return;
  const sessionEvents=events.filter(event=>event.sessionId===session);
  if(!sessionEvents.length)return;
  const state=getPulseState();
  const result=scoreLeadEvents(sessionEvents,state.leadEngine);
  const previous=listPulseProfiles().find(profile=>profile.sessionId===session);
  const profile:PulseVisitorProfile={
    id:previous?.id||id(),
    sessionId:session,
    userId:sessionEvents.find(event=>event.userId)?.userId??previous?.userId??null,
    score:result.score,
    priority:result.priority,
    scoreReasons:result.reasons,
    topPropertyId:result.topPropertyId,
    city:result.city,
    mortgageProgram:result.mortgageProgram,
    nextAction:result.recommendedAction,
    eventCount:result.eventCount,
    firstSeenAt:previous?.firstSeenAt||sessionEvents[sessionEvents.length-1]?.createdAt||now(),
    lastSeenAt:result.lastIntentAt||now(),
    updatedAt:now(),
  };
  const profiles=[profile,...listPulseProfiles().filter(item=>item.sessionId!==session)]
    .sort((a,b)=>b.score-a.score)
    .slice(0,1000);
  localStorage.setItem(PROFILES_KEY,JSON.stringify(profiles));
  window.dispatchEvent(new CustomEvent(PULSE_PROFILES_EVENT));

  const leads=listPulseLeads();
  const linked=leads.filter(lead=>lead.sessionId===session&&lead.status!=="closed"&&lead.status!=="lost");
  if(linked.length){
    const nextLeads=leads.map(lead=>lead.sessionId===session?{
      ...lead,
      score:profile.score,
      priority:profile.priority,
      scoreReasons:profile.scoreReasons,
      topPropertyId:profile.topPropertyId??lead.propertyId??null,
      city:profile.city,
      mortgageProgram:profile.mortgageProgram,
      nextAction:profile.nextAction,
      updatedAt:now(),
    }:lead);
    localStorage.setItem(LEADS_KEY,JSON.stringify(nextLeads));
    window.dispatchEvent(new CustomEvent(PULSE_LEADS_EVENT));
  }

  if(linked.length&&profile.priority!=="cold"){
    const lead=linked[0];
    const tasks=listPulseTasks();
    const existing=tasks.find(task=>task.leadId===lead.id&&task.status!=="done");
    const priority=profile.priority as Exclude<LeadPriority,"cold">;
    const rank:Record<Exclude<LeadPriority,"cold">,number>={warm:1,hot:2,urgent:3};
    const escalated=existing&&rank[priority]>rank[existing.priority];
    const escalatedDue=dueAtFor(priority);
    const stableDue=existing
      ?(escalated&&Date.parse(escalatedDue)<Date.parse(existing.dueAt)?escalatedDue:existing.dueAt)
      :escalatedDue;
    const nextTask:PulseTask=existing?{
      ...existing,
      title:priority==="urgent"?"Связаться с горячим лидом":"Связаться с лидом",
      reason:profile.nextAction,
      priority,
      dueAt:stableDue,
      updatedAt:now(),
    }:{
      id:id(),
      leadId:lead.id,
      profileId:profile.id,
      sessionId:session,
      title:priority==="urgent"?"Связаться с горячим лидом":"Связаться с лидом",
      reason:profile.nextAction,
      priority,
      status:"today",
      dueAt:dueAtFor(priority),
      createdAt:now(),
      updatedAt:now(),
    };
    const nextTasks=[nextTask,...tasks.filter(task=>task.id!==nextTask.id)];
    localStorage.setItem(TASKS_KEY,JSON.stringify(nextTasks));
    window.dispatchEvent(new CustomEvent(PULSE_TASKS_EVENT));
  }
}

export function recalculatePulseLeadEngine(){
  if(runtime.enabled)return;
  if(!canStore())return;
  const events=listPulseEvents();
  const sessions=Array.from(new Set(events.map(event=>event.sessionId)));
  sessions.forEach(session=>syncSessionSignals(session,events));
}

function sessionId(){
  if(typeof window==="undefined")return"server";
  let value=sessionStorage.getItem(SESSION_KEY);
  if(!value){value=id();sessionStorage.setItem(SESSION_KEY,value)}
  return value;
}
export function listPulseEvents():PulseEvent[]{
  if(runtime.enabled)return runtime.snapshot.events;
  if(!canStore())return[];
  try{const value=JSON.parse(localStorage.getItem(EVENTS_KEY)||"[]");return Array.isArray(value)?value:[]}
  catch{return[]}
}
export function recordPulseEvent(input:{eventType:string;entityType?:string|null;entityId?:string|null;metadata?:Record<string,unknown>;userId?:string|null}){
  if(runtime.enabled){enqueueEvent(input);return;}
  if(!canStore())return;
  const event:PulseEvent={id:id(),sessionId:sessionId(),userId:input.userId??null,eventType:input.eventType,entityType:input.entityType??null,entityId:input.entityId??null,metadata:input.metadata??{},createdAt:now()};
  const events=[event,...listPulseEvents()].slice(0,1000);
  localStorage.setItem(EVENTS_KEY,JSON.stringify(events));
  window.dispatchEvent(new CustomEvent(PULSE_EVENTS_EVENT));
  syncSessionSignals(event.sessionId,events);
}
export function subscribePulseEvents(listener:()=>void){
  if(typeof window==="undefined")return()=>{};
  const local=()=>listener();
  const storage=(event:StorageEvent)=>{if(event.key===EVENTS_KEY)listener()};
  window.addEventListener(PULSE_EVENTS_EVENT,local);window.addEventListener("storage",storage);
  return()=>{window.removeEventListener(PULSE_EVENTS_EVENT,local);window.removeEventListener("storage",storage)};
}

export function resetPulsePreviewData(){
  if(runtime.enabled)return;
  if(!canStore())return;
  localStorage.removeItem(STATE_KEY);localStorage.removeItem(LEADS_KEY);localStorage.removeItem(EVENTS_KEY);
  localStorage.removeItem(PROFILES_KEY);localStorage.removeItem(TASKS_KEY);
  window.dispatchEvent(new CustomEvent(PULSE_STATE_EVENT));
  window.dispatchEvent(new CustomEvent(PULSE_LEADS_EVENT));
  window.dispatchEvent(new CustomEvent(PULSE_EVENTS_EVENT));
  window.dispatchEvent(new CustomEvent(PULSE_PROFILES_EVENT));
  window.dispatchEvent(new CustomEvent(PULSE_TASKS_EVENT));
}
