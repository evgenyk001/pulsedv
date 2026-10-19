import {runtime} from '../../../../packages/pulse-data/runtime';
import {useEffect} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {loadJourneys} from '../../../../packages/journey/client';
export function useClientJourneys(interval=30000){
 const cache=useQueryClient();
 useEffect(()=>{const refresh=()=>void cache.invalidateQueries({queryKey:['my-journeys']});window.addEventListener('pulse:journey',refresh);const storage=(e:StorageEvent)=>{if(e.key===null||['pulse.dv.journeys.v1','pulse.dv.control.leads.v1'].includes(e.key))refresh()};window.addEventListener('storage',storage);window.addEventListener('pulse:control-leads',refresh);return()=>{window.removeEventListener('pulse:journey',refresh);window.removeEventListener('storage',storage);window.removeEventListener('pulse:control-leads',refresh)}},[cache]);
 return useQuery({queryKey:['my-journeys'],queryFn:()=>loadJourneys(true),staleTime:10000,refetchInterval:runtime.enabled?interval:false,refetchIntervalInBackground:false,refetchOnWindowFocus:true});
}
