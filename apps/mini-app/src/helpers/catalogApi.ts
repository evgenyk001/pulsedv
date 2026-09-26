import { getPulseState } from "../../../../packages/pulse-data";
import { api, runtime } from "../../../../packages/pulse-data/runtime";
import { hasSea, matchesBudgetAndRooms } from "../../../../packages/domain/propertyMatch";
import type { PropertyRecord } from "./propertyTypes";

export type CatalogSort="popular"|"priceAsc"|"priceDesc";
export type CatalogFilters={
  page?:number;limit?:number;q?:string;city?:string;delivery?:string;rooms?:string;sea?:boolean;
  min?:number;max?:number;sort?:CatalogSort;ids?:string[];view?:"card"|"match";
};
export type CatalogPageResult={items:PropertyRecord[];page:number;limit:number;total:number;hasMore:boolean};
export type CatalogMeta={minPriceRub:number;maxPriceRub:number;stepRub:number;total:number;cities:{city:string;count:number}[]};

const toQuery=(filters:CatalogFilters)=>{
  const params=new URLSearchParams();
  if(filters.page)params.set("page",String(filters.page));
  if(filters.limit)params.set("limit",String(filters.limit));
  if(filters.q)params.set("q",filters.q);
  if(filters.city&&filters.city!=="Все")params.set("city",filters.city);
  if(filters.delivery&&filters.delivery!=="Любой"&&filters.delivery!=="Не важно")params.set("delivery",filters.delivery);
  if(filters.rooms&&filters.rooms!=="Все")params.set("rooms",filters.rooms);
  if(filters.sea)params.set("sea","1");
  if(filters.min!==undefined)params.set("min",String(filters.min));
  if(filters.max!==undefined)params.set("max",String(filters.max));
  if(filters.sort&&filters.sort!=="popular")params.set("sort",filters.sort);
  if(filters.ids?.length)params.set("ids",filters.ids.join(","));
  if(filters.view)params.set("view",filters.view);
  return params.toString();
};

function localPage(filters:CatalogFilters):CatalogPageResult{
  const page=Math.max(1,filters.page??1);
  const limit=Math.max(1,filters.limit??20);
  const all=getPulseState().properties.filter(property=>property.status==="published");
  const q=(filters.q||"").trim().toLowerCase();
  const ids=filters.ids?.length?new Set(filters.ids):null;
  let items=all.filter(property=>{
    if(ids&&!ids.has(property.id))return false;
    if(q&&!(property.name+" "+property.city+" "+property.district+" "+property.developerName).toLowerCase().includes(q))return false;
    if(filters.city&&filters.city!=="Все"&&property.city!==filters.city)return false;
    if(filters.delivery&&filters.delivery!=="Любой"&&filters.delivery!=="Не важно"&&!property.delivery.includes(filters.delivery))return false;
    if(filters.sea&&!hasSea(property))return false;
    if((filters.rooms&&filters.rooms!=="Все")||filters.min!==undefined||filters.max!==undefined){
      if(!matchesBudgetAndRooms(property,{rooms:filters.rooms||"Все",min:filters.min??0,max:filters.max??Number.MAX_SAFE_INTEGER}))return false;
    }
    return true;
  });
  if(filters.sort==="priceAsc")items=[...items].sort((a,b)=>a.priceFrom-b.priceFrom);
  else if(filters.sort==="priceDesc")items=[...items].sort((a,b)=>b.priceFrom-a.priceFrom);
  else items=[...items].sort((a,b)=>a.sortOrder-b.sortOrder);
  const total=items.length;
  const start=(page-1)*limit;
  return {items:items.slice(start,start+limit),page,limit,total,hasMore:start+limit<total};
}

export async function getCatalogPage(filters:CatalogFilters={}):Promise<CatalogPageResult>{
  if(!runtime.enabled)return localPage(filters);
  const query=toQuery(filters);
  return api<CatalogPageResult>("/public/catalog"+(query?"?"+query:""));
}

export async function getCatalogMeta():Promise<CatalogMeta>{
  if(!runtime.enabled){
    const items=getPulseState().properties.filter(property=>property.status==="published");
    const prices=items.map(property=>property.priceFrom*1_000_000).filter(Number.isFinite);
    const counts=new Map<string,number>();
    for(const property of items)counts.set(property.city,(counts.get(property.city)||0)+1);
    return{
      minPriceRub:prices.length?Math.min(...prices):4_000_000,
      maxPriceRub:prices.length?Math.max(...prices):25_000_000,
      stepRub:100_000,total:items.length,
      cities:[...counts.entries()].map(([city,count])=>({city,count})).sort((a,b)=>a.city.localeCompare(b.city,"ru")),
    };
  }
  return api<CatalogMeta>("/public/catalog/meta");
}

export async function getPropertyDetail(id:string):Promise<PropertyRecord|null>{
  if(!runtime.enabled)return getPulseState().properties.find(property=>property.id===id&&property.status==="published")??null;
  try{return (await api<{property:PropertyRecord}>("/public/catalog/"+encodeURIComponent(id))).property}
  catch(error:any){if(error?.status===404)return null;throw error}
}

export async function getFeaturedProperties(limit=3){
  return (await getCatalogPage({page:1,limit,view:"card"})).items;
}

export async function getPropertiesByIds(ids:string[]){
  if(!ids.length)return[];
  if(!runtime.enabled)return getPulseState().properties.filter(property=>property.status==="published"&&ids.includes(property.id));
  const chunks:PropertyRecord[]=[];
  for(let index=0;index<ids.length;index+=200){
    const result=await getCatalogPage({page:1,limit:Math.min(200,ids.length-index),ids:ids.slice(index,index+200),view:"match"});
    chunks.push(...result.items);
  }
  const order=new Map(ids.map((id,index)=>[id,index]));
  return chunks.sort((a,b)=>(order.get(a.id)??9999)-(order.get(b.id)??9999));
}

export async function getSelectionProperties(){
  if(!runtime.enabled)return getPulseState().properties.filter(property=>property.status==="published");
  const first=await getCatalogPage({page:1,limit:1000,view:"match"});
  if(!first.hasMore)return first.items;
  const second=await getCatalogPage({page:2,limit:1000,view:"match"});
  return [...first.items,...second.items];
}

export async function getMapProperties(filters:Omit<CatalogFilters,"page"|"limit"|"view">={}){
  const first=await getCatalogPage({...filters,page:1,limit:1000,view:"card"});
  if(!first.hasMore)return first.items;
  const second=await getCatalogPage({...filters,page:2,limit:1000,view:"card"});
  return [...first.items,...second.items];
}
