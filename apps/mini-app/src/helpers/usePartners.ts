import React from 'react';
import {useQuery,useQueryClient,keepPreviousData} from '@tanstack/react-query';
import {getPartnerCabinet,subscribePartners} from '../../../../packages/partners/client';
import {subscribePartnerReturn} from '../../../../packages/partners/refresh';
export function usePartners(page=1,tab='clients'){
 const client=useQueryClient();
 React.useEffect(()=>{const update=()=>{void client.invalidateQueries({queryKey:['partner-cabinet']})},unsubscribe=subscribePartners(update),returned=subscribePartnerReturn(update);return()=>{unsubscribe();returned()}},[client]);
 return useQuery({queryKey:['partner-cabinet',page,tab],queryFn:()=>getPartnerCabinet(page,tab==='payments'?'payments':'all'),placeholderData:keepPreviousData,staleTime:Infinity,refetchInterval:false,refetchOnWindowFocus:false,refetchOnReconnect:false,refetchOnMount:'always'});
}
