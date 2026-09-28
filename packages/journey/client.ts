import {api,visitorApi,runtime} from '../pulse-data/runtime';
import {listPulseLeads,recordPulseEvent} from '../pulse-data';
import {applyJourney,clientJourney,emptyJourney,type Journey,type JourneyCommand,type Verification} from './model';
export type JourneyEntry={leadId:string;status:string;propertyId:string|null;createdAt:string;managerName?:string|null;journey:Journey};
const KEY='pulse.dv.journeys.v1';
function read():Record<string,Journey>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
export async function loadJourneys(client=false):Promise<{items:JourneyEntry[];limited:boolean}>{
 if(runtime.enabled)return (client?visitorApi:api)((client?'/me':'/control')+'/journeys');
 const data=read();const session=sessionStorage.getItem('pulse.dv.session.v1');
 return {limited:false,items:listPulseLeads().filter(l=>!client||l.sessionId===session).map(l=>({leadId:l.id,status:l.status,propertyId:l.propertyId,createdAt:l.createdAt,journey:client?clientJourney(data[l.id]||emptyJourney(l.id)):data[l.id]||emptyJourney(l.id)}))};
}
export async function saveJourney(journey:Journey,command:JourneyCommand,client=false){
 if(runtime.enabled)return (client?visitorApi:api)((client?'/me':'/control')+'/journeys/'+journey.leadId,{method:'POST',body:JSON.stringify({revision:journey.revision,command})});
 const data=read();const current=data[journey.leadId]||emptyJourney(journey.leadId);
 if(current.revision!==journey.revision)throw new Error('Карточка изменилась. Обновите данные');
 data[journey.leadId]=applyJourney(current,command,client?'client':'manager');
 localStorage.setItem(KEY,JSON.stringify(data));window.dispatchEvent(new Event('pulse:journey'));
 if(client)recordPulseEvent({eventType:command.type==='reaction'?'collection_reaction':command.type==='message'?'client_message':command.type==='showing_change'?(command.action==='cancel'?'showing_cancelled':'showing_reschedule_requested'):'showing_requested',entityType:'property',entityId:command.type==='reaction'||command.type==='showing'?command.propertyId:null,metadata:command.type==='reaction'?{reaction:command.reaction,reply:command.reply.slice(0,150)}:{}});
 return {journey:client?clientJourney(data[journey.leadId]):data[journey.leadId]};
}
export async function loadVerifications():Promise<Verification[]>{if(runtime.enabled)return (await api('/public/verifications')).items;try{return JSON.parse(localStorage.getItem('pulse.dv.verifications.v1')||'[]')}catch{return []}}
export async function verifyProperty(propertyId:string,note:string,revision:number){
 if(runtime.enabled)return api('/control/verifications/'+encodeURIComponent(propertyId),{method:'POST',body:JSON.stringify({note,revision})});
 const all=await loadVerifications();if((all.find(x=>x.propertyId===propertyId)?.revision||0)!==revision)throw new Error('Проверка изменилась');
 localStorage.setItem('pulse.dv.verifications.v1',JSON.stringify([{propertyId,note,revision:revision+1,checkedAt:new Date().toISOString()},...all.filter(x=>x.propertyId!==propertyId)]));
}
