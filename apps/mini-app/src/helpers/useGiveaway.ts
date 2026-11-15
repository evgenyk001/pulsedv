import {useQuery} from '@tanstack/react-query';
import {api,runtime,visitorApi} from '../../../../packages/pulse-data/runtime';
import type {GiveawayState} from '../../../../packages/giveaway';

type Viewer = 'guest'|'unverified'|'registered';
type GiveawayView = GiveawayState & {viewer:Viewer};

export function useGiveaway(){
 return useQuery<GiveawayView|null>({
  queryKey:['giveaway'],
  queryFn:async()=>{
   if(!runtime.enabled)return null;
   let viewer:Viewer='registered';
   if(runtime.publicPreview){
    const account=await visitorApi<{authenticated:boolean;registered:boolean}>('/me/account');
    viewer=account.registered?'registered':account.authenticated?'unverified':'guest';
   }
   const data=viewer==='registered'
    ? await visitorApi<GiveawayState>('/me/giveaway')
    : await api<GiveawayState>('/public/giveaway');
   return {...data,viewer,observedAt:performance.now()};
  },
  staleTime:30000,refetchOnWindowFocus:true,refetchInterval:60000,
 });
}
