import {useQuery} from '@tanstack/react-query';
import {loadJourneys} from '../../../../packages/journey/client';
export function useClientJourneys(){return useQuery({queryKey:['my-journeys'],queryFn:()=>loadJourneys(true),staleTime:10000,refetchInterval:30000,refetchOnWindowFocus:true})}
