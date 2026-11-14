import {useQuery} from '@tanstack/react-query';
import {api,runtime,visitorApi} from '../../../../packages/pulse-data/runtime';
import type {GiveawayState} from '../../../../packages/giveaway';
export function useGiveaway(){return useQuery<GiveawayState|null>({queryKey:['giveaway'],queryFn:async()=>{if(!runtime.enabled)return null;const data=await (runtime.publicPreview?api<GiveawayState>('/public/giveaway'):visitorApi<GiveawayState>('/me/giveaway'));return {...data,observedAt:performance.now()}} ,staleTime:30000,refetchOnWindowFocus:true,refetchInterval:60000});}
