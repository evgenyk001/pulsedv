import React from "react";
import { Link } from "react-router-dom";
import { Building2, CalendarDays, ChevronDown, ChevronRight, Heart, MapPin, Ruler, Sparkles, WalletCards } from "lucide-react";
import { PropertyRecord } from "../helpers/propertyTypes";
import { useFavoriteIds } from "../helpers/useFavoriteIds";
import styles from "./PropertyCard.module.css";

type PropertyCardProps={
  property:PropertyRecord;
  compact?:boolean;
  catalog?:boolean;
  initialRoom?:string;
  pulseScore?:number|null;
};

const priceLabel=(value:number)=>"от "+value.toFixed(1).replace(".",",")+" млн ₽";

function DefaultPropertyCard({property,compact=false}:{property:PropertyRecord;compact?:boolean}){
  const {toggle,isFavorite}=useFavoriteIds();
  const saved=isFavorite(property.id);
  const image=property.coverImageUrl||property.images[0]?.url;
  return <article className={`${styles.card} ${compact?styles.compact:""}`}>
    <Link to={`/property/${property.id}`} className={styles.link} aria-label={`Открыть ${property.name}`}>
      <div className={styles.image}>
        {image?<img src={image} alt={property.name}/>:<div className={styles.imageFallback}><Building2 size={26}/></div>}
        {property.tags[0]&&<span className={styles.badge}>{property.tags[0]}</span>}
      </div>
      <div className={styles.body}>
        <strong>{property.name}</strong>
        <span>{property.city} · {property.district}</span>
        <div><b>{priceLabel(property.priceFrom)}</b><small>{property.delivery}</small></div>
      </div>
    </Link>
    <button className={`${styles.heart} ${saved?styles.saved:""}`} onClick={()=>toggle(property.id)} aria-label={saved?"Убрать из избранного":"Добавить в избранное"}>
      <Heart size={16} fill={saved?"currentColor":"none"}/>
    </button>
  </article>;
}

function CatalogPropertyCard({property,initialRoom="Все",pulseScore=null}:{property:PropertyRecord;initialRoom?:string;pulseScore?:number|null}){
  const {toggle,isFavorite}=useFavoriteIds();
  const saved=isFavorite(property.id);
  const [photoIndex,setPhotoIndex]=React.useState(0);
  const [expanded,setExpanded]=React.useState(false);

  const gallery=React.useMemo(()=>{
    const urls=[
      property.coverImageUrl,
      ...[...property.images].sort((a,b)=>a.sortOrder-b.sortOrder).map(image=>image.url),
    ].filter((url):url is string=>!!url);
    return [...new Set(urls)];
  },[property.coverImageUrl,property.images]);

  const roomOptions=React.useMemo(()=>[
    ...new Set([...property.floorplans].sort((a,b)=>a.sortOrder-b.sortOrder).map(plan=>plan.roomLabel)),
  ],[property.floorplans]);

  const preferredRoom=initialRoom!=="Все"&&roomOptions.includes(initialRoom)
    ?initialRoom
    :roomOptions[0]||"";
  const [room,setRoom]=React.useState(preferredRoom);

  React.useEffect(()=>{
    setRoom(preferredRoom);
  },[property.id,preferredRoom]);

  const roomPlans=React.useMemo(()=>property.floorplans
    .filter(plan=>!room||plan.roomLabel===room)
    .sort((a,b)=>(a.priceFrom??Infinity)-(b.priceFrom??Infinity)||a.sortOrder-b.sortOrder)
  ,[property.floorplans,room]);

  const pricedPlans=roomPlans.filter(plan=>plan.priceFrom!==null);
  const relevantPrice=pricedPlans.length
    ?Math.min(...pricedPlans.map(plan=>plan.priceFrom!))
    :property.priceFrom;
  const areas=roomPlans.flatMap(plan=>[plan.areaFrom,plan.areaTo]).filter((value):value is number=>value!==null);
  const minArea=areas.length?Math.min(...areas):null;
  const maxArea=areas.length?Math.max(...areas):null;
  const areaLabel=minArea===null
    ?"Площадь уточняется"
    :maxArea!==null&&maxArea!==minArea
      ?`${minArea}–${maxArea} м²`
      :`${minArea} м²`;

  const onGalleryScroll=(event:React.UIEvent<HTMLDivElement>)=>{
    const node=event.currentTarget;
    if(!node.clientWidth)return;
    setPhotoIndex(Math.max(0,Math.min(gallery.length-1,Math.round(node.scrollLeft/node.clientWidth))));
  };

  const mortgagePrice=Math.round(relevantPrice*1_000_000);

  return <article className={styles.catalogCard}>
    <div className={styles.catalogGalleryWrap}>
      <div className={styles.catalogGallery} onScroll={onGalleryScroll} aria-label={`Фотографии ${property.name}`}>
        {gallery.length
          ?gallery.map((url,index)=><div className={styles.catalogSlide} key={url}><img src={url} alt={index===0?property.name:""} loading={index===0?"eager":"lazy"}/></div>)
          :<div className={styles.catalogSlide}><div className={styles.catalogFallback}><Building2 size={34}/></div></div>}
      </div>

      <div className={styles.catalogBadges}>
        {property.tags[0]&&<span>{property.tags[0]}</span>}
        {property.className&&<span>{property.className}</span>}
      </div>

      <button className={`${styles.heart} ${saved?styles.saved:""}`} onClick={()=>toggle(property.id)} aria-label={saved?"Убрать из избранного":"Добавить в избранное"}>
        <Heart size={17} fill={saved?"currentColor":"none"}/>
      </button>

      <div className={styles.photoCounter}>{gallery.length>1?`${photoIndex+1} / ${gallery.length}`:gallery.length===1?"1 фото":"Фото готовится"}</div>
      {gallery.length>1&&<div className={styles.galleryDots} aria-hidden="true">{gallery.map((_,index)=><i key={index} className={index===photoIndex?styles.galleryDotActive:""}/>)}</div>}
    </div>

    <div className={styles.catalogBody}>
      <div className={styles.catalogTitleRow}>
        <div>
          <Link to={`/property/${property.id}`} className={styles.catalogTitle}>{property.name}</Link>
          <span className={styles.catalogLocation}><MapPin size={13}/>{property.city} · {property.district}</span>
        </div>
        {pulseScore!==null&&<span className={styles.pulseMatch}><Sparkles size={12}/>{pulseScore}%</span>}
      </div>

      <div className={styles.catalogPriceRow}>
        <div><strong>{priceLabel(relevantPrice)}</strong><span>{room?room==="Студия"?"Студия":room+" комн.":"Квартиры"}</span></div>
        <div><b>{areaLabel}</b><small>{property.delivery}</small></div>
      </div>

      {property.features.length>0&&<div className={styles.featureChips}>
        {property.features.slice(0,4).map(feature=><span key={feature.id||feature.label}>{feature.label}</span>)}
      </div>}

      {roomOptions.length>0&&<section className={styles.plansSection}>
        <div className={styles.catalogSectionHead}><span>Планировки</span><small>{property.floorplans.length} {property.floorplans.length===1?"вариант":property.floorplans.length>1&&property.floorplans.length<5?"варианта":"вариантов"}</small></div>
        <div className={styles.roomTabs} role="tablist" aria-label={`Планировки ${property.name}`}>
          {roomOptions.map(option=><button
            type="button"
            role="tab"
            aria-selected={room===option}
            key={option}
            className={room===option?styles.roomTabActive:""}
            onClick={()=>setRoom(option)}
          >{option}</button>)}
        </div>

        <div className={styles.planRail}>
          {roomPlans.map((plan,index)=><div className={styles.planCard} key={plan.id||plan.roomLabel+"-"+index}>
            <div className={styles.planVisual}>
              {plan.imageUrl?<img src={plan.imageUrl} alt={`Планировка ${plan.roomLabel}`} loading="lazy"/>:<span><Ruler size={18}/><small>План</small></span>}
            </div>
            <div>
              <strong>{plan.roomLabel==="Студия"?"Студия":plan.roomLabel+" комн."}</strong>
              <span>{plan.areaFrom!==null
                ?`${plan.areaFrom}${plan.areaTo&&plan.areaTo!==plan.areaFrom?"–"+plan.areaTo:""} м²`
                :"Площадь уточняется"}</span>
              <b>{plan.priceFrom!==null?priceLabel(plan.priceFrom):"Цена уточняется"}</b>
            </div>
          </div>)}
        </div>
      </section>}

      <button type="button" className={styles.detailsToggle} aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>
        <span>{expanded?"Скрыть характеристики":"Все характеристики"}</span>
        <ChevronDown size={16} className={expanded?styles.chevronOpen:""}/>
      </button>

      {expanded&&<div className={styles.detailsPanel}>
        <div><span>Застройщик</span><b>{property.developerName||"Уточняется"}</b></div>
        <div><span>Класс</span><b>{property.className||"Уточняется"}</b></div>
        <div><span>Срок сдачи</span><b>{property.delivery||"Уточняется"}</b></div>
        <div><span>Адрес</span><b>{property.address||property.city+" · "+property.district}</b></div>
        {property.features.length>0&&<div className={styles.detailsFeatures}>
          {property.features.map(feature=><span key={feature.id||feature.label}>{feature.label}</span>)}
        </div>}
      </div>}

      <div className={styles.catalogActions}>
        <Link to={`/property/${property.id}`} className={styles.catalogSecondary}>Подробнее <ChevronRight size={15}/></Link>
        <Link to={`/mortgage?price=${mortgagePrice}&property=${encodeURIComponent(property.id)}`} className={styles.catalogPrimary}><WalletCards size={15}/>Ипотека</Link>
      </div>

      <div className={styles.catalogMetaLine}>
        <span><Building2 size={12}/>{property.developerName||"Застройщик уточняется"}</span>
        <span><CalendarDays size={12}/>{property.delivery}</span>
      </div>
    </div>
  </article>;
}

export function PropertyCard({property,compact=false,catalog=false,initialRoom,pulseScore}:PropertyCardProps){
  if(catalog)return <CatalogPropertyCard property={property} initialRoom={initialRoom} pulseScore={pulseScore}/>;
  return <DefaultPropertyCard property={property} compact={compact}/>;
}
