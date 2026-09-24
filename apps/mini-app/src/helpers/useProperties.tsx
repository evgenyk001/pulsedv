import { useQuery } from "@tanstack/react-query";
import { MOCK_PROPERTIES } from "./mockData";
export const PROPERTIES_QUERY_KEY=["properties"] as const;
export function useProperties(){
  return useQuery({queryKey:PROPERTIES_QUERY_KEY,queryFn:async()=>MOCK_PROPERTIES,staleTime:Infinity});
}
