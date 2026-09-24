import { useQuery } from "@tanstack/react-query";
import { MOCK_PROPERTIES } from "./mockData";
export function usePriceBounds(){
  return useQuery({queryKey:["price-bounds"],queryFn:async()=>{
    const prices=MOCK_PROPERTIES.flatMap(p=>p.floorplans.map(x=>x.priceFrom).filter((x):x is number=>x!=null)).map(x=>x*1_000_000);
    return {minPriceRub:Math.min(...prices),maxPriceRub:Math.max(...prices),stepRub:100_000};
  },staleTime:Infinity});
}
