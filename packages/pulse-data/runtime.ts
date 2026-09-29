import { attribution } from '../journey/attribution';
import { DEFAULT_STATE, type PulseState, type PulseLead, type PulseTask, type PulseEvent, type PulseVisitorProfile } from './model';
export type TeamMember={id:string;name:string;email:string;role:'owner'|'admin'|'manager';active:boolean;cities:string[];telegramUserId:string|null;mfaEnabled:boolean};
export type Delivery={id:string;topic:string;attempts:number;lastError:string|null;processedAt:string|null;deadAt:string|null;createdAt:string};
export type Snapshot={state:PulseState;version:number;leads:PulseLead[];tasks:PulseTask[];events:PulseEvent[];profiles:PulseVisitorProfile[];members:TeamMember[];notifications:Delivery[];limited:boolean};
export type ControlCounts={leadsTotal:number;activeLeads:number;newLeads:number;unassignedLeads:number;openTasks:number;overdueTasks:number;hotProfiles:number;leadStages:Record<PulseLead['status'],number>};
export type ControlResource='leads'|'tasks'|'events'|'profiles';
export type PageMeta={page:number;limit:number;total:number;hasMore:boolean;loading:boolean};
const empty:Snapshot={state:{...DEFAULT_STATE,properties:[],banners:[]},version:0,leads:[],tasks:[],events:[],profiles:[],members:[],notifications:[],limited:false};
const emptyCounts:ControlCounts={leadsTotal:0,activeLeads:0,newLeads:0,unassignedLeads:0,openTasks:0,overdueTasks:0,hotProfiles:0,leadStages:{new:0,contacted:0,qualified:0,showing:0,booking:0,deal:0,closed:0,lost:0}};
const emptyPage=(limit:number):PageMeta=>({page:0,limit,total:0,hasMore:false,loading:false});
export const runtime={enabled:false,base:'/api/v1',role:'public' as 'public'|'control',snapshot:empty,member:null as TeamMember|null,counts:emptyCounts,pages:{leads:emptyPage(300),tasks:emptyPage(300),events:emptyPage(500),profiles:emptyPage(300)} as Record<ControlResource,PageMeta>,dirty:false,saving:false,error:null as string|null,ready:false,consentVersion:'2026-09-25',lastSync:null as string|null};
const notify=(names:ControlResource[]|['state']|null=null)=>{
 if(typeof window==='undefined')return;
 const list=names??['state','leads','tasks','events','profiles'];
 for(const name of list)window.dispatchEvent(new Event('pulse:control-'+name));
 window.dispatchEvent(new Event('pulse:runtime'));
};
export function configureRuntime(input:{enabled:boolean;base?:string;role:'public'|'control'}){runtime.enabled=input.enabled;runtime.base=(input.base||'/api/v1').replace(/\/$/,'');runtime.role=input.role;}
export function subscribeRuntime(listener:()=>void){window.addEventListener('pulse:runtime',listener);return()=>window.removeEventListener('pulse:runtime',listener);}
export function runtimeError(error:unknown){runtime.error=error instanceof Error?error.message:'Не удалось выполнить запрос';notify();}
export class ApiError extends Error{constructor(public status:number,message:string){super(message);}}
export async function api<T=any>(path:string,options:RequestInit={}):Promise<T>{
 let response:Response;
 try{response=await fetch(runtime.base+path,{...options,credentials:'same-origin',headers:{...(options.body?{'Content-Type':'application/json'}:{}),...options.headers},signal:options.signal??AbortSignal.timeout(12000)});}catch{throw new ApiError(0,'Нет связи с сервером. Проверьте соединение и повторите попытку');}
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw new ApiError(response.status,body.error||'Не удалось выполнить запрос');return body;
}
type Session={sessionId:string;accessToken:string;expiresAt:string};
let sessionPromise:Promise<Session>|null=null;
let telegramBound=false;
let visitorCookieBound=false;
const SESSION='pulse.dv.api.session.v1';
async function session():Promise<Session>{
 if(sessionPromise)return sessionPromise;
 sessionPromise=(async()=>{
  let stored:Session|null=null;try{stored=JSON.parse(localStorage.getItem(SESSION)||'null');}catch{}
  if(stored&&Date.parse(stored.expiresAt)>Date.now()+60_000)return stored;
  const value=await api<Session>('/auth/session',{method:'POST',body:JSON.stringify(attribution(window.location.search||window.location.hash.split('?')[1]||''))});
  try{localStorage.setItem(SESSION,JSON.stringify(value));}catch{}
  return value;
 })();try{return await sessionPromise;}catch(error){sessionPromise=null;throw error;}
}
export async function visitorApi<T=any>(path:string,options:RequestInit={}):Promise<T>{
 const identity=await session();
 try{return await api<T>(path,{...options,headers:{...options.headers,Authorization:'Bearer '+identity.accessToken}});}catch(error){
  if(error instanceof ApiError&&error.status===401){sessionPromise=null;telegramBound=false;visitorCookieBound=false;try{localStorage.removeItem(SESSION);}catch{}}
  throw error;
 }
}
export async function initializePublic(){
 const data=await api('/public/state');runtime.snapshot={...empty,state:{...empty.state,...data.state},version:data.version};runtime.consentVersion=data.consentVersion;runtime.ready=true;runtime.error=null;notify();
 await session();
 if(!visitorCookieBound){await visitorApi('/auth/cookie',{method:'POST',body:'{}'});visitorCookieBound=true;}
 const initData=(window as any).Telegram?.WebApp?.initData;
 if(initData&&!telegramBound){await visitorApi('/auth/telegram',{method:'POST',body:JSON.stringify({initData})});telegramBound=true;}
}
type Bootstrap={state:PulseState;version:number;members:TeamMember[];notifications:Delivery[];counts:ControlCounts};
type Paged<T>={items:T[];page:number;limit:number;total:number;hasMore:boolean};
const resourceLoads=new Map<string,Promise<void>>();
export async function refreshControl(){
 try{
  const data=await api<Bootstrap>('/control/bootstrap');
  const state=runtime.dirty?runtime.snapshot.state:data.state;
  const version=runtime.dirty?runtime.snapshot.version:data.version;
  runtime.snapshot={...runtime.snapshot,state,version,members:data.members,notifications:data.notifications};
  runtime.counts=data.counts;runtime.ready=true;runtime.lastSync=new Date().toISOString();runtime.error=null;notify(['state']);
 }catch(error){if(error instanceof ApiError&&error.status===401){runtime.member=null;runtime.ready=false;runtime.snapshot={...empty};runtime.counts={...emptyCounts};runtime.dirty=false;}runtimeError(error);throw error;}
}
export async function refreshControlPulse(){
 if(!runtime.enabled||!runtime.member)return;
 try{
  const data=await api<{counts:ControlCounts;notifications:Delivery[]}>('/control/pulse');
  runtime.counts=data.counts;runtime.snapshot={...runtime.snapshot,notifications:data.notifications};runtime.lastSync=new Date().toISOString();runtime.error=null;notify([]);
 }catch(error){if(error instanceof ApiError&&error.status===401){runtime.member=null;runtime.ready=false;runtime.snapshot={...empty};runtime.counts={...emptyCounts};runtime.dirty=false;}runtimeError(error);throw error;}
}
const resourceLimit=(kind:ControlResource)=>runtime.pages[kind].limit;
export async function refreshControlResource(kind:ControlResource,page=1,append=false){
 if(!runtime.enabled||!runtime.member)return;
 const key=kind+':'+page;
 if(resourceLoads.has(key))return resourceLoads.get(key);
 const run=(async()=>{
  runtime.pages[kind]={...runtime.pages[kind],loading:true};notify([kind]);
  try{
   const limit=resourceLimit(kind);
   const data=await api<Paged<any>>('/control/'+kind+'?page='+page+'&limit='+limit);
   const current=runtime.snapshot[kind] as any[];
   let items:any[];
   if(append){
    const seen=new Set(current.map(item=>item.id));items=[...current,...data.items.filter(item=>!seen.has(item.id))];
   }else if(page===1&&current.length>limit){
    const ids=new Set(data.items.map(item=>item.id));items=[...data.items,...current.filter(item=>!ids.has(item.id))];
   }else items=data.items;
   runtime.snapshot={...runtime.snapshot,[kind]:items,limited:items.length<data.total};
   runtime.pages[kind]={page:Math.max(page,append?runtime.pages[kind].page:1),limit:data.limit,total:data.total,hasMore:items.length<data.total,loading:false};
   runtime.lastSync=new Date().toISOString();runtime.error=null;notify([kind]);
  }catch(error){runtime.pages[kind]={...runtime.pages[kind],loading:false};runtimeError(error);throw error;}
  finally{resourceLoads.delete(key);}
 })();
 resourceLoads.set(key,run);return run;
}
export async function loadMoreControlResource(kind:ControlResource){
 const meta=runtime.pages[kind];if(meta.loading||!meta.hasMore)return;
 return refreshControlResource(kind,Math.max(1,meta.page+1),true);
}
export type LoginResult={member?:TeamMember;mfaRequired?:boolean;challengeId?:string;expiresAt?:string};
export async function login(email:string,password:string){
 const result=await api<LoginResult>('/control/login',{method:'POST',body:JSON.stringify({email,password})});
 if(result.mfaRequired)return result;
 runtime.member=result.member??null;if(runtime.member)await refreshControl();return result;
}
export async function verifyLogin(challengeId:string,code:string){
 const result=await api<{member:TeamMember}>('/control/login/verify',{method:'POST',body:JSON.stringify({challengeId,code})});
 runtime.member=result.member;await refreshControl();return result;
}
export async function setMfa(enabled:boolean,currentPassword:string,telegramUserId?:string){
 const result=await api<{member:TeamMember}>('/control/mfa',{method:'POST',body:JSON.stringify({enabled,currentPassword,...(telegramUserId?{telegramUserId}:{})})});
 runtime.member=result.member;notify();return result;
}
export async function restoreLogin(){const data=await api('/control/me');runtime.member=data.member;await refreshControl();}
export async function logout(){await api('/control/logout',{method:'POST',body:'{}'});runtime.member=null;runtime.snapshot={...empty};runtime.counts={...emptyCounts};runtime.pages={leads:emptyPage(300),tasks:emptyPage(300),events:emptyPage(500),profiles:emptyPage(300)};runtime.ready=false;runtime.dirty=false;notify();}
export function stageState(state:PulseState){runtime.snapshot={...runtime.snapshot,state};runtime.dirty=true;notify();}
export async function saveState(){
 if(runtime.saving)return;
 runtime.saving=true;notify();
 const submitted=runtime.snapshot.state;
 const payloadState={...submitted,properties:[]};
 try{const result=await api<any>('/control/state',{method:'PUT',body:JSON.stringify({state:payloadState,version:runtime.snapshot.version})});
  if(runtime.snapshot.state===submitted){
   runtime.snapshot={...runtime.snapshot,...result,state:{...result.state,properties:submitted.properties}};
   runtime.dirty=false;
  }else runtime.snapshot.version=result.version;
  runtime.error=null;runtime.lastSync=new Date().toISOString();
 }catch(error){runtimeError(error);throw error;}finally{runtime.saving=false;notify();}
}
export async function discardState(){runtime.dirty=false;await refreshControl();}
export async function updateRemote(kind:'leads'|'tasks',id:string,patch:Record<string,unknown>){
 const item=runtime.snapshot[kind].find(x=>x.id===id);if(!item)throw new Error('Запись не найдена');
 try{await api('/control/'+kind+'/'+id,{method:'PATCH',body:JSON.stringify({...patch,expectedUpdatedAt:patch.expectedUpdatedAt??item.updatedAt})});await Promise.all([refreshControlResource(kind),refreshControlPulse()]);}catch(error){runtimeError(error);throw error;}
}
export async function createRemoteLead(payload:Record<string,unknown>){return visitorApi('/leads',{method:'POST',body:JSON.stringify({...payload,consent:true,consentVersion:runtime.consentVersion})});}

type QueuedEvent={idempotencyKey:string;eventType:string;entityType:string|null;entityId:string|null;metadata:Record<string,unknown>;occurredAt:string};
const QUEUE='pulse.dv.api.events.v1';
let queue:QueuedEvent[]=[];let loaded=false;let flushing=false;let retry=0;let timer:ReturnType<typeof setTimeout>|undefined;
const persist=()=>{try{localStorage.setItem(QUEUE,JSON.stringify(queue.slice(-500)));}catch{}};
export function enqueueEvent(input:{eventType:string;entityType?:string|null;entityId?:string|null;metadata?:Record<string,unknown>}){
 if(!loaded){loaded=true;try{const saved=JSON.parse(localStorage.getItem(QUEUE)||'[]');queue=Array.isArray(saved)?saved.filter(x=>Date.parse(x.occurredAt)>Date.now()-7*86400_000).slice(-400):[];}catch{}}
 queue.push({idempotencyKey:crypto.randomUUID(),eventType:input.eventType,entityType:input.entityType??null,entityId:input.entityId??null,metadata:input.metadata??{},occurredAt:new Date().toISOString()});
 queue=queue.slice(-500);persist();schedule(800);
}
function schedule(ms:number){if(timer)return;timer=setTimeout(()=>{timer=undefined;void flushEvents();},ms);}
export async function flushEvents(){
 if(flushing||!queue.length||!runtime.enabled)return;flushing=true;
 const batch=queue.slice(0,100);
 try{await visitorApi('/events',{method:'POST',body:JSON.stringify({events:batch})});queue=queue.filter(x=>!batch.some(b=>b.idempotencyKey===x.idempotencyKey));retry=0;persist();}
 catch(error){retry++;if(error instanceof ApiError&&error.status===400){queue=queue.filter(x=>!batch.some(b=>b.idempotencyKey===x.idempotencyKey));persist();}}
 finally{flushing=false;if(queue.length)schedule(Math.min(60000,1000*2**Math.min(retry,6)));}
}
