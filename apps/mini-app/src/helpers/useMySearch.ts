import {safeLocalStorage} from '../../../../packages/browser/storage';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {getPulseState} from '../../../../packages/pulse-data';
import {runtime,visitorApi} from '../../../../packages/pulse-data/runtime';
import {defaultSearchSettings,sameSearchCriteria,searchSnapshot,searchChanges,type SearchSettings,type SearchSnapshot,type SearchUpdate} from '../../../../packages/my-search';
type Result={settings:SearchSettings;feed:SearchUpdate[];authenticated:boolean};
type Local=Result&{baseline:SearchSnapshot};
const key='pulse.my-search.v1';
function local():Local{try{const v=JSON.parse(safeLocalStorage.getItem(key)||'null');if(v?.settings&&Array.isArray(v.feed)&&v.baseline)return v}catch{}return {settings:{...defaultSearchSettings},feed:[],authenticated:false,baseline:{}}}
function favorites():string[]{try{return JSON.parse(safeLocalStorage.getItem('pulse.dv.favorites.v1')||'[]')}catch{return []}}
export async function getMySearch():Promise<Result>{
 if(runtime.enabled)return visitorApi('/me/search');
 const stored=local(),properties=getPulseState().properties,next=searchSnapshot(properties,stored.settings,favorites());
 const changes=searchChanges(stored.baseline,next,properties,new Date().toISOString()).map(e=>({...e,id:crypto.randomUUID()}));
 const feed=[...changes.reverse(),...stored.feed].filter(e=>next[e.propertyId]&&(e.kind==='match'?next[e.propertyId].match:next[e.propertyId].favorite)&&Date.parse(e.at)>=Date.now()-30*86400000).slice(0,30);
 const result={...stored,baseline:next,feed,authenticated:false};safeLocalStorage.setItem(key,JSON.stringify(result));return result;
}
export async function saveMySearch(settings:SearchSettings):Promise<Result>{
 if(runtime.enabled)return visitorApi('/me/search',{method:'PUT',body:JSON.stringify(settings)});
 const stored=local(),reset=!sameSearchCriteria(stored.settings.criteria,settings.criteria)||stored.settings.watchFavorites!==settings.watchFavorites;
 const result:Local={settings:{...settings,telegram:false},feed:reset?[]:stored.feed,authenticated:false,baseline:reset?searchSnapshot(getPulseState().properties,settings,favorites()):stored.baseline};
 safeLocalStorage.setItem(key,JSON.stringify(result));return result;
}
export function useMySearch(){
 const client=useQueryClient();
 const query=useQuery({queryKey:['my-search'],queryFn:getMySearch,refetchInterval:60000,refetchOnWindowFocus:true});
 const save=useMutation({mutationFn:saveMySearch,onSuccess:data=>client.setQueryData(['my-search'],data)});
 return {...query,save};
}
