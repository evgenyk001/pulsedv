import React from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Heart, Share2, MapPin, CalendarDays, Building2, Waves, Trees, CarFront, Baby, ShieldCheck, ChevronRight, Send, Sparkles, MapPinned } from "lucide-react";
import { LeadSheet } from "../components/LeadSheet";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "../components/Sheet";
import { useProperties } from "../helpers/useProperties";
import { useFavoriteIds } from "../helpers/useFavoriteIds";
import { SegmentedControl } from "../components/SegmentedControl";
import { recordPulseEvent } from "../../../../packages/pulse-data";
import styles from "./property.$propertyId.module.css";

type Tab="about"|"plans"|"infra";

const featureIcon=(name:string)=>{
  if(name==="waves")return Waves;
  if(name==="trees")return Trees;
  if(name==="car")return CarFront;
  if(name==="baby")return Baby;
  if(name==="map-pin")return MapPinned;
  if(name==="building")return Building2;
  return Sparkles;
};

export default function PropertyPage(){
  const {propertyId=""}=useParams();
  const {data:properties=[],isLoading,error}=useProperties();
  const p=properties.find(x=>x.id===propertyId);
  const [tab,setTab]=React.useState<Tab>("about");
  const {toggle,isFavorite}=useFavoriteIds();

  React.useEffect(()=>{
    if(!p)return;
    recordPulseEvent({eventType:"property_view",entityType:"property",entityId:p.id,metadata:{city:p.city,district:p.district,priceFrom:p.priceFrom}});
  },[p?.id]);

  if(isLoading)return <div style={{padding:"42px 18px",fontSize:11,color:"var(--muted-foreground)"}}>Загружаем объект…</div>;
  if(error||!p)return <div style={{padding:"42px 18px"}}><strong>Объект не найден</strong><br/><Link to="/catalog">Вернуться в каталог</Link></div>;

  const favorite=isFavorite(p.id);
  const gallery=[
    ...(p.coverImageUrl?[p.coverImageUrl]:[]),
    ...p.images.map(x=>x.url).filter(url=>url!==p.coverImageUrl),
  ];
  const hero=gallery[0];
  const share=async()=>{recordPulseEvent({eventType:"property_share",entityType:"property",entityId:p.id,metadata:{city:p.city}});if(navigator.share){await navigator.share({title:p.name,text:p.name+" — "+p.city+", "+p.district}).catch(()=>{})}else{await navigator.clipboard?.writeText(window.location.href)}};

  return <div className={styles.page}>
    <section className={styles.hero}>
      {hero?<img src={hero} alt={p.name}/>:<div style={{width:"100%",height:"100%",display:"grid",placeItems:"center",background:"var(--muted)"}}><Building2 size={34}/></div>}
      <div className={styles.fade}/>
      <Link to="/catalog" className={styles.back} aria-label="Назад"><ArrowLeft size={19}/></Link>
      <div className={styles.actions}>
        <button onClick={()=>toggle(p.id)} className={favorite?styles.favorited:""} aria-label={favorite?"Убрать из избранного":"В избранное"}><Heart size={18} fill={favorite?"currentColor":"none"}/></button>
        <button onClick={share} aria-label="Поделиться"><Share2 size={18}/></button>
      </div>
      <span className={styles.count}>{Math.max(gallery.length,1)} фото</span>
    </section>

    <section className={styles.sheet}>
      <div className={styles.tags}><span>{p.className}</span>{p.tags[0]&&<span>{p.tags[0]}</span>}</div>
      <h1>{p.name}</h1>
      <div className={styles.location}><MapPin size={14}/>{p.city} · {p.district}</div>

      <div className={styles.priceRow}>
        <strong>от {p.priceFrom.toFixed(1).replace(".",",")} млн ₽</strong>
        <Link to="/mortgage"><span>Ипотека</span><b>Рассчитать</b></Link>
      </div>

      <SegmentedControl<Tab>
        value={tab}
        onChange={setTab}
        ariaLabel="Раздел объекта"
        options={[
          {value:"about",label:"О проекте"},
          {value:"plans",label:"Планировки"},
          {value:"infra",label:"Детали"},
        ]}
      />

      {tab==="about"&&<>
        <p className={styles.desc}>{p.description||"Описание проекта уточняется."}</p>
        {p.features.length>0&&<div className={styles.facts}>{p.features.slice(0,4).map(feature=>{const Icon=featureIcon(feature.icon);return <div key={feature.id||feature.label}><Icon size={18}/><span>{feature.label}</span></div>})}</div>}
      </>}

      {tab==="plans"&&<div className={styles.planGrid}>
        {p.floorplans.length?p.floorplans.map(plan=><div key={plan.id||plan.roomLabel}><span>{plan.roomLabel}</span><strong>{plan.areaFrom!==null?(plan.areaFrom+(plan.areaTo&&plan.areaTo!==plan.areaFrom?"–"+plan.areaTo:"")+" м²"):"Площадь уточняется"}</strong><b>{plan.priceFrom!==null?"от "+plan.priceFrom.toFixed(1).replace(".",",")+" млн ₽":"Цена уточняется"}</b></div>):<p className={styles.desc}>Планировки появятся после загрузки данных по проекту.</p>}
      </div>}

      {tab==="infra"&&<div className={styles.infraList}>
        <div><MapPin size={17}/><span><strong>Адрес</strong><small>{p.address||p.city+" · "+p.district}</small></span></div>
        <div><Building2 size={17}/><span><strong>Застройщик</strong><small>{p.developerName||"Уточняется"}</small></span></div>
        <div><CalendarDays size={17}/><span><strong>Срок сдачи</strong><small>{p.delivery}</small></span></div>
      </div>}

      <Sheet>
        <SheetTrigger asChild>
          <button className={styles.developer}>
            <div className={styles.devIcon}><Building2 size={20}/></div>
            <div><span>Застройщик</span><strong>{p.developerName||"Информация уточняется"}</strong><small><ShieldCheck size={12}/> Данные проекта в базе PULSE.DV</small></div>
            <ChevronRight size={18}/>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className={styles.developerSheet}>
          <SheetHeader><SheetTitle>{p.developerName||"О проекте"}</SheetTitle><SheetDescription>Перед бронированием менеджер PULSE.DV уточнит актуальные цены, наличие квартир и условия покупки.</SheetDescription></SheetHeader>
          <div className={styles.developerInfo}><ShieldCheck size={22}/><span><strong>Проверим перед сделкой</strong><small>Данные в приложении используются для подбора. Коммерческие условия могут меняться.</small></span></div>
        </SheetContent>
      </Sheet>

      <div className={styles.delivery}><CalendarDays size={18}/><div><span>Срок сдачи</span><strong>{p.delivery}</strong></div></div>
    </section>

    <div className={styles.ctaBar}>
      <LeadSheet title="Получить презентацию" project={p.name} propertyId={p.id} source="presentation">
        <button className={styles.secondary}><Send size={17}/><span>Презентация</span></button>
      </LeadSheet>
      <LeadSheet title="Оставить заявку" project={p.name} propertyId={p.id} source="property"><button className={styles.primary}>Оставить заявку <ChevronRight size={18}/></button></LeadSheet>
    </div>
  </div>
}
