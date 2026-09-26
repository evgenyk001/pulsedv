import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  getCatalogMeta,getCatalogPage,getFeaturedProperties,getMapProperties,getPropertiesByIds,getPropertyDetail,getSelectionProperties,
  type CatalogFilters
} from "./catalogApi";

export function useFeaturedProperties(limit=3){
  return useQuery({queryKey:["catalog","featured",limit],queryFn:()=>getFeaturedProperties(limit),staleTime:60_000});
}

export function useFavoriteProperties(ids:string[]){
  const stable=[...ids].sort();
  return useQuery({
    queryKey:["catalog","favorites",stable],
    queryFn:()=>getPropertiesByIds(ids),
    enabled:ids.length>0,
    staleTime:30_000,
    initialData:ids.length?undefined:[],
  });
}

export function useSelectionProperties(){
  return useQuery({queryKey:["catalog","selection"],queryFn:getSelectionProperties,staleTime:60_000});
}

export function usePropertyDetail(id:string){
  return useQuery({
    queryKey:["catalog","property",id],
    queryFn:()=>getPropertyDetail(id),
    enabled:!!id,
    staleTime:60_000,
  });
}

export function useCatalogMeta(){
  return useQuery({queryKey:["catalog","meta"],queryFn:getCatalogMeta,staleTime:60_000});
}

export function useCatalogInfinite(filters:Omit<CatalogFilters,"page">){
  return useInfiniteQuery({
    queryKey:["catalog","list",filters],
    initialPageParam:1,
    queryFn:({pageParam})=>getCatalogPage({...filters,page:pageParam}),
    getNextPageParam:last=>last.hasMore?last.page+1:undefined,
    staleTime:30_000,
  });
}

export function useMapCatalog(filters:Omit<CatalogFilters,"page"|"limit"|"view">){
  return useQuery({
    queryKey:["catalog","map",filters],
    queryFn:()=>getMapProperties(filters),
    staleTime:30_000,
  });
}
