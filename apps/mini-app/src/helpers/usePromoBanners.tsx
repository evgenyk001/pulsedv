import { useQuery } from "@tanstack/react-query";
import { getPromoBanners } from "../endpoints/promo_banners_GET.schema";

export const PROMO_BANNERS_QUERY_KEY=["promo-banners"] as const;

export function usePromoBanners(){
  return useQuery({
    queryKey:PROMO_BANNERS_QUERY_KEY,
    queryFn:async()=>(await getPromoBanners()).banners,
    staleTime:60_000,
  });
}