import React from 'react';
import {recordPulseEvent} from '../../../../packages/pulse-data';
import {runtime,visitorApi} from '../../../../packages/pulse-data/runtime';
const KEY='pulse.dv.favorites.v1',PENDING='pulse.favorite-changes.v2',MIGRATED='pulse.favorites-imported.v2';
type Change={id:string;saved:boolean;nonce:string};
function read<T>(key:string,fallback:T):T{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
function readIds():string[]{const ids=read<unknown>(KEY,[]);return Array.isArray(ids)?ids.filter(x=>typeof x==='string').slice(0,500):[]}
function pending():Change[]{const v=read<unknown>(PENDING,[]);return Array.isArray(v)?v.filter(x=>typeof x?.id==='string'&&typeof x?.saved==='boolean'&&typeof x?.nonce==='string'):[]}
function save(ids:string[]){localStorage.setItem(KEY,JSON.stringify(ids));window.dispatchEvent(new Event('pulse-favorites'))}
let task:Promise<void>|null=null;let error='';let authenticated=false;
export function syncFavorites():Promise<void>{
 if(!runtime.enabled)return Promise.resolve();if(task)return task;
 task=(async()=>{try{
  const batch=pending(),importIds=localStorage.getItem(MIGRATED)?undefined:readIds();
  const result=await visitorApi<{ids:string[];authenticated:boolean}>('/me/favorites',batch.length||importIds?{method:'POST',body:JSON.stringify({changes:batch.map(({id,saved})=>({id,saved})),importIds})}:{});
  if(importIds)localStorage.setItem(MIGRATED,'1');
  const remaining=pending().filter(c=>!batch.some(b=>b.nonce===c.nonce));localStorage.setItem(PENDING,JSON.stringify(remaining));
  const ids=new Set(result.ids);for(const c of remaining)c.saved?ids.add(c.id):ids.delete(c.id);
  authenticated=result.authenticated;error='';save([...ids]);
 }catch(e){error=(e as Error).message;window.dispatchEvent(new Event('pulse-favorites'))}
 finally{task=null}})();return task;
}
export function FavoriteSync(){
 React.useEffect(()=>{
  const refresh=()=>{if(!document.hidden)void syncFavorites()};refresh();
  window.addEventListener('online',refresh);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  const tick=setInterval(refresh,30000);
  return()=>{clearInterval(tick);window.removeEventListener('online',refresh);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)};
 },[]);return null;
}
export function useFavoriteIds(){
 const [ids,setIds]=React.useState<string[]>(readIds),[,render]=React.useReducer(n=>n+1,0);
 React.useEffect(()=>{const sync=()=>{setIds(readIds());render()};window.addEventListener('pulse-favorites',sync);window.addEventListener('storage',sync);return()=>{window.removeEventListener('pulse-favorites',sync);window.removeEventListener('storage',sync)}},[]);
 const toggle=React.useCallback((propertyId:string)=>{
  const current=readIds(),removing=current.includes(propertyId);
  if(!removing&&current.length>=500){error='В избранном можно сохранить до 500 ЖК';window.dispatchEvent(new Event('pulse-favorites'));return}
  if(runtime.enabled){const changes=pending().filter(c=>c.id!==propertyId);changes.push({id:propertyId,saved:!removing,nonce:crypto.randomUUID()});localStorage.setItem(PENDING,JSON.stringify(changes));}
  save(removing?current.filter(x=>x!==propertyId):[...current,propertyId]);
  recordPulseEvent({eventType:removing?'favorite_remove':'favorite_add',entityType:'property',entityId:propertyId});
  if(runtime.enabled)void syncFavorites().then(()=>{if(!error&&pending().length)void syncFavorites()});
 },[]);
 return {ids,toggle,isFavorite:(id:string)=>ids.includes(id),error,authenticated,pending:pending().length,retry:syncFavorites};
}
