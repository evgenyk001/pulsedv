import {api,visitorApi,runtime} from '../pulse-data/runtime';
import {listPulseLeads,recordPulseEvent} from '../pulse-data';
import {applyJourney,clientJourney,emptyJourney,type Journey,type JourneyAttachment,type JourneyCommand,type Verification} from './model';
export type JourneyEntry={leadId:string;leadName?:string;status:string;propertyId:string|null;createdAt:string;managerName?:string|null;journey:Journey};
const KEY='pulse.dv.journeys.v1';
function read():Record<string,Journey>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
export async function loadJourneys(client=false):Promise<{items:JourneyEntry[];limited:boolean}>{
 if(runtime.enabled)return (client?visitorApi:api)((client?'/me':'/control')+'/journeys');
 const data=read();const session=sessionStorage.getItem('pulse.dv.session.v1');
 return {limited:false,items:listPulseLeads().filter(l=>!client||l.sessionId===session).map(l=>({leadId:l.id,leadName:l.name,status:l.status,propertyId:l.propertyId,createdAt:l.createdAt,journey:client?clientJourney(data[l.id]||emptyJourney(l.id)):data[l.id]||emptyJourney(l.id)}))};
}
export async function loadJourney(leadId:string,client=false):Promise<JourneyEntry|null>{
 if(runtime.enabled)return ((await (client?visitorApi:api)<{entry:JourneyEntry}>((client?'/me':'/control')+'/journeys/'+encodeURIComponent(leadId))).entry)||null;
 const lead=listPulseLeads().find(item=>item.id===leadId);if(!lead)return null;
 const journey=read()[leadId]||emptyJourney(leadId);
 return {leadId,leadName:lead.name,status:lead.status,propertyId:lead.propertyId,createdAt:lead.createdAt,journey:client?clientJourney(journey):journey};
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

function dataUrl(file:File){return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('Не удалось прочитать файл'));reader.onload=()=>resolve(String(reader.result||''));reader.readAsDataURL(file)})}
export async function uploadJourneyAttachment(leadId:string,file:File,client=false):Promise<JourneyAttachment>{
 const type=(file.type||'').toLowerCase();const image=['image/jpeg','image/png','image/webp'].includes(type);
 if(!image&&type!=='application/pdf')throw new Error('Можно отправить JPG, PNG, WebP или PDF');
 const max=image?15*1024*1024:25*1024*1024;if(!file.size||file.size>max)throw new Error(image?'Фото должно быть меньше 15 МБ':'PDF должен быть меньше 25 МБ');
 if(!runtime.enabled){
  if(file.size>1_500_000)throw new Error('В демо можно прикрепить файл до 1,5 МБ. На сервере лимит выше.');
  return {kind:image?'image':'file',name:file.name.slice(0,180)||'Файл',url:await dataUrl(file),mimeType:type,size:file.size};
 }
 const path=(client?'/me':'/control')+'/journeys/'+encodeURIComponent(leadId)+'/attachments?filename='+encodeURIComponent(file.name.slice(0,180));
 const response=await (client?visitorApi:api)<{attachment:JourneyAttachment}>(path,{method:'POST',headers:{'Content-Type':type},body:file});
 return response.attachment;
}
export async function markJourneyRead(journey:Journey,messageIds:string[],client=false){
 const ids=[...new Set(messageIds)].slice(0,100);if(!ids.length)return {journey};
 if(runtime.enabled)return (client?visitorApi:api)<{journey:Journey}>((client?'/me':'/control')+'/journeys/'+journey.leadId+'/read',{method:'POST',body:JSON.stringify({messageIds:ids})});
 const data=read();const current=data[journey.leadId]||emptyJourney(journey.leadId);const target=client?'manager':'client';const now=new Date().toISOString();
 current.messages=(current.messages||[]).map(m=>ids.includes(m.id)&&m.author===target&&!m.readAt?{...m,readAt:now}:m);
 data[journey.leadId]=current;localStorage.setItem(KEY,JSON.stringify(data));window.dispatchEvent(new Event('pulse:journey'));
 return {journey:client?clientJourney(current):current};
}
export async function loadVerifications():Promise<Verification[]>{if(runtime.enabled)return (await api('/public/verifications')).items;try{return JSON.parse(localStorage.getItem('pulse.dv.verifications.v1')||'[]')}catch{return []}}
export async function verifyProperty(propertyId:string,note:string,revision:number){
 if(runtime.enabled)return api('/control/verifications/'+encodeURIComponent(propertyId),{method:'POST',body:JSON.stringify({note,revision})});
 const all=await loadVerifications();if((all.find(x=>x.propertyId===propertyId)?.revision||0)!==revision)throw new Error('Проверка изменилась');
 localStorage.setItem('pulse.dv.verifications.v1',JSON.stringify([{propertyId,note,revision:revision+1,checkedAt:new Date().toISOString()},...all.filter(x=>x.propertyId!==propertyId)]));
}
