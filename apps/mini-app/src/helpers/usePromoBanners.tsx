import { useQuery } from "@tanstack/react-query";
import { MOCK_BANNERS } from "./mockData";
export function usePromoBanners(){return useQuery({queryKey:["promo-banners"],queryFn:async()=>MOCK_BANNERS,staleTime:Infinity})}
