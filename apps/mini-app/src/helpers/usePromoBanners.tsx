import { useQuery } from "@tanstack/react-query";

export type PromoBanner={
  id:string;
  title:string;
  body:string;
  imageUrl:string|null;
  ctaLabel:string|null;
  actionUrl:string|null;
  city:string|null;
  audience:string|null;
};

export function usePromoBanners(){
  return useQuery<PromoBanner[]>({
    queryKey:["promo-banners"],
    queryFn:async()=>[],
    staleTime:Infinity
  });
}
