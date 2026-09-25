import React from "react";
import { load } from "@2gis/mapgl";
import { PropertyRecord } from "../helpers/propertyTypes";
import { getMapConfig } from "../endpoints/map_config_GET.schema";
import styles from "./PropertyMap.module.css";

type PropertyMapProps={
  properties:PropertyRecord[];
  selectedId?:string;
  onSelect:(id:string)=>void;
  onOpen?:(id:string)=>void;
  immersive?:boolean;
  city?:string;
};

type LoadedMapGL=Awaited<ReturnType<typeof load>>;
type MapInstance=InstanceType<LoadedMapGL["Map"]>;
type HtmlMarkerInstance=InstanceType<LoadedMapGL["HtmlMarker"]>;

export function PropertyMap({properties,selectedId,onSelect,onOpen,immersive=false,city}:PropertyMapProps){
  const nodeRef=React.useRef<HTMLDivElement>(null);
  const mapglRef=React.useRef<LoadedMapGL|null>(null);
  const mapRef=React.useRef<MapInstance|null>(null);
  const markersRef=React.useRef<HtmlMarkerInstance[]>([]);
  const [status,setStatus]=React.useState<"loading"|"ready"|"error">("loading");
  const [error,setError]=React.useState("");
  const selectRef=React.useRef(onSelect);
  selectRef.current=onSelect;
  const openRef=React.useRef(onOpen);
  openRef.current=onOpen;

  React.useEffect(()=>{
    let cancelled=false;
    const init=async()=>{
      if(!nodeRef.current||mapRef.current)return;
      try{
        setStatus("loading");
        const [{key},mapgl]=await Promise.all([getMapConfig(),load()]);
        if(cancelled||!nodeRef.current)return;
        const initial=properties.find(p=>p.city===city&&p.longitude!=null&&p.latitude!=null)
          ??properties.find(p=>p.longitude!=null&&p.latitude!=null);
        const map=new mapgl.Map(nodeRef.current,{
          key,
          center:initial&&initial.longitude!=null&&initial.latitude!=null?[initial.longitude,initial.latitude]:[131.91,43.12],
          zoom:11.2,
          lang:"ru",
          copyright:"bottomLeft",
          enableTrackResize:true,
          maxPitch:55,
          lowZoomMaxPitch:35,
          defaultBackgroundColor:"#E7ECEF",
          controlsLayoutPadding:{left:10,bottom:92,right:10,top:10},
        });
        new mapgl.ZoomControl(map,{position:"bottomLeft"});
        mapglRef.current=mapgl;
        mapRef.current=map;
        setStatus("ready");
      }catch(err){
        if(cancelled)return;
        setError(err instanceof Error?err.message:"Не удалось открыть карту 2ГИС");
        setStatus("error");
      }
    };
    init();
    return()=>{
      cancelled=true;
      markersRef.current.forEach(marker=>marker.destroy());
      markersRef.current=[];
      mapRef.current?.destroy();
      mapRef.current=null;
      mapglRef.current=null;
    };
  },[]);

  React.useEffect(()=>{
    const map=mapRef.current;
    const mapgl=mapglRef.current;
    if(!map||!mapgl||status!=="ready")return;
    markersRef.current.forEach(marker=>marker.destroy());
    markersRef.current=[];

    const visible=properties.filter(p=>p.latitude!=null&&p.longitude!=null&&(!city||p.city===city));
    const coords=visible.map(p=>[p.longitude!,p.latitude!] as [number,number]);

    visible.forEach(property=>{
      const active=property.id===selectedId;
      const root=document.createElement("button");
      root.type="button";
      root.className=`${styles.pricePin} ${active?styles.pricePinActive:""}`;
      root.setAttribute("aria-label",`${property.name}, от ${property.priceFrom.toFixed(1)} млн рублей`);
      const price=document.createElement("span");
      price.textContent="от "+property.priceFrom.toFixed(1).replace(".",",")+" млн";
      const tip=document.createElement("i");
      const card=document.createElement("button");
      card.type="button";
      card.className=styles.previewCard;
      const image=property.coverImageUrl?document.createElement("img"):document.createElement("span");
      if(property.coverImageUrl&&image instanceof HTMLImageElement){image.src=property.coverImageUrl;image.alt=""}else{image.textContent="PULSE";image.className=styles.placeholder}
      const copy=document.createElement("span");copy.className=styles.cardCopy;
      const meta=document.createElement("small");meta.textContent=property.city+" · "+property.district;
      const name=document.createElement("strong");name.textContent=property.name;
      const detail=document.createElement("em");detail.textContent=(property.delivery||"Новостройка")+" · от "+property.priceFrom.toFixed(1).replace(".",",")+" млн ₽";
      const open=document.createElement("b");open.textContent="Открыть ЖК →";
      copy.append(meta,name,detail,open);card.append(image,copy);
      card.addEventListener("click",(event)=>{event.stopPropagation();(openRef.current??selectRef.current)(property.id)});
      root.addEventListener("mouseenter",()=>root.classList.add(styles.pinHover));
      root.addEventListener("mouseleave",()=>root.classList.remove(styles.pinHover));
      root.append(card,price,tip);
      root.addEventListener("click",(event)=>{
        event.stopPropagation();
        selectRef.current(property.id);
      });
      const marker=new mapgl.HtmlMarker(map,{
        coordinates:[property.longitude!,property.latitude!],
        html:root,
        interactive:true,
        anchor:[42,38],
        zIndex:active?20:10,
      });
      markersRef.current.push(marker);
    });

    if(coords.length===1){
      map.setCenter(coords[0],{animate:true,duration:420});
      map.setZoom(13.2,{animate:true,duration:420});
    }else if(coords.length>1){
      const lngs=coords.map(x=>x[0]);
      const lats=coords.map(x=>x[1]);
      map.fitBounds({
        northEast:[Math.max(...lngs),Math.max(...lats)],
        southWest:[Math.min(...lngs),Math.min(...lats)],
      },{
        maxZoom:13.1,
        padding:{top:64,right:54,bottom:150,left:54},
        animation:{animate:true,duration:520},
      });
    }
  },[properties,selectedId,city,status]);

  React.useEffect(()=>{
    const map=mapRef.current;
    if(!map||status!=="ready")return;
    map.setPitch(immersive?38:0,{animate:true,duration:420});
  },[immersive,status]);

  React.useEffect(()=>{
    const map=mapRef.current;
    const current=properties.find(p=>p.id===selectedId);
    if(!map||!current||current.longitude==null||current.latitude==null||status!=="ready")return;
    map.setCenter([current.longitude,current.latitude],{animate:true,duration:360});
  },[selectedId,properties,status]);

  return <div className={styles.wrap}>
    <div ref={nodeRef} className={styles.map} aria-label="Интерактивная карта 2ГИС с новостройками"/>
    {status==="loading"&&<div className={styles.state}>Загружаем 2ГИС…</div>}
    {status==="error"&&<div className={styles.state}><strong>Карта 2ГИС пока не подключена</strong><span>{error}</span></div>}
    {status==="ready"&&<div className={styles.provider}>2ГИС</div>}
  </div>;
}
