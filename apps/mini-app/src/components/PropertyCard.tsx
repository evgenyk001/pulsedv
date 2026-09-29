import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Heart, Building2 } from "lucide-react";
import { PropertyRecord } from "../helpers/propertyTypes";
import { useFavoriteIds } from "../helpers/useFavoriteIds";
import styles from "./PropertyCard.module.css";

type PropertyCardProps={property:PropertyRecord;compact?:boolean;returnTo?:string};

export function PropertyCard({property,compact=false,returnTo}:PropertyCardProps){
  const location=useLocation();
  const {toggle,isFavorite}=useFavoriteIds();
  const saved=isFavorite(property.id);
  const image=property.coverImageUrl||property.images[0]?.url;
  const rememberReturn=()=>{try{
    let value=returnTo??location.pathname+location.search;
    if(location.pathname==="/catalog"){
      const input=document.querySelector<HTMLInputElement>('input[aria-label="Поиск"]');
      const params=new URLSearchParams(location.search);
      const stored=sessionStorage.getItem("pulse.catalog.query");
      const live=stored??input?.value??"";
      live?params.set("q",live):params.delete("q");
      const search=params.toString();
      value="/catalog"+(search?"?"+search:"");
    }else{
      const hash=window.location.hash.replace(/^#/,'');
      if(!returnTo&&/^\/(catalog|favorites|selection|journey)([?]|$)/.test(hash))value=hash;
    }
    sessionStorage.setItem('pulse.property.return',value);
  }catch{}};
  return <article className={`${styles.card} ${compact?styles.compact:""}`}>
    <Link to={`/property/${property.id}`} state={{returnTo:returnTo??location.pathname+location.search}} onClick={rememberReturn} className={styles.link} aria-label={`Открыть ${property.name}`}>
      <div className={styles.image}>
        {image?<img src={image} alt={property.name}/>:<div className={styles.imageFallback}><Building2 size={26}/></div>}
        {property.tags[0]&&<span className={styles.badge}>{property.tags[0]}</span>}
      </div>
      <div className={styles.body}>
        <strong>{property.name}</strong>
        <span>{property.city} · {property.district}</span>
        <div><b>от {property.priceFrom.toFixed(1).replace(".",",")} млн ₽</b><small>{property.delivery}</small></div>
      </div>
    </Link>
    <button className={`${styles.heart} ${saved?styles.saved:""}`} onClick={()=>toggle(property.id)} aria-label={saved?"Убрать из избранного":"Добавить в избранное"}>
      <Heart size={16} fill={saved?"currentColor":"none"}/>
    </button>
  </article>
}