import {api,runtime,visitorApi} from '../pulse-data/runtime';
import {broadcastError,type Broadcast,type BroadcastContent,type BroadcastList} from './index';
const KEY='pulse.broadcasts.v1',SUB='pulse.announcements.v1';
const read=():Broadcast[]=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return []}};
const write=(items:Broadcast[])=>{try{localStorage.setItem(KEY,JSON.stringify(items))}catch{throw Error('Не хватает места для тестового черновика. Уменьшите фото или подготовьте рассылку на серверной версии')}};
export async function listBroadcasts(page=1):Promise<BroadcastList>{
 if(runtime.enabled)return api('/control/broadcasts?page='+page);
 const all=read().sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
 return {items:all.slice((page-1)*20,page*20),page,hasMore:page*20<all.length,subscribers:0,telegramReady:false,testReady:false};
}
export async function saveBroadcast(id:string,version:number,content:BroadcastContent):Promise<Broadcast>{
 const error=broadcastError(content);if(error)throw Error(error);
 if(runtime.enabled)return (await api<{item:Broadcast}>('/control/broadcasts/'+id,{method:'PUT',body:JSON.stringify({version,content})})).item;
 const all=read(),old=all.find(c=>c.id===id);if(old&&(old.version!==version||old.status!=='draft'))throw Error('Обновите список рассылок');
 const item:Broadcast={...content,id,version:version+1,status:'draft',createdAt:old?.createdAt||new Date().toISOString(),sentAt:null,total:0,sent:0,pending:0,failed:0,skipped:0};write([item,...all.filter(c=>c.id!==id)]);return item;
}
export async function sendBroadcast(item:Broadcast):Promise<Broadcast>{
 if(runtime.enabled)return (await api<{item:Broadcast}>('/control/broadcasts/'+item.id+'/send',{method:'POST',body:JSON.stringify({version:item.version})})).item;
 const current=read().find(c=>c.id===item.id);if(!current||current.version!==item.version||current.status!=='draft')throw Error('Обновите список рассылок');
 const next:Broadcast={...current,status:'demo',version:current.version+1};write([next,...read().filter(c=>c.id!==item.id)]);return next;
}
export async function testBroadcast(item:Broadcast,requestId:string){
 if(!runtime.enabled)throw Error('Пробная отправка станет доступна после подключения бота');
 return api('/control/broadcasts/'+item.id+'/test',{method:'POST',body:JSON.stringify({version:item.version,requestId})});
}
export async function cancelBroadcast(item:Broadcast){return (await api<{item:Broadcast}>('/control/broadcasts/'+item.id+'/cancel',{method:'POST',body:JSON.stringify({version:item.version})})).item;}
export async function uploadBroadcastPhoto(file:File):Promise<string>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)throw Error('Выберите JPG, PNG или WebP до 8 МБ');
 if(!runtime.enabled){if(file.size>2*1024*1024)throw Error('Для тестового черновика выберите фото до 2 МБ');return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('Не удалось прочитать фото'));reader.readAsDataURL(file)});}
 const r=await fetch(runtime.base+'/control/content/broadcast-media',{method:'POST',credentials:'same-origin',headers:{'Content-Type':file.type},body:file,signal:AbortSignal.timeout(30000)});const result=await r.json();if(!r.ok)throw Error(result.error||'Не удалось загрузить фото');return result.imageUrl;
}
export async function announcementSettings():Promise<{enabled:boolean;authenticated:boolean}>{return runtime.enabled?visitorApi('/me/announcements'):{enabled:localStorage.getItem(SUB)!=='false',authenticated:false};}
export async function saveAnnouncementSettings(enabled:boolean){if(runtime.enabled)return visitorApi<{enabled:boolean;authenticated:boolean}>('/me/announcements',{method:'PUT',body:JSON.stringify({enabled})});localStorage.setItem(SUB,String(enabled));return {enabled,authenticated:false};}
