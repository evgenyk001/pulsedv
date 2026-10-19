import { api, runtime } from '../../../../packages/pulse-data/runtime';
import {configuredMap,type MapConfig} from '../../../../packages/pulse-data/mapConfig';
export type OutputType=MapConfig;
export async function getMapConfig():Promise<OutputType>{
 if(runtime.enabled)return api('/public/map');
 const config=configuredMap({yandex:import.meta.env.VITE_YANDEX_MAPS_KEY,twoGis:import.meta.env.VITE_2GIS_KEY});
 if(config)return config;
 // Static preview uses a public, domain-restricted browser key. VPS always uses the API above.
 const controller=new AbortController();
 const timer=window.setTimeout(()=>controller.abort(),6000);
 try{
  const response=await fetch(import.meta.env.BASE_URL+'map-config.json',{cache:'no-store',signal:controller.signal});
  if(response.ok){
   const value:unknown=await response.json();
   if(value&&typeof value==='object'&&'provider' in value&&'key' in value&&
    (value.provider==='yandex'||value.provider==='2gis')&&typeof value.key==='string'&&value.key.trim()){
    return {provider:value.provider,key:value.key.trim()};
   }
  }
 }finally{clearTimeout(timer);}
 throw new Error('Карта пока недоступна. Посмотрите объекты в каталоге.');
}
