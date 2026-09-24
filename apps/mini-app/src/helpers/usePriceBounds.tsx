import { useQuery } from "@tanstack/react-query";
import { getPriceBounds } from "../endpoints/price_bounds_GET.schema";

export const PRICE_BOUNDS_QUERY_KEY=["price-bounds"] as const;

export function usePriceBounds(){
  return useQuery({
    queryKey:PRICE_BOUNDS_QUERY_KEY,
    queryFn:getPriceBounds,
    staleTime:60_000,
  });
}