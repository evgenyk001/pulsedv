import { DEFAULT_STATE, type PulseState, type PulseLead, type PulseTask, type PulseEvent, type PulseVisitorProfile } from './model';
export type TeamMember={id:string;name:string;email:string;role:'owner'|'admin'|'manager';active:boolean;cities:string[];telegramUserId:string|null};
export type Delivery={id:string;topic:string;attempts:number;lastError:string|null;processedAt:string|null;deadAt:string|null;createdAt:string};
export type Snapshot={state:PulseState;version:number;leads:PulseLead[];tasks:PulseTask[];events:PulseEvent[];profiles:PulseVisitorProfile[];members:TeamMember[];notifications:Delivery[];limited:boolean};
const empty:Snapshot={state:{...DEFAULT_STATE,properties:[],banners:[]},version:0,leads:[],tasks:[],events:[],profiles:[],members:[],notifications:[],limited:false};
export const runtime={enabled:false,base:'/api/v1',role:'public' as 'public'|'control',snapshot:empty,member:null as TeamMember|null,dirty:false,saving:false,error:null as string|null,ready:false,consentVersion:'2026-09-25',lastSync:null as string|null};
const notify=()=>{
 if(typeof window==='undefined')return;
 for(const name of ['state','leads','tasks','events','profiles'])window.dispatchEvent(new Event('pulse:control-'+name));
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
const SESSION='pulse.dv.api.session.v1';
async function session():Promise<Session>{
 if(sessionPromise)return sessionPromise;
 sessionPromise=(async()=>{
  let stored:Session|null=null;try{stored=JSON.parse(localStorage.getItem(SESSION)||'null');}catch{}
  if(stored&&Date.parse(stored.expiresAt)>Date.now()+60_000)return stored;
  const value=await api<Session>('/auth/session',{method:'POST',body:JSON.stringify({source:'mini-app'})});
  try{localStorage.setItem(SESSION,JSON.stringify(value));}catch{}
  return value;
 })();try{return await sessionPromise;}catch(error){sessionPromise=null;throw error;}
}
export async function visitorApi<T=any>(path:string,options:RequestInit={}):Promise<T>{
 const identity=await session();
 try{return await api<T>(path,{...options,headers:{...options.headers,Authorization:'Bearer '+identity.accessToken}});}catch(error){
  if(error instanceof ApiError&&error.status===401){sessionPromise=null;telegramBound=false;try{localStorage.removeItem(SESSION);}catch{}}
  throw error;
 }
}
export async function initializePublic(){
 const data=await api('/public/state');runtime.snapshot={...empty,state:data.state,version:data.version};runtime.consentVersion=data.consentVersion;runtime.ready=true;runtime.error=null;notify();
 await session();
 const initData=(window as any).Telegram?.WebApp?.initData;
 if(initData&&!telegramBound){await visitorApi('/auth/telegram',{method:'POST',body:JSON.stringify({initData})});telegramBound=true;}
}
export async function refreshControl(){
 try{
  const data=await api<Snapshot>('/control/snapshot');
  if(runtime.dirty){data.state=runtime.snapshot.state;data.version=runtime.snapshot.version;}
  runtime.snapshot=data;runtime.ready=true;runtime.lastSync=new Date().toISOString();runtime.error=null;notify();
 }catch(error){if(error instanceof ApiError&&error.status===401){runtime.member=null;runtime.ready=false;runtime.snapshot={...empty};runtime.dirty=false;}runtimeError(error);throw error;}
}
export async function login(email:string,password:string){const result=await api('/control/login',{method:'POST',body:JSON.stringify({email,password})});runtime.member=result.member;await refreshControl();}
export async function restoreLogin(){const data=await api('/control/me');runtime.member=data.member;await refreshControl();}
export async function logout(){await api('/control/logout',{method:'POST',body:'{}'});runtime.member=null;runtime.snapshot={...empty};runtime.ready=false;runtime.dirty=false;notify();}
export function stageState(state:PulseState){runtime.snapshot={...runtime.snapshot,state};runtime.dirty=true;notify();}
export async function saveState(){
 if(runtime.saving)return;
 runtime.saving=true;notify();
 const submitted=runtime.snapshot.state;
 try{const result=await api('/control/state',{method:'PUT',body:JSON.stringify({state:submitted,version:runtime.snapshot.version})});
  if(runtime.snapshot.state===submitted){runtime.snapshot={...runtime.snapshot,...result};runtime.dirty=false;}else runtime.snapshot.version=result.version;
  runtime.error=null;runtime.lastSync=new Date().toISOString();
 }catch(error){runtimeError(error);throw error;}finally{runtime.saving=false;notify();}
}
export async function discardState(){runtime.dirty=false;await refreshControl();}
export async function updateRemote(kind:'leads'|'tasks',id:string,patch:Record<string,unknown>){
 const item=runtime.snapshot[kind].find(x=>x.id===id);if(!item)throw new Error('Запись не найдена');
 try{await api('/control/'+kind+'/'+id,{method:'PATCH',body:JSON.stringify({...patch,expectedUpdatedAt:patch.expectedUpdatedAt??item.updatedAt})});await refreshControl();}catch(error){runtimeError(error);throw error;}
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
