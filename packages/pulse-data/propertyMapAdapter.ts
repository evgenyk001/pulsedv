import type * as Yandex from '@yandex/ymaps3-types';
import type {MapConfig} from './mapConfig';

export type Coordinates=[number,number];
export type MapMarker={destroy:()=>void;setZIndex:(value:number)=>void};
export type PropertyMapAdapter={
 onPick:(callback:(coordinates:Coordinates)=>void)=>()=>void;
 addMarker:(coordinates:Coordinates,element:HTMLElement,zIndex:number)=>MapMarker;
 fit:(coordinates:Coordinates[])=>void;
 center:(coordinates:Coordinates,bottomInset?:number)=>void;
 expand:(coordinates:Coordinates,zoom:number)=>void;
 getZoom:()=>number;
 onZoom:(callback:(zoom:number)=>void)=>()=>void;
 resetInset:()=>void;
 zoom:(delta:number)=>void;
 tilt:(immersive:boolean)=>void;
 destroy:()=>void;
};

type YandexSdk=typeof Yandex;
type OpenMapsModule=typeof import('@yandex/ymaps3-types/modules/controls-extra');
let yandexLoad:{key:string;promise:Promise<{sdk:YandexSdk;extra:OpenMapsModule}>}|undefined;

function loadYandex(key:string){
 if(yandexLoad){
  if(yandexLoad.key!==key)return Promise.reject(new Error('Обновите страницу, чтобы загрузить настройки карты.'));
  return yandexLoad.promise;
 }
 const promise=new Promise<{sdk:YandexSdk;extra:OpenMapsModule}>((resolve,reject)=>{
  let script:HTMLScriptElement|undefined;
  let finished=false;
  const fail=()=>{
   if(finished)return;
   finished=true;clearTimeout(timer);script?.remove();
   reject(new Error('Не удалось загрузить карту. Проверьте соединение и попробуйте снова.'));
  };
  const timer=window.setTimeout(fail,18000);
  const ready=async()=>{
   try{
    const sdk=(window as Window&{ymaps3?:YandexSdk}).ymaps3;
    if(!sdk)throw new Error('Map SDK unavailable');
    await sdk.ready;
    const extra=await sdk.import('@yandex/ymaps3-controls-extra');
    if(finished)return;
    finished=true;clearTimeout(timer);resolve({sdk,extra});
   }catch{fail();}
  };
  if((window as Window&{ymaps3?:YandexSdk}).ymaps3){void ready();return;}
  script=document.createElement('script');
  script.src='https://api-maps.yandex.ru/v3/?'+new URLSearchParams({apikey:key,lang:'ru_RU'});
  script.async=true;script.dataset.pulseMap='yandex';
  script.onload=()=>void ready();script.onerror=fail;
  document.head.append(script);
 });
 const entry={key,promise};yandexLoad=entry;
 void promise.catch(()=>{if(yandexLoad===entry)yandexLoad=undefined;});
 return promise;
}

const duration=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:360;
const abort=()=>new DOMException('Map initialization cancelled','AbortError');

export async function createPropertyMap(config:MapConfig,node:HTMLElement,initial:Coordinates,signal:AbortSignal):Promise<PropertyMapAdapter>{
 if(config.provider==='yandex'){
  const {sdk,extra}=await loadYandex(config.key);
  if(signal.aborted)throw abort();
  const map=new sdk.YMap(node,{
   location:{center:initial,zoom:11.2},zoomRange:{min:5,max:19},
   margin:[70,35,45,35],copyrightsPosition:'bottom left',
  });
  try{
   map.addChild(new sdk.YMapDefaultSchemeLayer({}));
   map.addChild(new sdk.YMapDefaultFeaturesLayer({}));
   map.addChild(new sdk.YMapControls({position:'top right'})
    .addChild(new extra.YMapOpenMapsButton({title:'Открыть в Картах'})));
  }catch(error){map.destroy();throw error;}
  return {
   onPick(callback){
    const listener=new sdk.YMapListener({layer:'any',onClick:(_object,event)=>callback([event.coordinates[0],event.coordinates[1]])});
    map.addChild(listener);return()=>{map.removeChild(listener)};
   },
   addMarker(coordinates,element,zIndex){
    const marker=new sdk.YMapMarker({coordinates,zIndex},element);map.addChild(marker);
    return {destroy:()=>map.removeChild(marker),setZIndex:value=>marker.update({zIndex:value})};
   },
   fit(coordinates){
    if(!coordinates.length)return;
    const xs=coordinates.map(c=>c[0]),ys=coordinates.map(c=>c[1]);
    // Identical coordinates need a center/zoom, not a zero-area bounds request.
    if(Math.max(...xs)-Math.min(...xs)<.00001&&Math.max(...ys)-Math.min(...ys)<.00001){
     map.setLocation({center:coordinates[0],zoom:13.2,duration:duration()});return;
    }
    map.setLocation({bounds:[[Math.min(...xs),Math.min(...ys)],[Math.max(...xs),Math.max(...ys)]],duration:duration()});
   },
   center(coordinates,bottomInset=45){
    map.setMargin([70,35,bottomInset,35]);
    map.setLocation({center:coordinates,duration:duration()});
   },
   expand(coordinates,zoom){map.setMargin([70,35,45,35]);map.setLocation({center:coordinates,zoom,duration:duration()});},
   getZoom:()=>map.zoom,
   resetInset:()=>map.setMargin([70,35,45,35]),
   onZoom(callback){
    const listener=new sdk.YMapListener({onUpdate:({location})=>callback(location.zoom)});
    map.addChild(listener);
    return()=>map.removeChild(listener);
   },
   zoom:delta=>map.setLocation({zoom:Math.max(5,Math.min(19,map.zoom+delta)),duration:duration()}),
   tilt:immersive=>map.setCamera({tilt:immersive?38*Math.PI/180:0,duration:duration()}),
   destroy:()=>map.destroy(),
  };
 }
 const {load}=await import('@2gis/mapgl');
 const sdk=await load();
 if(signal.aborted)throw abort();
 const map=new sdk.Map(node,{
  key:config.key,center:initial,zoom:11.2,lang:'ru',copyright:'bottomLeft',
  enableTrackResize:true,maxPitch:55,lowZoomMaxPitch:35,defaultBackgroundColor:'#E7ECEF',
  controlsLayoutPadding:{left:10,bottom:10,right:10,top:10},
 });
 return {
  onPick(callback){
   const handler=(event:{lngLat:number[]})=>callback([event.lngLat[0],event.lngLat[1]]);
   map.on('click',handler);return()=>{map.off('click',handler)};
  },
  addMarker(coordinates,element,zIndex){
   const marker=new sdk.HtmlMarker(map,{coordinates,html:element,interactive:true,anchor:[0,0],zIndex});
   return {destroy:()=>marker.destroy(),setZIndex:value=>marker.setZIndex(value)};
  },
  fit(coordinates){
   if(!coordinates.length)return;
   if(coordinates.length===1){map.setCenter(coordinates[0],{animate:duration()>0,duration:duration()});map.setZoom(13.2);return;}
   const xs=coordinates.map(c=>c[0]),ys=coordinates.map(c=>c[1]);
   map.fitBounds({northEast:[Math.max(...xs),Math.max(...ys)],southWest:[Math.min(...xs),Math.min(...ys)]},
    {maxZoom:13.1,padding:{top:70,right:35,bottom:45,left:35},animation:{animate:duration()>0,duration:duration()}});
  },
  center(coordinates,bottomInset=45){
   map.setPadding({top:70,right:35,bottom:bottomInset,left:35});
   map.setCenter(coordinates,{animate:duration()>0,duration:duration()});
  },
  expand(coordinates,zoom){map.setPadding({top:70,right:35,bottom:45,left:35});map.setCenter(coordinates,{animate:duration()>0,duration:duration()});map.setZoom(zoom);},
  getZoom:()=>map.getZoom(),
  resetInset:()=>{map.setPadding({top:70,right:35,bottom:45,left:35});},
  onZoom(callback){const update=()=>callback(map.getZoom());map.on('zoom',update);return()=>{map.off('zoom',update)};},
  zoom:delta=>map.setZoom(Math.max(5,Math.min(19,map.getZoom()+delta)),{animate:duration()>0,duration:duration()}),
  tilt:immersive=>map.setPitch(immersive?38:0,{animate:duration()>0,duration:duration()}),
  destroy:()=>map.destroy(),
 };
}
