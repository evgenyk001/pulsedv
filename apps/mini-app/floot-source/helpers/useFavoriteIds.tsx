import React from "react";

const KEY="pulse.dv.favorites.v1";

function readIds(){
  if(typeof window==="undefined")return [] as string[];
  try{
    const value=JSON.parse(window.localStorage.getItem(KEY)||"[]");
    return Array.isArray(value)?value.filter(x=>typeof x==="string"):[];
  }catch{return [];}
}

export function useFavoriteIds(){
  const [ids,setIds]=React.useState<string[]>(readIds);
  React.useEffect(()=>{
    const sync=()=>setIds(readIds());
    window.addEventListener("pulse-favorites",sync);
    window.addEventListener("storage",sync);
    return()=>{window.removeEventListener("pulse-favorites",sync);window.removeEventListener("storage",sync)};
  },[]);
  const toggle=React.useCallback((id:string)=>{
    const current=readIds();
    const next=current.includes(id)?current.filter(x=>x!==id):[...current,id];
    window.localStorage.setItem(KEY,JSON.stringify(next));
    window.dispatchEvent(new Event("pulse-favorites"));
    setIds(next);
  },[]);
  return {ids,toggle,isFavorite:(id:string)=>ids.includes(id)};
}