import React from "react";
import type { PropertyRecord } from "../helpers/propertyTypes";
import styles from "./PropertyMap.module.css";

type PropertyMapProps={
  properties:PropertyRecord[];
  selectedId?:string;
  onSelect:(id:string)=>void;
  onOpen?:(id:string)=>void;
  immersive?:boolean;
  city?:string;
};

export function PropertyMap({properties,selectedId,onSelect,onOpen,city}:PropertyMapProps){
  const visible=properties.filter(p=>p.latitude!=null&&p.longitude!=null&&(!city||p.city===city));
  const base=visible.length?visible:properties.filter(p=>p.latitude!=null&&p.longitude!=null);
  const lats=base.map(p=>p.latitude!);
  const lngs=base.map(p=>p.longitude!);
  const minLat=Math.min(...lats,43.05),maxLat=Math.max(...lats,43.9),minLng=Math.min(...lngs,131.75),maxLng=Math.max(...lngs,132.3);
  const centerLat=(minLat+maxLat)/2,centerLng=(minLng+maxLng)/2;
  const spanLat=Math.max(.16,(maxLat-minLat)*1.35),spanLng=Math.max(.24,(maxLng-minLng)*1.35);
  const bbox=[centerLng-spanLng/2,centerLat-spanLat/2,centerLng+spanLng/2,centerLat+spanLat/2];
  const src=`https://www.openstreetmap.org/export/embed.html?bbox=${bbox.join("%2C")}&layer=mapnik`;

  const pos=(p:PropertyRecord)=>{
    const left=((p.longitude!-bbox[0])/(bbox[2]-bbox[0]))*100;
    const top=(1-(p.latitude!-bbox[1])/(bbox[3]-bbox[1]))*100;
    return {left:`${Math.max(8,Math.min(88,left))}%`,top:`${Math.max(10,Math.min(84,top))}%`};
  };

  return <div className={styles.wrap} style={{overflow:"hidden"}}>
    <iframe title="Карта новостроек" src={src} className={styles.map} style={{border:0,filter:"saturate(.72) contrast(.94) brightness(1.04)",pointerEvents:"none"}}/>
    <div style={{position:"absolute",inset:0,zIndex:4,pointerEvents:"none"}}>
      {base.map(property=>{
        const active=property.id===selectedId;
        return <button
          key={property.id}
          type="button"
          className={styles.pricePin+" "+(active?styles.pricePinActive:"")}
          style={{position:"absolute",...pos(property),transform:active?"translate(-50%,-50%) scale(1.08)":"translate(-50%,-50%)",pointerEvents:"auto"}}
          onClick={()=>onSelect(property.id)}
          onDoubleClick={()=>onOpen?.(property.id)}
          aria-label={property.name}
        >
          <span>от {property.priceFrom.toFixed(1).replace(".",",")} млн</span><i/>
          {active&&<span className={styles.previewCard} style={{pointerEvents:"auto"}} onClick={(event)=>{event.stopPropagation();onOpen?.(property.id)}}>
            {property.coverImageUrl?<img src={property.coverImageUrl} alt=""/>:<span className={styles.placeholder}>PULSE</span>}
            <span className={styles.cardCopy}><small>{property.city} · {property.district}</small><strong>{property.name}</strong><em>{property.delivery} · от {property.priceFrom.toFixed(1).replace(".",",")} млн ₽</em><b>Открыть ЖК →</b></span>
          </span>}
        </button>
      })}
    </div>
    <div className={styles.provider}>OpenStreetMap · preview</div>
  </div>;
}
