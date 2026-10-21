import {usePropertyHeroMotion} from "../helpers/usePropertyHeroMotion";
import {IconTile} from '../components/IconTile';
import { PropertyFreshness } from '../components/PropertyFreshness';
import React from "react";
import {NativeSelect} from "../components/NativeSelect";
import {propertyReturn} from "../helpers/navigationMemory";
import {FloorplanViewer} from "../components/FloorplanViewer";
import {PropertyGallery} from "../components/PropertyGallery";
import {usePulseControlState} from "../helpers/usePulseControlState";
import {propertyPhotos,propertyMortgageLink,propertyPriceLabel,propertyPriceRub} from "../../../../packages/domain/propertyPresentation";
import {minimumMortgageDown,readMortgageScenario} from "../../../../packages/domain/mortgagePolicy";
import { TrackedFloorplan } from "../components/TrackedFloorplan";
import { Link, useParams, useLocation } from "react-router-dom";
import {
  ArrowLeft, Heart, Share2, MapPin, CalendarDays, Building2, Waves, Trees, CarFront,
  Baby, ShieldCheck, ChevronRight, Send, Sparkles, MapPinned, LayoutGrid, Ruler,
  WalletCards, FileText, ArrowDown, MessageCircle
} from "lucide-react";
import { LeadSheet } from "../components/LeadSheet";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "../components/Sheet";
import { usePropertyDetail } from "../helpers/useCatalog";
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

const priceLabel=propertyPriceLabel;

export default function PropertyPage(){
  const {propertyId=""}=useParams();
  const location=useLocation();
  const stateReturn=typeof location.state?.returnTo==="string"&&/^\/(catalog|favorites|selection|journey)?([?]|$)/.test(location.state.returnTo)?location.state.returnTo:null;
  const rememberedReturn=propertyReturn();
  const returnTo=stateReturn??rememberedReturn;
  const {data:p,isLoading,error,refetch}=usePropertyDetail(propertyId);
  const heroRef=usePropertyHeroMotion(!isLoading&&!error?p?.id:undefined);
  const control=usePulseControlState();
  const savedScenario=React.useMemo(()=>readMortgageScenario(localStorage),[]);
  const {toggle,isFavorite}=useFavoriteIds();
  const [photoIndex,setPhotoIndex]=React.useState(0);
  const [selectedRoom,setSelectedRoom]=React.useState("");
  const [shareNotice,setShareNotice]=React.useState("");

  React.useEffect(()=>{setPhotoIndex(0);setSelectedRoom("");setShareNotice("")},[propertyId]);

  React.useEffect(()=>{
    if(!p)return;
    try{localStorage.setItem("pulse.last-property",JSON.stringify({id:p.id,name:p.name,at:Date.now()}))}catch{}
    recordPulseEvent({eventType:"property_view",entityType:"property",entityId:p.id,metadata:{propertyName:p.name,city:p.city,district:p.district,priceFrom:p.priceFrom}});
  },[p?.id]);

  if(isLoading)return <div className={styles.loading}>Загружаем объект…</div>;
  if(error)return <div className={styles.notFound} role="alert"><strong>Не удалось загрузить объект</strong><p>Проверьте соединение и повторите попытку.</p><button onClick={()=>void refetch()}>Повторить</button><Link to="/catalog">Вернуться в каталог</Link></div>;
  if(!p)return <div className={styles.notFound}><strong>Объект не найден</strong><Link to="/catalog">Вернуться в каталог</Link></div>;

  const favorite=isFavorite(p.id);
  const developer=p.developerName&&p.developerName!=="Партнёр PULSE.DV"?p.developerName:"";
  const gallery=propertyPhotos(p);
  const mortgageRule=control.mortgagePrograms.find(rule=>rule.id===savedScenario?.programId)??control.mortgagePrograms[0];
  const minDown=mortgageRule?minimumMortgageDown(propertyPriceRub(p.priceFrom),mortgageRule.minDownPct):null;
  const presentation=p.documents?.find(doc=>doc.kind==="presentation");
  const jump=(id:string)=>document.getElementById(id)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});

  const roomOptions=[
    ...new Set([...p.floorplans].sort((a,b)=>a.sortOrder-b.sortOrder).map(plan=>plan.roomLabel)),
  ];
  const activeRoom=selectedRoom&&roomOptions.includes(selectedRoom)?selectedRoom:(roomOptions[0]||"");
  const visiblePlans=p.floorplans
    .filter(plan=>!activeRoom||plan.roomLabel===activeRoom)
    .sort((a,b)=>(a.priceFrom??Infinity)-(b.priceFrom??Infinity)||a.sortOrder-b.sortOrder);
  const fromPulse=returnTo.startsWith("/selection");
  const highlightFeature=[...p.features].sort((a,b)=>a.sortOrder-b.sortOrder)[0];
  const HighlightIcon=highlightFeature?featureIcon(highlightFeature.icon):Sparkles;

  const share=async()=>{
    try{
      if(navigator.share){
        await navigator.share({title:p.name,text:p.name+" — "+p.city+", "+p.district,url:window.location.href});
        recordPulseEvent({eventType:"property_share",entityType:"property",entityId:p.id,metadata:{city:p.city,method:"share",outcome:"completed"}});
      }else if(navigator.clipboard){
        await navigator.clipboard.writeText(window.location.href);
        setShareNotice("Ссылка скопирована");
        recordPulseEvent({eventType:"property_share",entityType:"property",entityId:p.id,metadata:{city:p.city,method:"clipboard",outcome:"completed"}});
      }
    }catch{/* Cancellation or denied clipboard access is not a completed action. */}
  };

  return <div className={styles.page}>
    <section ref={heroRef} className={styles.hero}>
      <PropertyGallery key={p.id} name={p.name} photos={gallery} index={photoIndex} onIndexChange={setPhotoIndex}/>
      <div className={styles.fade}/>
      <Link to={returnTo} className={styles.back} aria-label="Назад"><ArrowLeft size={19}/></Link>
      <div className={styles.actions}>
        <button onClick={()=>toggle(p.id)} className={favorite?styles.favorited:""} aria-pressed={favorite} aria-label={favorite?"Убрать из избранного":"В избранное"}><Heart size={18} fill={favorite?"currentColor":"none"}/></button>
        <button onClick={share} aria-label="Поделиться"><Share2 size={18}/></button>
      </div>
    </section>

    <main className={styles.content}>
      <section className={styles.intro}>
        <div className={styles.tags}>
          {p.className&&<span>{p.className}</span>}
          {p.tags.slice(0,2).map(tag=><span key={tag}>{tag}</span>)}
        </div>
        <h1>{p.name}</h1><PropertyFreshness id={p.id}/>
        <div className={styles.location}><MapPin size={14}/>{p.city} · {p.district}</div>
        <div className={styles.developerLine}><Building2 size={13}/>{developer||"Застройщик уточняется"}</div>
        {shareNotice&&<span className={styles.shareNotice} role="status">{shareNotice}</span>}
      </section>

      <nav className={styles.sectionNav} aria-label="Разделы жилого комплекса">
        {p.floorplans.length>0&&<button type="button" onClick={()=>jump('property-plans')}><LayoutGrid size={15}/>Планировки</button>}
        <button type="button" onClick={()=>jump('property-location')}><MapPin size={15}/>Расположение</button>
        {!!p.documents?.length&&<button type="button" onClick={()=>jump('property-materials')}><FileText size={15}/>Документы</button>}
      </nav>

      <section className={styles.priceCard}>
        <div>
          <span>Стоимость квартиры</span>
          <strong>{priceLabel(p.priceFrom)}</strong>
          <small>Стартовая цена. Стоимость зависит от планировки.</small>
        </div>
        {minDown!==null&&mortgageRule&&<div className={styles.downSummary}><span><small>Первоначальный взнос от {String(mortgageRule.minDownPct).replace('.',',')}%</small><b>{minDown.toLocaleString('ru-RU')} ₽</b></span><small>{mortgageRule.label}<br/>Право на программу проверим</small></div>}
        <Link to={propertyMortgageLink(p)}>
          <WalletCards size={17}/>
          <span>Рассчитать ипотеку</span>
          <ChevronRight size={16}/>
        </Link>
        {p.floorplans.length>0&&<button type="button" className={styles.pricePlans} onClick={()=>jump('property-plans')}>Выбрать планировку и её цену <ArrowDown size={14}/></button>}
      </section>

      <section className={styles.decisionCard} aria-label="Ключевые характеристики">
        <div className={styles.decisionHead}>
          <div><span>{fromPulse?"PULSE SELECT":"КЛЮЧЕВОЕ"}</span><h2>{fromPulse?"Почему PULSE показывает этот ЖК":"Почему стоит рассмотреть"}</h2></div>
          {fromPulse&&<small><Sparkles size={12}/>Из вашей подборки</small>}
        </div>
        <div className={styles.decisionRows}>
          <div><IconTile><CalendarDays size={17}/></IconTile><div><small>Срок сдачи</small><strong>{p.delivery||"Уточняется"}</strong></div></div>
          <div><IconTile><MapPin size={17}/></IconTile><div><small>Локация</small><strong>{p.district||"Уточняется"}</strong></div></div>
          <div><IconTile><HighlightIcon size={17}/></IconTile><div><small>Сильная сторона</small><strong>{highlightFeature?.label||p.className||"Параметры проекта"}</strong></div></div>
          <div><IconTile><LayoutGrid size={17}/></IconTile><div><small>Планировки</small><strong>{p.floorplans.length?p.floorplans.length+" в каталоге":"Уточняются"}</strong></div></div>
        </div>
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
            return <div key={feature.id||feature.label}><IconTile><Icon size={18}/></IconTile><strong>{feature.label}</strong></div>;
          })}
        </div>
      </section>}

      <section id="property-plans" className={styles.section} aria-label="Планировки ЖК">
        <div className={styles.sectionHead}>
          <div><span>ПЛАНИРОВКИ</span><h2>Выберите квартиру</h2></div>
          {p.floorplans.length>0&&<small>{p.floorplans.length} планировок</small>}
        </div>
        <p className={styles.sectionHint}>Откройте планировку, посмотрите её подробнее и рассчитайте платёж по выбранной цене.</p>

        {roomOptions.length>0&&<NativeSelect aria-label="Комнатность планировок" value={activeRoom} onChange={e=>setSelectedRoom(e.target.value)}>{roomOptions.map(room=><option key={room} value={room}>{room}</option>)}</NativeSelect>}

        {visiblePlans.length?<div className={styles.planRail}>
          {visiblePlans.map((plan,index)=><TrackedFloorplan property={p} plan={plan} className={styles.planCard} key={plan.id||plan.roomLabel+"-"+index}>
            <div className={styles.planImage}>
              <FloorplanViewer property={p} plan={plan}/>
            </div>
            <div className={styles.planCopy}>
              <span>{plan.roomLabel==="Студия"?"Студия":plan.roomLabel+" комн."}</span>
              <strong>{plan.areaFrom!==null
                ?plan.areaFrom+(plan.areaTo&&plan.areaTo!==plan.areaFrom?"–"+plan.areaTo:"")+" м²"
                :"Площадь уточняется"}</strong>
              <b>{plan.priceFrom!==null?priceLabel(plan.priceFrom):"Цена уточняется"}</b>
              {plan.priceFrom!==null&&<Link to={propertyMortgageLink(p,plan)}>Рассчитать платёж <ChevronRight size={14}/></Link>}
            </div>
          </TrackedFloorplan>)}
        </div>:<div className={styles.emptyPlans}>Планировки появятся после загрузки данных по проекту.</div>}
      </section>

      <section id="property-location" className={styles.section} aria-label="Расположение ЖК">
        <div className={styles.sectionHead}><div><span>РАСПОЛОЖЕНИЕ</span><h2>Где находится дом</h2></div><MapPinned size={22}/></div>
        <div className={styles.addressCard}><IconTile><MapPin size={21}/></IconTile><div><strong>{p.address||p.city}</strong><small>{[p.city,p.district].filter(Boolean).join(' · ')}</small></div></div>
        <Link className={styles.mapLink} to={'/catalog?'+new URLSearchParams({view:'map',city:p.city,q:p.name})}>Посмотреть ЖК на карте <ChevronRight size={16}/></Link>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}><div><span>ХАРАКТЕРИСТИКИ</span><h2>Детали проекта</h2></div></div>
        <div className={styles.specs}>
          <div><span>Адрес</span><strong>{p.address||p.city+" · "+p.district}</strong></div>
          <div><span>Застройщик</span><strong>{developer||"Уточняется"}</strong></div>
          <div><span>Класс</span><strong>{p.className||"Уточняется"}</strong></div>
          <div><span>Срок сдачи</span><strong>{p.delivery||"Уточняется"}</strong></div>
          <div><span>Цена от</span><strong>{priceLabel(p.priceFrom).replace("от ","")}</strong></div>
          <div><span>Типы квартир</span><strong>{roomOptions.length?roomOptions.join(" · "):"Уточняются"}</strong></div>
        </div>
      </section>

      {(p.documents??[]).length>0&&<section id="property-materials" className={styles.section}>
        <div className={styles.sectionHead}><div><span>МАТЕРИАЛЫ</span><h2>Документы проекта</h2></div><small>{(p.documents??[]).length} файлов</small></div>
        <div className={styles.materials}>
          {(p.documents??[]).map(doc=><a key={doc.id||doc.url} href={doc.url} target="_blank" rel="noreferrer">
            <IconTile><FileText size={18}/></IconTile>
            <div><strong>{doc.name}</strong><small>{doc.kind==="presentation"?"Презентация":"Документ"}{doc.sizeBytes?" · "+Math.round(doc.sizeBytes/1024/1024*10)/10+" МБ":""}</small></div>
            <ChevronRight size={16}/>
          </a>)}
        </div>
      </section>}

      <section className={styles.helpCard}><IconTile><MessageCircle size={22}/></IconTile><h2>Разберёмся в деталях вместе</h2><p>Уточним наличие, сравним планировки и подберём условия покупки именно для вас.</p><LeadSheet title="Задать вопрос по ЖК" project={p.name} propertyId={p.id} source="property"><button>Задать вопрос <ChevronRight size={16}/></button></LeadSheet></section>

      <Sheet>
        <SheetTrigger asChild>
          <button className={styles.developer}>
            <IconTile as="div" className={styles.devIcon}><Building2 size={20}/></IconTile>
            <div><span>Застройщик</span><strong>{developer||"Информация уточняется"}</strong><small><ShieldCheck size={12}/> Данные проекта в базе PULSE.DV</small></div>
            <ChevronRight size={18}/>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className={styles.developerSheet}>
          <SheetHeader><SheetTitle>{developer||"О проекте"}</SheetTitle><SheetDescription>Перед бронированием менеджер PULSE.DV уточнит актуальные цены, наличие квартир и условия покупки.</SheetDescription></SheetHeader>
          <div className={styles.developerInfo}><ShieldCheck size={22}/><span><strong>Проверим перед сделкой</strong><small>Данные в приложении используются для подбора. Коммерческие условия могут меняться.</small></span></div>
        </SheetContent>
      </Sheet>
    </main>

    <div className={styles.ctaBar} role="region" aria-label="Действия с ЖК">
      {presentation?<a className={styles.secondary} href={presentation.url} target="_blank" rel="noreferrer"><FileText size={17}/><span>Презентация</span></a>:<LeadSheet title="Получить презентацию" project={p.name} propertyId={p.id} source="presentation">
        <button className={styles.secondary}><Send size={17}/><span>Презентация</span></button>
      </LeadSheet>}
      <LeadSheet title="Узнать наличие" project={p.name} propertyId={p.id} source="property">
        <button className={styles.primary}><span>Узнать наличие</span><ChevronRight size={18}/></button>
      </LeadSheet>
    </div>
  </div>;
}
