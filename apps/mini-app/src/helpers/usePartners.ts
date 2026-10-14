import React from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {getPartnerCabinet,subscribePartners} from '../../../../packages/partners/client';
export function usePartners(page=1){const client=useQueryClient();React.useEffect(()=>subscribePartners(()=>{void client.invalidateQueries({queryKey:['partner-cabinet']})}),[client]);return useQuery({queryKey:['partner-cabinet',page],queryFn:()=>getPartnerCabinet(page),refetchInterval:30000,refetchOnWindowFocus:true});}
