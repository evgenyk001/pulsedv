import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPulseState, subscribePulseState, type PulseBanner } from "../../../../packages/pulse-data";

export type PromoBanner=PulseBanner;

export function usePromoBanners(){
  const client=useQueryClient();
  React.useEffect(()=>subscribePulseState(()=>client.invalidateQueries({queryKey:["promo-banners"]})),[client]);
  return useQuery<PromoBanner[]>({
    queryKey:["promo-banners"],
    queryFn:async()=>getPulseState().banners.filter(banner=>banner.enabled).sort((a,b)=>a.sortOrder-b.sortOrder),
    staleTime:Infinity
  });
}
