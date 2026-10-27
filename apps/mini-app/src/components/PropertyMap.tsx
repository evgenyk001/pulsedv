import React from 'react';
import {ArrowUpRight,Building2,Heart,MapPin,Minus,Plus,RotateCw,X} from 'lucide-react';
import {PropertyRecord} from '../helpers/propertyTypes';
import {useFavoriteIds} from '../helpers/useFavoriteIds';
import {catalogImageVariant} from '../../../../packages/domain/propertyPresentation';
import Supercluster,{type ClusterProperties} from 'supercluster';
import {getMapConfig} from '../endpoints/map_config_GET.schema';
import {createPropertyMap,type Coordinates,type MapMarker,type PropertyMapAdapter} from '../helpers/propertyMapAdapter';
import styles from './PropertyMap.module.css';

type PropertyMapProps={
 properties:PropertyRecord[];
 selectedId?:string;
 onSelect:(id:string|undefined)=>void;
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
 const markersRef=React.useRef<Array<{ids:string[];root:HTMLDivElement;pin:HTMLButtonElement;marker:MapMarker}>>([]);
 const mapPointer=React.useRef({x:0,y:0,moved:false});
 const [status,setStatus]=React.useState<'loading'|'ready'|'error'>('loading');
 const [provider,setProvider]=React.useState('');
 const [attempt,setAttempt]=React.useState(0);
 const selectRef=React.useRef(onSelect);selectRef.current=onSelect;
 const {isFavorite,toggle,error:favoriteError}=useFavoriteIds();
 const previewRef=React.useRef<HTMLElement>(null);
 const [previewBottom,setPreviewBottom]=React.useState(72);
 const [zoom,setZoom]=React.useState(11);
 const [groupIds,setGroupIds]=React.useState<string[]>([]);
 const visible=React.useMemo(()=>properties.filter(p=>located(p)&&(!city||p.city===city)),[properties,city]);
 const fitKey=visible.map(p=>`${p.id}:${p.longitude}:${p.latitude}`).join('|');
 const index=React.useMemo(()=>new Supercluster<{id:string}>({radius:100,extent:256,maxZoom:19,minZoom:5}).load(visible.map(p=>({type:'Feature' as const,geometry:{type:'Point' as const,coordinates:coordinates(p)},properties:{id:p.id}}))),[visible]);
 const group=visible.filter(p=>groupIds.includes(p.id));
 const [failedImage,setFailedImage]=React.useState<string>();
 const selected=properties.find(p=>p.id===selectedId&&located(p)&&(!city||p.city===city));
 const image=selected?.coverImageUrl||selected?.images[0]?.url;
 const saved=selected?isFavorite(selected.id):false;
 const badges=selected?[...new Set([...selected.tags,...selected.features.map(feature=>feature.label)])].filter(Boolean).slice(0,2):[];
 const selectedRef=React.useRef(selectedId);selectedRef.current=selectedId;
 const initialRef=React.useRef<Coordinates>([131.91,43.12]);
 const first=properties.find(p=>located(p)&&(!city||p.city===city));
 if(first)initialRef.current=coordinates(first);

 React.useLayoutEffect(()=>{
  const node=nodeRef.current;if(!node)return;
  let frame=0;
  const measure=()=>{
   cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
    const viewport=window.visualViewport;
    const bottom=(viewport?.height??window.innerHeight)+(viewport?.offsetTop??0);
    setPreviewBottom(Math.max(45,Math.round(node.getBoundingClientRect().bottom-bottom+110)));
   });
  };
  const resize=new ResizeObserver(measure);resize.observe(node);measure();
  window.addEventListener('scroll',measure,{passive:true,capture:true});window.addEventListener('resize',measure);
  window.visualViewport?.addEventListener('resize',measure);
  return()=>{cancelAnimationFrame(frame);resize.disconnect();window.removeEventListener('scroll',measure,true);window.removeEventListener('resize',measure);window.visualViewport?.removeEventListener('resize',measure);};
 },[]);

 React.useEffect(()=>{
  const controller=new AbortController();
  let unsubscribeZoom:(()=>void)|undefined;
  const init=async()=>{
   try{
    setStatus('loading');
    const config=await getMapConfig();
    if(controller.signal.aborted||!nodeRef.current)return;
    setProvider(config.provider==='yandex'?'Яндекс Карты':'2ГИС');
    const map=await createPropertyMap(config,nodeRef.current,initialRef.current,controller.signal);
    if(controller.signal.aborted){map.destroy();return;}
    mapRef.current=map;
    const updateZoom=(value:number)=>setZoom(Math.max(5,Math.min(19,Math.floor(value))));
    updateZoom(map.getZoom());unsubscribeZoom=map.onZoom(updateZoom);
    setStatus('ready');
   }catch{
    if(!controller.signal.aborted)setStatus('error');
   }
  };
  void init();
  return()=>{
   controller.abort();
   unsubscribeZoom?.();
   markersRef.current.forEach(item=>item.marker.destroy());markersRef.current=[];
   mapRef.current?.destroy();mapRef.current=null;
  };
 },[attempt]);

 React.useEffect(()=>{
  const map=mapRef.current;
  if(!map||status!=='ready')return;
  markersRef.current.forEach(item=>item.marker.destroy());markersRef.current=[];
  const byId=new Map(visible.map(p=>[p.id,p]));
  for(const feature of index.getClusters([-180,-90,180,90],zoom)){
   const clustered='cluster' in feature.properties&&feature.properties.cluster;
   const clusterId=clustered?(feature.properties as ClusterProperties).cluster_id:undefined;
   const ids=clusterId===undefined?[(feature.properties as {id:string}).id]:index.getLeaves(clusterId,Infinity).map(point=>point.properties.id);
   const property=byId.get(ids[0])!;
   const active=ids.includes(selectedRef.current??'');
   const root=document.createElement('div');root.className=styles.marker;
   const pin=document.createElement('button');pin.type='button';pin.className=clustered?styles.clusterPin:styles.pricePin;
   pin.classList.toggle(styles.pricePinActive,active);
   pin.setAttribute('aria-pressed',String(active));
   pin.setAttribute('aria-expanded',String(active));
   pin.setAttribute('aria-label',clustered?`Показать группу из ${ids.length} ЖК`:`${property.name}, от ${price(property)} млн рублей`);
   const label=document.createElement('span');label.textContent=clustered?String(ids.length):'от '+price(property)+' млн';
   const tip=document.createElement('i');tip.setAttribute('aria-hidden','true');
   pin.append(label,tip);
   if(clustered){const unit=document.createElement('small');unit.textContent='ЖК';pin.append(unit);}
   pin.addEventListener('click',event=>{
    event.stopPropagation();setGroupIds([]);
    if(clusterId!==undefined){
     selectRef.current(undefined);
     const nextZoom=index.getClusterExpansionZoom(clusterId);
     if(nextZoom>19){setGroupIds(ids);return;}
     map.expand(feature.geometry.coordinates as Coordinates,Math.max(zoom+1,nextZoom));
    }else selectRef.current(property.id);
   });
   pin.setAttribute('aria-controls','map-project-preview');
   root.append(pin);
   if(clustered)root.classList.add(styles.clusterMarker);
   const marker=map.addMarker(feature.geometry.coordinates as Coordinates,root,active?2100:2000);
   markersRef.current.push({ids,root,pin,marker});
  }
 },[index,visible,zoom,status]);

 React.useEffect(()=>{
  if(status==='ready')mapRef.current?.fit(visible.map(coordinates));
  setGroupIds([]);
 },[fitKey,status]);

 React.useEffect(()=>{
  const map=mapRef.current;
  if(!map||status!=='ready')return;
  for(const item of markersRef.current){
   const active=item.ids.includes(selectedId??'');
   item.pin.classList.toggle(styles.pricePinActive,active);
   item.pin.setAttribute('aria-pressed',String(active));
   item.pin.setAttribute('aria-expanded',String(active));
   item.marker.setZIndex(active?2100:2000);
  }
  const selected=properties.find(p=>p.id===selectedId&&located(p)&&(!city||p.city===city));
  if(selected){
   const preview=previewRef.current;
   const inset=preview?preview.offsetHeight+previewBottom+16:45;
   map.center(coordinates(selected),Math.min(inset,(nodeRef.current?.clientHeight??600)-120));
  }else map.resetInset();
 },[selectedId,properties,city,status,previewBottom]);

 React.useEffect(()=>{if(status==='ready')mapRef.current?.tilt(immersive)},[immersive,status]);

 const closePreview=()=>{
  const pin=markersRef.current.find(item=>item.ids.includes(selectedId??''))?.pin;
  onSelect(undefined);pin?.focus({preventScroll:true});
 };
 React.useEffect(()=>{
  if(!selected&&!groupIds.length)return;
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setGroupIds([]);selectRef.current(undefined);markersRef.current.find(item=>item.ids.includes(selected?.id??groupIds[0]))?.pin.focus({preventScroll:true});}};
  window.addEventListener('keydown',escape);
  return()=>window.removeEventListener('keydown',escape);
 },[selected?.id,groupIds]);

 return <div className={styles.wrap} style={{'--map-preview-bottom':previewBottom+'px'} as React.CSSProperties} aria-busy={status==='loading'}>
  <div ref={nodeRef} className={styles.map} data-allow-pinch-zoom="true"
   onPointerDownCapture={event=>{mapPointer.current={x:event.clientX,y:event.clientY,moved:false}}}
   onPointerMoveCapture={event=>{if(Math.hypot(event.clientX-mapPointer.current.x,event.clientY-mapPointer.current.y)>8)mapPointer.current.moved=true}}
   onClickCapture={event=>{
    const target=event.target instanceof Element?event.target:null;
    if(mapPointer.current.moved||target?.closest('button,a,[role="button"]'))return;
    onSelect(undefined);setGroupIds([]);
   }} aria-label={`Интерактивная карта${provider?' '+provider:''} с новостройками`}/>
  {status==='loading'&&<div className={styles.state} role="status">Загружаем карту…</div>}
  {status==='error'&&<div className={styles.state} role="status"><strong>Не удалось открыть карту</strong><div className={styles.stateActions}><button type="button" onClick={()=>setAttempt(value=>value+1)}><RotateCw size={15}/>Попробовать снова</button>{onShowList&&<button type="button" onClick={onShowList}>Открыть список ЖК</button>}</div></div>}
  {status==='ready'&&<div className={styles.zoomControls} role="group" aria-label="Масштаб карты"><button type="button" aria-label="Увеличить карту" onClick={()=>mapRef.current?.zoom(1)}><Plus size={20}/></button><button type="button" aria-label="Уменьшить карту" onClick={()=>mapRef.current?.zoom(-1)}><Minus size={20}/></button></div>}
  {status==='ready'&&selected&&<article ref={previewRef} key={selected.id} id="map-project-preview" className={styles.previewCard} aria-label={selected.name}>
   <div className={styles.previewHero}>
    {image&&failedImage!==image?<img src={catalogImageVariant(image,'card')} alt="" decoding="async" onError={event=>{if(event.currentTarget.getAttribute('src')!==image)event.currentTarget.src=image;else setFailedImage(image)}}/>:<div className={styles.imageFallback}><Building2 size={40}/><span>PULSEDV.RU</span></div>}
    <div className={styles.heroShade}/>
    {selected.className&&<span className={styles.classBadge}>{selected.className}</span>}
    <div className={styles.heroActions}>
     <button type="button" className={saved?styles.saved:''} aria-label={saved?'Убрать из избранного':'Добавить в избранное'} aria-pressed={saved} onClick={()=>toggle(selected.id)}><Heart size={19} fill={saved?'currentColor':'none'}/></button>
     <button type="button" aria-label="Закрыть карточку ЖК" onClick={closePreview}><X size={19}/></button>
    </div>
    <div className={styles.heroCopy}><h2>{selected.name}</h2><p><MapPin size={12}/>{[selected.city,selected.district].filter(Boolean).join(' · ')}</p></div>
   </div>
   <div className={styles.previewBody}>
    <div className={styles.previewFacts}><div><span>Стоимость квартиры</span><strong>от {price(selected)} <small>млн ₽</small></strong></div>{selected.delivery&&<div className={styles.delivery}><span>Срок сдачи</span><b>{selected.delivery}</b></div>}</div>
    {badges.length>0&&<div className={styles.features}>{badges.map(badge=><span key={badge}>{badge}</span>)}</div>}
    {favoriteError&&<p className={styles.favoriteError} role="status">{favoriteError}</p>}
    <button type="button" className={styles.openProject} aria-label={'Открыть '+selected.name} onClick={()=>(onOpen??onSelect)(selected.id)}><span>Смотреть ЖК</span><ArrowUpRight size={19}/></button>
   </div>
  </article>}
  {status==='ready'&&!selected&&group.length>1&&<section className={`${styles.previewCard} ${styles.groupCard}`} aria-label="ЖК в одной точке">
   <div className={styles.groupHeader}><div><strong>{group.length} ЖК рядом</strong><span>Выберите проект, чтобы посмотреть детали</span></div><button type="button" aria-label="Закрыть группу ЖК" onClick={()=>setGroupIds([])}><X size={19}/></button></div>
   <div className={styles.groupList}>{group.map(property=><button type="button" key={property.id} onClick={()=>{setGroupIds([]);onSelect(property.id)}}><span><b>{property.name}</b><small>{property.city} · {property.district}</small></span><strong>от {price(property)} млн ₽</strong></button>)}</div>
  </section>}
 </div>;
}
