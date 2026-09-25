import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPulseState, subscribePulseState } from "../../../../packages/pulse-data";

export const PROPERTIES_QUERY_KEY=["properties"] as const;
export function useProperties(){
  const client=useQueryClient();
  React.useEffect(()=>subscribePulseState(()=>client.invalidateQueries({queryKey:PROPERTIES_QUERY_KEY})),[client]);
  return useQuery({
    queryKey:PROPERTIES_QUERY_KEY,
    queryFn:async()=>getPulseState().properties.filter(property=>property.status==="published"),
    staleTime:Infinity
  });
}
