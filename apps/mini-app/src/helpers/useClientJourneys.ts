import {useEffect} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {loadJourneys} from '../../../../packages/journey/client';
export function useClientJourneys(interval=30000){
 const cache=useQueryClient();
 useEffect(()=>{const refresh=()=>void cache.invalidateQueries({queryKey:['my-journeys']});window.addEventListener('pulse:journey',refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener('pulse:journey',refresh);window.removeEventListener('storage',refresh)}},[cache]);
 return useQuery({queryKey:['my-journeys'],queryFn:()=>loadJourneys(true),staleTime:10000,refetchInterval:interval,refetchOnWindowFocus:true});
}
