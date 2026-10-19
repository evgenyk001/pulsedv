import React from 'react';
import {Minus,Plus,RotateCw} from 'lucide-react';
import {PropertyRecord} from '../helpers/propertyTypes';
import {getMapConfig} from '../endpoints/map_config_GET.schema';
import {createPropertyMap,type Coordinates,type MapMarker,type PropertyMapAdapter} from '../helpers/propertyMapAdapter';
import styles from './PropertyMap.module.css';

type PropertyMapProps={
 properties:PropertyRecord[];
 selectedId?:string;
 onSelect:(id:string)=>void;
 onOpen?:(id:string)=>void;
 onShowList?:()=>void;
 immersive?:boolean;
 city?:string;
};
const located=(p:PropertyRecord)=>Number.isFinite(p.longitude)&&Number.isFinite(p.latitude)&&Math.abs(p.longitude!)<=180&&Math.abs(p.latitude!)<=90;
const coordinates=(p:PropertyRecord):Coordinates=>[p.longitude!,p.latitude!];
const price=(p:PropertyRecord)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:6}).format(p.priceFrom);

export function PropertyMap({properties,selectedId,onSelect,onOpen,onShowList,immersive=false,city}:PropertyMapProps){
 const nodeRef=React.useRef<HTMLDivElement>(null);
 const mapRef=React.useRef<PropertyMapAdapter|null>(null);
 const markersRef=React.useRef<Array<{id:string;root:HTMLDivElement;pin:HTMLButtonElement;marker:MapMarker}>>([]);
 const [status,setStatus]=React.useState<'loading'|'ready'|'error'>('loading');
 const [provider,setProvider]=React.useState('');
 const [attempt,setAttempt]=React.useState(0);
 const selectRef=React.useRef(onSelect);selectRef.current=onSelect;
 const openRef=React.useRef(onOpen);openRef.current=onOpen;
 const selectedRef=React.useRef(selectedId);selectedRef.current=selectedId;
 const initialRef=React.useRef<Coordinates>([131.91,43.12]);
 const first=properties.find(p=>located(p)&&(!city||p.city===city));
 if(first)initialRef.current=coordinates(first);

 React.useEffect(()=>{
  const controller=new AbortController();
  const init=async()=>{
   try{
    setStatus('loading');
    const config=await getMapConfig();
    if(controller.signal.aborted||!nodeRef.current)return;
    setProvider(config.provider==='yandex'?'Яндекс Карты':'2ГИС');
    const map=await createPropertyMap(config,nodeRef.current,initialRef.current,controller.signal);
    if(controller.signal.aborted){map.destroy();return;}
    mapRef.current=map;setStatus('ready');
   }catch{
    if(!controller.signal.aborted)setStatus('error');
   }
  };
  void init();
  return()=>{
   controller.abort();
   markersRef.current.forEach(item=>item.marker.destroy());markersRef.current=[];
   mapRef.current?.destroy();mapRef.current=null;
  };
 },[attempt]);

 React.useEffect(()=>{
  const map=mapRef.current;
  if(!map||status!=='ready')return;
  markersRef.current.forEach(item=>item.marker.destroy());markersRef.current=[];
  const visible=properties.filter(p=>located(p)&&(!city||p.city===city));
  for(const property of visible){
   const active=property.id===selectedRef.current;
   const root=document.createElement('div');root.className=styles.marker;
   const pin=document.createElement('button');pin.type='button';pin.className=styles.pricePin;
   pin.setAttribute('aria-label',`${property.name}, от ${price(property)} млн рублей`);
   const label=document.createElement('span');label.textContent='от '+price(property)+' млн';
   const tip=document.createElement('i');tip.setAttribute('aria-hidden','true');
   pin.append(label,tip);
   pin.addEventListener('click',event=>{event.stopPropagation();selectRef.current(property.id)});
   const card=document.createElement('button');card.type='button';card.className=styles.previewCard;
   card.setAttribute('aria-label','Открыть '+property.name);
   const image=property.coverImageUrl?document.createElement('img'):document.createElement('span');
   if(image instanceof HTMLImageElement){image.src=property.coverImageUrl!;image.alt='';image.loading='lazy';}
   else{image.textContent='PULSE';image.className=styles.placeholder;}
   const copy=document.createElement('span');copy.className=styles.cardCopy;
   const meta=document.createElement('small');meta.textContent=property.city+' · '+property.district;
   const name=document.createElement('strong');name.textContent=property.name;
   const detail=document.createElement('em');detail.textContent=(property.delivery||'Новостройка')+' · от '+price(property)+' млн ₽';
   const open=document.createElement('b');open.textContent='Открыть ЖК →';
   copy.append(meta,name,detail,open);card.append(image,copy);
   card.addEventListener('click',event=>{event.stopPropagation();(openRef.current??selectRef.current)(property.id)});
   root.append(pin,card);
   const marker=map.addMarker(coordinates(property),root,active?2100:2000);
   markersRef.current.push({id:property.id,root,pin,marker});
  }
  map.fit(visible.map(coordinates));
 },[properties,city,status]);

 React.useEffect(()=>{
  const map=mapRef.current;
  if(!map||status!=='ready')return;
  for(const item of markersRef.current){
   const active=item.id===selectedId;
   item.root.classList.toggle(styles.markerActive,active);
   item.pin.classList.toggle(styles.pricePinActive,active);
   item.pin.setAttribute('aria-pressed',String(active));
   item.marker.setZIndex(active?2100:2000);
  }
  const selected=properties.find(p=>p.id===selectedId&&located(p)&&(!city||p.city===city));
  if(selected)map.center(coordinates(selected));
 },[selectedId,properties,city,status]);

 React.useEffect(()=>{if(status==='ready')mapRef.current?.tilt(immersive)},[immersive,status]);

 return <div className={styles.wrap} aria-busy={status==='loading'}>
  <div ref={nodeRef} className={styles.map} data-allow-pinch-zoom="true" aria-label={`Интерактивная карта${provider?' '+provider:''} с новостройками`}/>
  {status==='loading'&&<div className={styles.state} role="status">Загружаем карту…</div>}
  {status==='error'&&<div className={styles.state} role="status"><strong>Не удалось открыть карту</strong><span>Проверьте соединение или продолжите выбирать квартиры в списке.</span><div className={styles.stateActions}><button type="button" onClick={()=>setAttempt(value=>value+1)}><RotateCw size={15}/>Попробовать снова</button>{onShowList&&<button type="button" onClick={onShowList}>Открыть список ЖК</button>}</div></div>}
  {status==='ready'&&<div className={styles.zoomControls} role="group" aria-label="Масштаб карты"><button type="button" aria-label="Увеличить карту" onClick={()=>mapRef.current?.zoom(1)}><Plus size={20}/></button><button type="button" aria-label="Уменьшить карту" onClick={()=>mapRef.current?.zoom(-1)}><Minus size={20}/></button></div>}
 </div>;
}
