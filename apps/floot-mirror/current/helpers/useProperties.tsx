import { useQuery } from "@tanstack/react-query";
import { getProperties } from "../endpoints/properties_GET.schema";

export const PROPERTIES_QUERY_KEY=["properties"] as const;

export function useProperties(){
  return useQuery({
    queryKey:PROPERTIES_QUERY_KEY,
    queryFn:async()=>(await getProperties()).properties,
    staleTime:60_000,
  });
}