import { useQuery } from "@tanstack/react-query";

export function usePromoBanners(){
  return useQuery({queryKey:["promo-banners"],queryFn:async()=>[],staleTime:Infinity});
}
