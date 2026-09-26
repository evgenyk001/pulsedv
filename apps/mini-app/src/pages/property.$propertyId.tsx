import React from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, Heart, Share2, MapPin, CalendarDays, Building2, Waves, Trees, CarFront,
  Baby, ShieldCheck, ChevronRight, Send, Sparkles, MapPinned, LayoutGrid, Ruler,
  WalletCards, Image as ImageIcon
} from "lucide-react";
import { LeadSheet } from "../components/LeadSheet";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "../components/Sheet";
import { useProperties } from "../helpers/useProperties";
import { useFavoriteIds } from "../helpers/useFavoriteIds";
import { recordPulseEvent } from "../../../../packages/pulse-data";
import styles from "./property.$propertyId.module.css";

const featureIcon=(name:string)=>{
  if(name==="waves")return Waves;
  if(name==="trees")return Trees;
  if(name==="car")return CarFront;
  if(name==="baby")return Baby;
  if(name==="map-pin")return MapPinned;
  if(name==="building")return Building2;
  return Sparkles;
};

const priceLabel=(value:number)=>"от "+value.toFixed(1).replace(".",",")+" млн ₽";

export default function PropertyPage(){
  const {propertyId=""}=useParams();
  const {data:properties=[],isLoading,error}=useProperties();
  const p=properties.find(x=>x.id===propertyId);
  const {toggle,isFavorite}=useFavoriteIds();
  const [photoIndex,setPhotoIndex]=React.useState(0);
  const [selectedRoom,setSelectedRoom]=React.useState("");

  React.useEffect(()=>{
    if(!p)return;
    recordPulseEvent({eventType:"property_view",entityType:"property",entityId:p.id,metadata:{city:p.city,district:p.district,priceFrom:p.priceFrom}});
  },[p?.id]);

  if(isLoading)return <div className={styles.loading}>Загружаем объект…</div>;
  if(error||!p)return <div className={styles.notFound}><strong>Объект не найден</strong><Link to="/catalog">Вернуться в каталог</Link></div>;

  const favorite=isFavorite(p.id);
  const gallery=[
    ...(p.coverImageUrl?[p.coverImageUrl]:[]),
    ...[...p.images].sort((a,b)=>a.sortOrder-b.sortOrder).map(x=>x.url).filter(url=>url!==p.coverImageUrl),
  ].filter((url,index,all)=>all.indexOf(url)===index);

  const roomOptions=[
    ...new Set([...p.floorplans].sort((a,b)=>a.sortOrder-b.sortOrder).map(plan=>plan.roomLabel)),
  ];
  const activeRoom=selectedRoom&&roomOptions.includes(selectedRoom)?selectedRoom:(roomOptions[0]||"");
  const visiblePlans=p.floorplans
    .filter(plan=>!activeRoom||plan.roomLabel===activeRoom)
    .sort((a,b)=>(a.priceFrom??Infinity)-(b.priceFrom??Infinity)||a.sortOrder-b.sortOrder);

  const share=async()=>{
    recordPulseEvent({eventType:"property_share",entityType:"property",entityId:p.id,metadata:{city:p.city}});
    if(navigator.share){
      await navigator.share({title:p.name,text:p.name+" — "+p.city+", "+p.district,url:window.location.href}).catch(()=>{});
    }else{
      await navigator.clipboard?.writeText(window.location.href);
    }
  };

  const onGalleryScroll=(event:React.UIEvent<HTMLDivElement>)=>{
    const node=event.currentTarget;
    if(!node.clientWidth)return;
    setPhotoIndex(Math.max(0,Math.min(gallery.length-1,Math.round(node.scrollLeft/node.clientWidth))));
  };

  return <div className={styles.page}>
    <section className={styles.hero}>
      <div className={styles.gallery} onScroll={onGalleryScroll} aria-label={"Фотографии "+p.name}>
        {gallery.length
          ?gallery.map((url,index)=><div className={styles.heroSlide} key={url}>
              <img src={url} alt={index===0?p.name:""} loading={index===0?"eager":"lazy"}/>
            </div>)
          :<div className={styles.heroSlide}><div className={styles.heroFallback}><ImageIcon size={34}/><span>Фото проекта готовится</span></div></div>}
      </div>
      <div className={styles.fade}/>
      <Link to="/catalog" className={styles.back} aria-label="Назад"><ArrowLeft size={19}/></Link>
      <div className={styles.actions}>
        <button onClick={()=>toggle(p.id)} className={favorite?styles.favorited:""} aria-label={favorite?"Убрать из избранного":"В избранное"}><Heart size={18} fill={favorite?"currentColor":"none"}/></button>
        <button onClick={share} aria-label="Поделиться"><Share2 size={18}/></button>
      </div>
      <span className={styles.count}>{gallery.length>1?photoIndex+1+" / "+gallery.length:gallery.length===1?"1 фото":"Фото"}</span>
      {gallery.length>1&&<div className={styles.galleryDots} aria-hidden="true">
        {gallery.map((_,index)=><i key={index} className={index===photoIndex?styles.galleryDotActive:""}/>)}
      </div>}
    </section>

    <main className={styles.content}>
      <section className={styles.intro}>
        <div className={styles.tags}>
          {p.className&&<span>{p.className}</span>}
          {p.tags.slice(0,2).map(tag=><span key={tag}>{tag}</span>)}
        </div>
        <h1>{p.name}</h1>
        <div className={styles.location}><MapPin size={14}/>{p.city} · {p.district}</div>
        <div className={styles.developerLine}><Building2 size={13}/>{p.developerName||"Застройщик уточняется"}</div>
      </section>

      <section className={styles.priceCard}>
        <div>
          <span>Квартиры</span>
          <strong>{priceLabel(p.priceFrom)}</strong>
          <small>Актуальное наличие уточнит менеджер PULSE.DV</small>
        </div>
        <Link to={"/mortgage?price="+Math.round(p.priceFrom*1_000_000)+"&property="+encodeURIComponent(p.id)}>
          <WalletCards size={17}/>
          <span>Рассчитать ипотеку</span>
          <ChevronRight size={16}/>
        </Link>
      </section>

      <section className={styles.quickFacts} aria-label="Ключевые характеристики">
        <div><CalendarDays size={18}/><span>Срок сдачи</span><strong>{p.delivery||"Уточняется"}</strong></div>
        <div><Building2 size={18}/><span>Класс</span><strong>{p.className||"Уточняется"}</strong></div>
        <div><LayoutGrid size={18}/><span>Планировки</span><strong>{p.floorplans.length?p.floorplans.length+" вариантов":"Уточняются"}</strong></div>
        <div><MapPin size={18}/><span>Район</span><strong>{p.district||"Уточняется"}</strong></div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}><div><span>О ПРОЕКТЕ</span><h2>Главное о {p.name}</h2></div></div>
        <p className={styles.desc}>{p.description||"Описание проекта уточняется."}</p>
      </section>

      {p.features.length>0&&<section className={styles.section}>
        <div className={styles.sectionHead}><div><span>ПРЕИМУЩЕСТВА</span><h2>Что есть в проекте</h2></div><small>{p.features.length} пунктов</small></div>
        <div className={styles.features}>
          {[...p.features].sort((a,b)=>a.sortOrder-b.sortOrder).map(feature=>{
            const Icon=featureIcon(feature.icon);
            return <div key={feature.id||feature.label}><span><Icon size={18}/></span><strong>{feature.label}</strong></div>;
          })}
        </div>
      </section>}

      <section className={styles.section} aria-label="Планировки ЖК">
        <div className={styles.sectionHead}>
          <div><span>ПЛАНИРОВКИ</span><h2>Выберите квартиру</h2></div>
          {p.floorplans.length>0&&<small>{p.floorplans.length} вариантов</small>}
        </div>

        {roomOptions.length>0&&<div className={styles.roomTabs} role="tablist" aria-label="Комнатность планировок">
          {roomOptions.map(room=><button
            type="button"
            key={room}
            role="tab"
            aria-selected={activeRoom===room}
            className={activeRoom===room?styles.roomActive:""}
            onClick={()=>setSelectedRoom(room)}
          >{room}</button>)}
        </div>}

        {visiblePlans.length?<div className={styles.planRail}>
          {visiblePlans.map((plan,index)=><article className={styles.planCard} key={plan.id||plan.roomLabel+"-"+index}>
            <div className={styles.planImage}>
              {plan.imageUrl?<img src={plan.imageUrl} alt={"Планировка "+plan.roomLabel} loading="lazy"/>:<div><Ruler size={24}/><span>Планировка</span></div>}
            </div>
            <div className={styles.planCopy}>
              <span>{plan.roomLabel==="Студия"?"Студия":plan.roomLabel+" комн."}</span>
              <strong>{plan.areaFrom!==null
                ?plan.areaFrom+(plan.areaTo&&plan.areaTo!==plan.areaFrom?"–"+plan.areaTo:"")+" м²"
                :"Площадь уточняется"}</strong>
              <b>{plan.priceFrom!==null?priceLabel(plan.priceFrom):"Цена уточняется"}</b>
              {plan.priceFrom!==null&&<Link to={"/mortgage?price="+Math.round(plan.priceFrom*1_000_000)+"&property="+encodeURIComponent(p.id)}>Рассчитать платёж <ChevronRight size={14}/></Link>}
            </div>
          </article>)}
        </div>:<div className={styles.emptyPlans}>Планировки появятся после загрузки данных по проекту.</div>}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}><div><span>ХАРАКТЕРИСТИКИ</span><h2>Детали проекта</h2></div></div>
        <div className={styles.specs}>
          <div><span>Адрес</span><strong>{p.address||p.city+" · "+p.district}</strong></div>
          <div><span>Застройщик</span><strong>{p.developerName||"Уточняется"}</strong></div>
          <div><span>Класс</span><strong>{p.className||"Уточняется"}</strong></div>
          <div><span>Срок сдачи</span><strong>{p.delivery||"Уточняется"}</strong></div>
          <div><span>Цена от</span><strong>{priceLabel(p.priceFrom).replace("от ","")}</strong></div>
          <div><span>Типы квартир</span><strong>{roomOptions.length?roomOptions.join(" · "):"Уточняются"}</strong></div>
        </div>
      </section>

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
    </main>

    <div className={styles.ctaBar}>
      <LeadSheet title="Получить презентацию" project={p.name} propertyId={p.id} source="presentation">
        <button className={styles.secondary}><Send size={17}/><span>Презентация</span></button>
      </LeadSheet>
      <LeadSheet title="Узнать наличие" project={p.name} propertyId={p.id} source="property">
        <button className={styles.primary}>Узнать наличие <ChevronRight size={18}/></button>
      </LeadSheet>
    </div>
  </div>;
}
