import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Heart, Building2 } from "lucide-react";
import { PropertyRecord } from "../helpers/propertyTypes";
import { useFavoriteIds } from "../helpers/useFavoriteIds";
import styles from "./PropertyCard.module.css";

type PropertyCardProps={property:PropertyRecord;compact?:boolean;returnTo?:string;resolveReturnTo?:()=>string};

export function PropertyCard({property,compact=false,returnTo,resolveReturnTo}:PropertyCardProps){
  const location=useLocation(),navigate=useNavigate();
  const {toggle,isFavorite}=useFavoriteIds();
  const saved=isFavorite(property.id);
  const image=property.coverImageUrl||property.images[0]?.url;
  const currentReturn=()=>resolveReturnTo?.()??returnTo??location.pathname+location.search;
  const rememberReturn=(value=currentReturn())=>{try{sessionStorage.setItem('pulse.property.return',value)}catch{}};
  const open=(event:React.MouseEvent<HTMLAnchorElement>)=>{
    if(!resolveReturnTo){rememberReturn();return}
    event.preventDefault();const value=currentReturn();rememberReturn(value);navigate(`/property/${property.id}`,{state:{returnTo:value}});
  };
  return <article className={`${styles.card} ${compact?styles.compact:""}`}>
    <Link to={`/property/${property.id}`} state={{returnTo:currentReturn()}} onClick={open} className={styles.link} aria-label={`Открыть ${property.name}`}>
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