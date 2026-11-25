import {useEffect,useMemo,useState} from 'react';
import type {PropertyFloorplan} from './propertyTypes';

export function usePlanImageFingerprints(plans:readonly PropertyFloorplan[]|undefined,paused:boolean){
  const candidates=useMemo(()=>{
    const buckets=new Map<string,Set<string>>();
    for(const plan of plans??[]){
      if(!plan.imageUrl?.startsWith('/media/')||plan.areaFrom==null||plan.areaFrom!==plan.areaTo)continue;
      const key=JSON.stringify([plan.roomLabel,plan.areaFrom]);
      const urls=buckets.get(key)??new Set<string>();
      urls.add(plan.imageUrl);
      buckets.set(key,urls);
    }
    return [...new Set([...buckets.values()].filter(urls=>urls.size>1).flatMap(urls=>[...urls]))];
  },[plans]);
  const [result,setResult]=useState<{candidates:string[];values:Map<string,string>}>();
  const [applied,setApplied]=useState<typeof result>();
  useEffect(()=>{
    if(!candidates.length||!globalThis.crypto?.subtle)return;
    const controller=new AbortController();
    const values=new Map<string,string>();
    const queue=candidates.values();
    const read=async()=>{
      for(const url of queue){
        if(controller.signal.aborted)return;
        try{
          const response=await fetch(url,{signal:controller.signal});
          if(!response.ok||!response.headers.get('content-type')?.startsWith('image/'))continue;
          const hash=await crypto.subtle.digest('SHA-256',await response.arrayBuffer());
          values.set(url,Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join(''));
        }catch{/* Keep URL-based grouping when an image cannot be read. */}
      }
    };
    void Promise.all(Array.from({length:Math.min(4,candidates.length)},read)).then(()=>{
      if(!controller.signal.aborted)setResult({candidates,values});
    });
    return ()=>controller.abort();
  },[candidates]);
  useEffect(()=>{
    if(!paused)setApplied(result);
  },[paused,result]);
  return applied?.candidates===candidates?applied.values:undefined;
}
