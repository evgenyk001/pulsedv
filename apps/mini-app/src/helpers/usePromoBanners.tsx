import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPulseState, subscribePulseState, type PulseBanner } from "../../../../packages/pulse-data";

export type PromoBanner=PulseBanner;

export function usePromoBanners(){
  const client=useQueryClient();
  React.useEffect(()=>subscribePulseState(()=>client.invalidateQueries({queryKey:["promo-banners"]})),[client]);
  return useQuery<PromoBanner[]>({
    queryKey:["promo-banners"],
    queryFn:async()=>{const now=Date.now();return getPulseState().banners.filter(banner=>banner.enabled&&(!banner.startsAt||Date.parse(banner.startsAt)<=now)&&(!banner.endsAt||Date.parse(banner.endsAt)>now)).sort((a,b)=>a.sortOrder-b.sortOrder)},
    staleTime:Infinity
  });
}
