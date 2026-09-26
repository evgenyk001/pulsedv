import React from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { subscribePulseState } from "../../../../packages/pulse-data";
import { runtime } from "../../../../packages/pulse-data/runtime";
import {
  getCatalogMeta,getCatalogPage,getFeaturedProperties,getMapProperties,getPropertiesByIds,getPropertyDetail,getSelectionProperties,
  type CatalogFilters
} from "./catalogApi";

function useCatalogInvalidation(){
  const client=useQueryClient();
  React.useEffect(()=>{
    if(runtime.enabled)return;
    return subscribePulseState(()=>{void client.invalidateQueries({queryKey:["catalog"]})});
  },[client]);
}

export function useFeaturedProperties(limit=3){
  useCatalogInvalidation();
  return useQuery({queryKey:["catalog","featured",limit],queryFn:()=>getFeaturedProperties(limit),staleTime:60_000});
}

export function useFavoriteProperties(ids:string[]){
  useCatalogInvalidation();
  const stable=[...ids].sort();
  return useQuery({
    queryKey:["catalog","favorites",stable],
    queryFn:()=>getPropertiesByIds(ids),
    enabled:ids.length>0,
    staleTime:30_000,
  });
}

export function useSelectionProperties(enabled=true){
  useCatalogInvalidation();
  return useQuery({queryKey:["catalog","selection"],queryFn:getSelectionProperties,staleTime:60_000,enabled});
}

export function usePropertyDetail(id:string){
  useCatalogInvalidation();
  return useQuery({
    queryKey:["catalog","property",id],
    queryFn:()=>getPropertyDetail(id),
    enabled:!!id,
    staleTime:60_000,
  });
}

export function useCatalogMeta(){
  useCatalogInvalidation();
  return useQuery({queryKey:["catalog","meta"],queryFn:getCatalogMeta,staleTime:60_000});
}

export function useCatalogInfinite(filters:Omit<CatalogFilters,"page">,enabled=true){
  useCatalogInvalidation();
  return useInfiniteQuery({
    queryKey:["catalog","list",filters],
    initialPageParam:1,
    queryFn:({pageParam})=>getCatalogPage({...filters,page:pageParam}),
    getNextPageParam:last=>last.hasMore?last.page+1:undefined,
    staleTime:30_000,
    enabled,
  });
}

export function useMapCatalog(filters:Omit<CatalogFilters,"page"|"limit"|"view">,enabled=true){
  useCatalogInvalidation();
  return useQuery({
    queryKey:["catalog","map",filters],
    queryFn:()=>getMapProperties(filters),
    staleTime:30_000,
    enabled,
  });
}
