import React from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {runtime,visitorApi} from '../../../../packages/pulse-data/runtime';
import {loadJourneys} from '../../../../packages/journey/client';
import {clientUpdates} from '../../../../packages/journey/updates';
import {getMySearch} from './useMySearch';
import {localPartnerNotices} from '../../../../packages/partners/client';
export type ClientNotice={id:string;kind:'message'|'collection'|'showing'|'search'|'partner';title:string;body:string;at:string;href:string;read:boolean};
export type ClientInbox={items:ClientNotice[];unreadCount:number};
const KEY='pulse.read-updates.v1',DISMISSED='pulse.dismissed-updates.v1';
function dismissedIds():string[]{try{const v=JSON.parse(localStorage.getItem(DISMISSED)||'[]');return Array.isArray(v)?v.filter((id):id is string=>typeof id==='string'):[]}catch{return []}}
function readIds():string[]{try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v.filter((id):id is string=>typeof id==='string'):[]}catch{return []}}
async function localInbox():Promise<ClientInbox>{
 const [journeys,search]=await Promise.all([loadJourneys(true),getMySearch()]);
 const seen=new Set(readIds());
 const items:ClientNotice[]=[...clientUpdates(journeys.items,Infinity).map(u=>({id:u.id,kind:u.kind,body:u.body,title:u.title,at:u.at,href:'/journey?lead='+encodeURIComponent(u.leadId)+(u.kind==='collection'?'&tab=collections':u.kind==='showing'?'&tab=showings':''),read:!!u.read||seen.has(u.id)})),...search.feed.map(u=>({id:'search:'+u.id,kind:'search' as const,title:u.title,body:u.name,at:u.at,href:'/property/'+encodeURIComponent(u.propertyId),read:seen.has('search:'+u.id)}))];
 items.push(...localPartnerNotices().map(item=>({...item,read:seen.has(item.id)})));
 items.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||a.id.localeCompare(b.id));
 const dismissed=new Set(dismissedIds()),visible=items.filter(item=>!dismissed.has(item.id));return {items:visible,unreadCount:visible.filter(item=>!item.read).length};
}
export async function loadClientNotifications():Promise<ClientInbox>{
 if(runtime.enabled)return visitorApi('/me/notifications');
 const inbox=await localInbox();return {...inbox,items:inbox.items.slice(0,80)};
}
async function markClientNotifications(command:{ids:string[]}|{all:true}):Promise<ClientInbox>{
 if(runtime.enabled)return visitorApi('/me/notifications/read',{method:'POST',body:JSON.stringify(command)});
 const inbox=await localInbox();
 const ids='all' in command?inbox.items.map(u=>u.id):command.ids;
 localStorage.setItem(KEY,JSON.stringify([...new Set([...ids,...readIds()])].slice(0,10000)));
 window.dispatchEvent(new Event('pulse:notification-read'));
 return loadClientNotifications();
}
async function dismissClientNotifications(ids:string[]):Promise<ClientInbox>{
 if(runtime.enabled)return visitorApi('/me/notifications/dismiss',{method:'POST',body:JSON.stringify({ids})});
 localStorage.setItem(DISMISSED,JSON.stringify([...new Set([...dismissedIds(),...ids])]));window.dispatchEvent(new Event('pulse:notification-read'));return loadClientNotifications();
}
export function useClientNotifications(){
 const cache=useQueryClient();
 React.useEffect(()=>{
  const refresh=()=>void cache.invalidateQueries({queryKey:['client-notifications']});
  const storage=(event:StorageEvent)=>{if(event.key===null||['pulse.dv.journeys.v1','pulse.dv.control.leads.v1','pulse.my-search.v1','pulse.partners.v1',KEY,DISMISSED].includes(event.key))refresh();};
  const sources=['pulse:partners','pulse:journey','pulse:control-leads','pulse:control-state','pulse-favorites','pulse:notification-read'];
  for(const source of sources)window.addEventListener(source,refresh);window.addEventListener('storage',storage);
  return()=>{for(const source of sources)window.removeEventListener(source,refresh);window.removeEventListener('storage',storage);};
 },[cache]);
 const query=useQuery({queryKey:['client-notifications'],queryFn:loadClientNotifications,staleTime:10000,refetchInterval:runtime.enabled?30000:false,refetchIntervalInBackground:false,refetchOnWindowFocus:true});
 const mark=useMutation({mutationFn:markClientNotifications,onSuccess:data=>cache.setQueryData(['client-notifications'],data)});
 const dismiss=useMutation({mutationFn:dismissClientNotifications,scope:{id:'dismiss-notifications'},onSuccess:data=>cache.setQueryData(['client-notifications'],data)});
 return {...query,mark,dismiss};
}
