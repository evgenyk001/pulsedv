import { DEFAULT_LEAD_ENGINE_CONFIG, scoreLeadEvents, type LeadEngineConfig, type LeadPriority, type LeadScoreReason } from "../lead-engine";

export type PropertyStatus="draft"|"published"|"archived";

export type PulseProperty={
  id:string; name:string; city:string; district:string; address:string|null;
  latitude:number|null; longitude:number|null; priceFrom:number; delivery:string;
  className:string; status:PropertyStatus; description:string; developerName:string;
  tags:string[]; coverImageUrl:string|null; sortOrder:number;
  images:{id?:string;url:string;alt:string;sortOrder:number}[];
  features:{id?:string;label:string;icon:string;sortOrder:number}[];
  floorplans:{id?:string;roomLabel:string;areaFrom:number|null;areaTo:number|null;priceFrom:number|null;imageUrl:string|null;sortOrder:number}[];
};

export type PulseBanner={
  id:string; title:string; body:string; imageUrl:string|null; ctaLabel:string|null;
  actionUrl:string|null; city:string|null; audience:string|null; enabled:boolean; sortOrder:number;
};

export type MortgageProgramRule={
  id:"family"|"farEast"|"it"|"standard"; label:string; rate:number; maxYears:number;
  minDownPct:number; subsidizedLimit:number; totalLimit:number; blended:boolean; hint:string;
};

export type PulseSelectConfig={
  cities:string[];
  roomOptions:string[];
  deliveryOptions:string[];
  mortgageEnabled:boolean;
  seaEnabled:boolean;
  weights:{city:number;budget:number;rooms:number;delivery:number;preferences:number};
};

export type PulseContentConfig={
  onboardingEnabled:boolean;
  onboardingVersion:string;
};

export type PulseState={
  properties:PulseProperty[];
  banners:PulseBanner[];
  mortgagePrograms:MortgageProgramRule[];
  select:PulseSelectConfig;
  content:PulseContentConfig;
  leadEngine:LeadEngineConfig;
  updatedAt:string;
};

export type PulseLead={
  id:string; source:string; propertyId:string|null; name:string; phone:string; comment:string|null;
  status:"new"|"contacted"|"qualified"|"showing"|"booking"|"deal"|"closed"|"lost";
  manager:string|null; createdAt:string; updatedAt:string;
  sessionId?:string|null; userId?:string|null; score?:number; priority?:LeadPriority;
  scoreReasons?:LeadScoreReason[]; topPropertyId?:string|null; city?:string|null;
  mortgageProgram?:string|null; nextAction?:string|null;
};

export type PulseVisitorProfile={
  id:string; sessionId:string; userId:string|null; score:number; priority:LeadPriority;
  scoreReasons:LeadScoreReason[]; topPropertyId:string|null; city:string|null;
  mortgageProgram:string|null; nextAction:string; eventCount:number;
  firstSeenAt:string; lastSeenAt:string; updatedAt:string;
};

export type PulseTask={
  id:string; leadId:string|null; profileId:string; sessionId:string;
  title:string; reason:string; priority:Exclude<LeadPriority,"cold">;
  status:"today"|"in_progress"|"waiting"|"done";
  dueAt:string; createdAt:string; updatedAt:string;
};

export type PulseEvent={
  id:string; sessionId:string; userId:string|null; eventType:string; entityType:string|null;
  entityId:string|null; metadata:Record<string,unknown>; createdAt:string;
};

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

export const DEFAULT_PROPERTIES:PulseProperty[]=[
  {id:"primorskiy",name:"ЖК Приморский",city:"Владивосток",district:"Центр",address:"Владивосток",latitude:43.1155,longitude:131.8855,priceFrom:7.8,delivery:"I кв. 2027",className:"Бизнес",status:"published",description:"Современный жилой комплекс в центральной части Владивостока с благоустроенной территорией и выразительной архитектурой.",developerName:"Партнёр PULSE.DV",tags:["Старт продаж"],coverImageUrl:"https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1000&q=85",sortOrder:1,images:[{url:"https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=85",alt:"ЖК Приморский",sortOrder:1}],features:[{label:"Центр города",icon:"map-pin",sortOrder:1},{label:"Двор без машин",icon:"car",sortOrder:2},{label:"Благоустройство",icon:"trees",sortOrder:3}],floorplans:[{roomLabel:"1",areaFrom:38,areaTo:46,priceFrom:7.8,imageUrl:null,sortOrder:1},{roomLabel:"2",areaFrom:56,areaTo:71,priceFrom:9.4,imageUrl:null,sortOrder:2},{roomLabel:"3+",areaFrom:78,areaTo:102,priceFrom:12.8,imageUrl:null,sortOrder:3}]},
  {id:"solnechniy",name:"ЖК Солнечный",city:"Владивосток",district:"Патрокл",address:"Владивосток, Патрокл",latitude:43.105,longitude:131.98,priceFrom:6.2,delivery:"IV кв. 2026",className:"Комфорт+",status:"published",description:"Проект рядом с морем с панорамными видами, дворами для отдыха и семейной инфраструктурой.",developerName:"Партнёр PULSE.DV",tags:["Вид на море"],coverImageUrl:"https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=85",sortOrder:2,images:[{url:"https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=85",alt:"ЖК Солнечный",sortOrder:1}],features:[{label:"Вид на море",icon:"waves",sortOrder:1},{label:"Прогулочные зоны",icon:"trees",sortOrder:2},{label:"Детские площадки",icon:"baby",sortOrder:3}],floorplans:[{roomLabel:"Студия",areaFrom:27,areaTo:31,priceFrom:6.2,imageUrl:null,sortOrder:1},{roomLabel:"1",areaFrom:34,areaTo:45,priceFrom:6.8,imageUrl:null,sortOrder:2},{roomLabel:"2",areaFrom:52,areaTo:69,priceFrom:8.6,imageUrl:null,sortOrder:3}]},
  {id:"vostochniy",name:"ЖК Восточный",city:"Уссурийск",district:"Новый район",address:"Уссурийск",latitude:43.80,longitude:131.96,priceFrom:5.4,delivery:"2027",className:"Комфорт",status:"published",description:"Новый жилой квартал с удобными планировками и спокойной семейной средой.",developerName:"Партнёр PULSE.DV",tags:["Новый район"],coverImageUrl:"https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1000&q=85",sortOrder:3,images:[{url:"https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=85",alt:"ЖК Восточный",sortOrder:1}],features:[{label:"Парковка",icon:"car",sortOrder:1},{label:"Зелёный двор",icon:"trees",sortOrder:2}],floorplans:[{roomLabel:"1",areaFrom:35,areaTo:44,priceFrom:5.4,imageUrl:null,sortOrder:1},{roomLabel:"2",areaFrom:53,areaTo:68,priceFrom:7.1,imageUrl:null,sortOrder:2},{roomLabel:"3+",areaFrom:76,areaTo:91,priceFrom:9.2,imageUrl:null,sortOrder:3}]},
  {id:"artem",name:"ЖК Аэропорт",city:"Артём",district:"Северный",address:"Артём",latitude:43.35,longitude:132.18,priceFrom:4.9,delivery:"2026",className:"Комфорт",status:"published",description:"Современный проект в Артёме с удобным выездом и базовой инфраструктурой рядом.",developerName:"Партнёр PULSE.DV",tags:["Новый район"],coverImageUrl:"https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=1000&q=85",sortOrder:4,images:[{url:"https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=1200&q=85",alt:"ЖК Аэропорт",sortOrder:1}],features:[{label:"Удобный выезд",icon:"map-pin",sortOrder:1},{label:"Парковка",icon:"car",sortOrder:2}],floorplans:[{roomLabel:"Студия",areaFrom:25,areaTo:30,priceFrom:4.9,imageUrl:null,sortOrder:1},{roomLabel:"1",areaFrom:33,areaTo:42,priceFrom:5.3,imageUrl:null,sortOrder:2},{roomLabel:"2",areaFrom:50,areaTo:64,priceFrom:6.7,imageUrl:null,sortOrder:3}]}
];

export const DEFAULT_BANNERS:PulseBanner[]=[
  {id:"b1",title:"Квартира, которую хочется показывать друзьям",body:"Проекты Владивостока, Артёма и Уссурийска в одном каталоге.",imageUrl:null,ctaLabel:"Смотреть проекты",actionUrl:"/catalog",city:"Приморье",audience:"",enabled:true,sortOrder:1},
  {id:"b2",title:"Сначала платёж. Потом — подходящие квартиры",body:"Подберём проекты под комфортный ежемесячный платёж.",imageUrl:null,ctaLabel:"Рассчитать",actionUrl:"/mortgage",city:"Ипотека",audience:"",enabled:true,sortOrder:2},
  {id:"b3",title:"Не листайте сотни квартир вручную",body:"Ответьте на несколько вопросов — покажем подходящие ЖК.",imageUrl:null,ctaLabel:"Начать подбор",actionUrl:"/selection",city:"PULSE Select",audience:"",enabled:true,sortOrder:3}
];

export const DEFAULT_MORTGAGE_PROGRAMS:MortgageProgramRule[]=[
  {id:"family",label:"Семейная",rate:6,maxYears:30,minDownPct:20.1,subsidizedLimit:6_000_000,totalLimit:15_000_000,blended:true,hint:"Льготная часть — до 6 млн ₽. Увеличенный лимит может включать часть по рыночной ставке."},
  {id:"farEast",label:"Дальневосточная",rate:2,maxYears:20,minDownPct:20.1,subsidizedLimit:6_000_000,totalLimit:9_000_000,blended:false,hint:"До 6 млн ₽; до 9 млн ₽ — при выполнении условия по площади новостройки."},
  {id:"it",label:"IT",rate:6,maxYears:30,minDownPct:20.1,subsidizedLimit:9_000_000,totalLimit:18_000_000,blended:true,hint:"Базовый льготный лимит — 9 млн ₽, увеличенный — до 18 млн ₽."},
  {id:"standard",label:"Базовая",rate:18,maxYears:30,minDownPct:20.1,subsidizedLimit:100_000_000,totalLimit:100_000_000,blended:false,hint:"Рыночная программа. Ставка в расчёте редактируется вручную."}
];

export const DEFAULT_STATE:PulseState={
  properties:DEFAULT_PROPERTIES,
  banners:DEFAULT_BANNERS,
  mortgagePrograms:DEFAULT_MORTGAGE_PROGRAMS,
  select:{cities:["Владивосток","Уссурийск","Артём"],roomOptions:["Студия","1","2","3+"],deliveryOptions:["Любой","2026","2027"],mortgageEnabled:true,seaEnabled:true,weights:{city:25,budget:30,rooms:20,delivery:10,preferences:15}},
  content:{onboardingEnabled:true,onboardingVersion:"6"},
  leadEngine:DEFAULT_LEAD_ENGINE_CONFIG,
  updatedAt:now()
};

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
  if(!canStore())return DEFAULT_STATE;
  try{return mergeState(JSON.parse(localStorage.getItem(STATE_KEY)||"null"))}
  catch{return DEFAULT_STATE}
}

export function setPulseState(next:PulseState){
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
  if(!canStore())return[];
  try{const value=JSON.parse(localStorage.getItem(LEADS_KEY)||"[]");return Array.isArray(value)?value:[]}
  catch{return[]}
}
export function addPulseLead(payload:Omit<PulseLead,"id"|"status"|"manager"|"createdAt"|"updatedAt"|"sessionId"|"userId"|"score"|"priority"|"scoreReasons"|"topPropertyId"|"city"|"mortgageProgram"|"nextAction">){
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
  if(!canStore())return[];
  try{const value=JSON.parse(localStorage.getItem(TASKS_KEY)||"[]");return Array.isArray(value)?value:[]}
  catch{return[]}
}
export function updatePulseTask(idValue:string,patch:Partial<Pick<PulseTask,"status"|"title"|"reason"|"dueAt">>){
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
  const linked=leads.filter(lead=>lead.sessionId===session);
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
    const nextTask:PulseTask=existing?{
      ...existing,
      title:priority==="urgent"?"Связаться с горячим лидом":"Связаться с лидом",
      reason:profile.nextAction,
      priority,
      dueAt:dueAtFor(priority),
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

function sessionId(){
  if(typeof window==="undefined")return"server";
  let value=sessionStorage.getItem(SESSION_KEY);
  if(!value){value=id();sessionStorage.setItem(SESSION_KEY,value)}
  return value;
}
export function listPulseEvents():PulseEvent[]{
  if(!canStore())return[];
  try{const value=JSON.parse(localStorage.getItem(EVENTS_KEY)||"[]");return Array.isArray(value)?value:[]}
  catch{return[]}
}
export function recordPulseEvent(input:{eventType:string;entityType?:string|null;entityId?:string|null;metadata?:Record<string,unknown>;userId?:string|null}){
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
  if(!canStore())return;
  localStorage.removeItem(STATE_KEY);localStorage.removeItem(LEADS_KEY);localStorage.removeItem(EVENTS_KEY);
  localStorage.removeItem(PROFILES_KEY);localStorage.removeItem(TASKS_KEY);
  window.dispatchEvent(new CustomEvent(PULSE_STATE_EVENT));
  window.dispatchEvent(new CustomEvent(PULSE_LEADS_EVENT));
  window.dispatchEvent(new CustomEvent(PULSE_EVENTS_EVENT));
  window.dispatchEvent(new CustomEvent(PULSE_PROFILES_EVENT));
  window.dispatchEvent(new CustomEvent(PULSE_TASKS_EVENT));
}
