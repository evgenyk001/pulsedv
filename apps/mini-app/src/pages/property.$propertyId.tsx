import {sortRoomLabels,normalizeRoomLabel} from '../../../../packages/domain/catalogFacets';
import {BackLink} from "../components/BackLink";
import {usePropertyHeroMotion} from "../helpers/usePropertyHeroMotion";
import {IconTile} from '../components/IconTile';
import { PropertyFreshness } from '../components/PropertyFreshness';
import React from "react";

import {propertyReturn} from "../helpers/navigationMemory";
import {FloorplanViewer} from "../components/FloorplanViewer";
import {APARTMENT_FINISHES,planFinishOffers,planPriceForFinish,planStartingPrice,apartmentFinishLabel} from "../../../../packages/domain/propertyFinish";
import type {ApartmentFinish} from "../../../../packages/pulse-data/model";
import {PropertyGallery} from "../components/PropertyGallery";
import {usePulseControlState} from "../helpers/usePulseControlState";
import {propertyPhotos,propertyMortgageLink,propertyPriceLabel,propertyPriceRub} from "../../../../packages/domain/propertyPresentation";
import {calculateMortgageScenario,readMortgageScenario} from "../../../../packages/domain/mortgagePolicy";
import { TrackedFloorplan } from "../components/TrackedFloorplan";
import { Link, useParams, useLocation } from "react-router-dom";
import {
  Heart, Share2, MapPin, CalendarDays, Building2, Waves, Trees, CarFront,
  Baby, ShieldCheck, ChevronRight, Send, Sparkles, MapPinned, LayoutGrid, Ruler,
  WalletCards, FileText, MessageCircle
} from "lucide-react";
import { LeadSheet } from "../components/LeadSheet";
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

// Restore this history entry's choices on Back, without carrying them into a new visit.
type PropertySelection={room:string;finish:ApartmentFinish|null};
const propertySelections=new Map<string,PropertySelection>();

const formatProjectDate=(value:string|null|undefined)=>{
 if(!value||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const date=new Date(value+'T00:00:00Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(date):null;
};

export default function PropertyPage(){
  const {propertyId=""}=useParams();
  const location=useLocation();
  const stateReturn=typeof location.state?.returnTo==="string"&&/^\/(catalog|favorites|compare|selection|journey)?([?]|$)/.test(location.state.returnTo)?location.state.returnTo:null;
  const rememberedReturn=propertyReturn();
  const returnTo=stateReturn??rememberedReturn;
  const {data:p,isLoading,error,refetch}=usePropertyDetail(propertyId);
  const heroRef=usePropertyHeroMotion(!isLoading&&!error?p?.id:undefined);
  const control=usePulseControlState();
  const savedScenario=React.useMemo(()=>readMortgageScenario(localStorage),[]);
  const {toggle,isFavorite}=useFavoriteIds();
  const [photoIndex,setPhotoIndex]=React.useState(0);
  const selectionKey=location.key+':'+propertyId;
  const [selectedRoom,setSelectedRoom]=React.useState(()=>propertySelections.get(selectionKey)?.room??"");
  const [selectedFinish,setSelectedFinish]=React.useState<ApartmentFinish|null>(()=>propertySelections.get(selectionKey)?.finish??null);
  const [shareNotice,setShareNotice]=React.useState("");

  const rememberSelection=(value:PropertySelection)=>{
    propertySelections.delete(selectionKey);propertySelections.set(selectionKey,value);
    if(propertySelections.size>60)propertySelections.delete(propertySelections.keys().next().value!);
  };
  const selectRoom=(room:string)=>{setSelectedRoom(room);rememberSelection({room,finish:selectedFinish})};
  const selectFinish=(finish:ApartmentFinish|null)=>{setSelectedFinish(finish);rememberSelection({room:selectedRoom,finish})};
  React.useLayoutEffect(()=>{
    const saved=propertySelections.get(selectionKey);
    setPhotoIndex(0);setSelectedRoom(saved?.room??"");setSelectedFinish(saved?.finish??null);setShareNotice("");
  },[selectionKey]);

  React.useEffect(()=>{
    if(!p)return;
    try{localStorage.setItem("pulse.last-property",JSON.stringify({id:p.id,name:p.name,at:Date.now()}))}catch{}
    recordPulseEvent({eventType:"property_view",entityType:"property",entityId:p.id,metadata:{propertyName:p.name,city:p.city,district:p.district,priceFrom:p.priceFrom}});
  },[p?.id]);

  if(isLoading)return <div className={styles.loading}>Загружаем объект…</div>;
  if(error)return <div className={styles.notFound} role="alert"><strong>Не удалось загрузить объект</strong><p>Проверьте соединение и повторите попытку.</p><button onClick={()=>void refetch()}>Повторить</button><Link to="/catalog">Вернуться в каталог</Link></div>;
  if(!p)return <div className={styles.notFound}><strong>Объект не найден</strong><Link to="/catalog">Вернуться в каталог</Link></div>;

  const favorite=isFavorite(p.id);
  const developer=p.developerName&&!/^Партнёр (PULSE\.DV|PULSEDV\.RU)$/.test(p.developerName)?p.developerName:"";
  const gallery=propertyPhotos(p);
  const mortgageRule=control.mortgagePrograms.find(rule=>rule.id===savedScenario?.programId)??control.mortgagePrograms[0];
  const hasConfirmedFinishingPrices=p.floorplans.some(plan=>planFinishOffers(plan).some(offer=>offer.priceFrom!==null));
  const matchedPricedPlans=(selectedFinish?p.floorplans.map(plan=>({plan,price:planPriceForFinish(plan,selectedFinish)})):hasConfirmedFinishingPrices?p.floorplans.map(plan=>({plan,price:planStartingPrice(plan)})):[])
    .filter((offer):offer is {plan:typeof p.floorplans[number];price:number}=>offer.price!==null).sort((a,b)=>a.price-b.price);
  const selectedPrice=selectedFinish?(matchedPricedPlans[0]?.price??null):(matchedPricedPlans[0]?.price??p.priceFrom);
  const mortgagePrice=selectedPrice===null?null:propertyPriceRub(selectedPrice);
  const minDown=mortgageRule&&mortgagePrice!==null?calculateMortgageScenario({programs:control.mortgagePrograms,settings:{...savedScenario,programId:mortgageRule.id,propertyKind:'newbuild',largeArea:false},price:mortgagePrice,down:0})?.requiredDown??null:null;
  const presentation=p.documents?.find(doc=>doc.kind==="presentation");
  const jump=(id:string)=>document.getElementById(id)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});

  const roomOptions=sortRoomLabels(p.floorplans.map(plan=>plan.roomLabel));
  const activeRoom=selectedRoom&&roomOptions.includes(selectedRoom)?selectedRoom:"";
  const details=p.projectDetails;
  const finishTypes=APARTMENT_FINISHES.filter(([value])=>
    (details?.finishes??[]).includes(value)||p.floorplans.some(plan=>planFinishOffers(plan).some(offer=>offer.finishType===value))
  );
  const priceForPlan=(plan:typeof p.floorplans[number])=>selectedFinish?planPriceForFinish(plan,selectedFinish):planStartingPrice(plan);
  const matchesFinish=(plan:typeof p.floorplans[number])=>!selectedFinish||planFinishOffers(plan).some(offer=>offer.finishType===selectedFinish);
  const visiblePlans=p.floorplans
    .filter(plan=>activeRoom&&normalizeRoomLabel(plan.roomLabel)===activeRoom&&matchesFinish(plan))
    .sort((a,b)=>(priceForPlan(a)??Infinity)-(priceForPlan(b)??Infinity)||a.sortOrder-b.sortOrder);
  const fromPulse=returnTo.startsWith("/selection");
  const areaValues=p.floorplans.flatMap(plan=>plan.areaFrom!==null?[plan.areaFrom]:[]).filter((v):v is number=>typeof v==='number'&&v>0);
  const minArea=areaValues.length?Math.min(...areaValues):null;
  const commissioning=formatProjectDate(details?.commissioningDate);
  // Only a few key facts appear above apartment selection. The full spec is below.
  const facts=[
    {label:'Срок сдачи',value:p.delivery||'Уточняется',icon:CalendarDays},
    ...(minArea!==null?[{label:'Площадь от',value:minArea.toLocaleString('ru-RU')+' м²',icon:Ruler}]:[]),
    ...(commissioning?[{label:'Ввод дома',value:commissioning,icon:Building2}]:[]),
    ...(details?.availableApartments!=null?[{label:'В продаже',value:details.availableApartments.toLocaleString('ru-RU')+' кв.',icon:LayoutGrid}]:details?.totalApartments!=null?[{label:'Всего квартир',value:details.totalApartments.toLocaleString('ru-RU'),icon:LayoutGrid}]:[]),
    ...(p.className?[{label:'Класс жилья',value:p.className,icon:ShieldCheck}]:[]),
  ].slice(0,4);

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
      <BackLink to={returnTo} className={styles.back} hero aria-label="Назад"/>
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
        <h1>{p.name}</h1>{fromPulse&&<span className={styles.selectionBadge}>Из вашей подборки PULSE Select</span>}
        <div className={styles.location}><MapPin size={14}/>{p.city} · {p.district}</div>
        <div className={styles.developerLine}><Building2 size={13}/>{developer||"Застройщик уточняется"}</div>
        {shareNotice&&<span className={styles.shareNotice} role="status">{shareNotice}</span>}
      </section>



      <div className={styles.quickFacts} role="region" aria-label="Главное о жилом комплексе">
        {facts.map(({label,value,icon:Icon})=><div key={label} className={styles.quickFact}><Icon size={17}/><span><small>{label}</small><strong>{value}</strong></span></div>)}
      </div>

      <section className={styles.priceCard} aria-label="Стоимость и ипотека">
        <div className={styles.priceMain}>
          <span>{selectedFinish?'ЦЕНА С ОТДЕЛКОЙ · '+apartmentFinishLabel(selectedFinish):'ЦЕНА КВАРТИРЫ ОТ'}</span>
          <strong>{selectedPrice!==null?priceLabel(selectedPrice):'Цена уточняется'}</strong>
          <small>{selectedFinish?'Цена зависит от планировки и выбранной отделки.':'Стоимость зависит от квартиры и отделки.'}</small>
        </div>
        {minDown!==null&&mortgageRule&&mortgagePrice!==null&&<div className={styles.downSummary}><span><small>Первоначальный взнос от {String(Math.round(minDown/mortgagePrice*1000)/10).replace('.',',')}%</small><b>{minDown.toLocaleString('ru-RU')} ₽</b></span><small>{mortgageRule.label}<br/>Право на программу проверим</small></div>}
        {selectedPrice!==null?<Link to={matchedPricedPlans[0]?propertyMortgageLink(p,matchedPricedPlans[0].plan,selectedFinish):propertyMortgageLink(p)}>
          <WalletCards size={18}/>
          <span>Рассчитать ипотеку</span>
          <ChevronRight size={17}/>
        </Link>:<div className={styles.pricePending}>Цена выбранной отделки пока не подтверждена. Уточним стоимость у застройщика.</div>}
        <details className={styles.priceFreshness}>
          <summary><ShieldCheck size={15}/>Цены и наличие подтвердим перед бронированием <ChevronRight size={15}/></summary>
          <PropertyFreshness id={p.id}/>
        </details>
      </section>

      {roomOptions.length>0&&<section id="property-plans" className={styles.apartmentSummary} aria-label="Квартиры и планировки ЖК">
        <div className={styles.sectionHead}><div><span>ВЫБОР КВАРТИРЫ</span><h2>Квартиры и планировки</h2></div><small>{p.floorplans.length} планировок</small></div>
        <p className={styles.sectionHint}>{details?.availableApartments!=null?'В продаже: '+details.availableApartments.toLocaleString('ru-RU')+' · ':''}Выберите комнатность, затем откройте понравившуюся планировку.</p>
        {finishTypes.length>0&&<div className={styles.finishSummary} role="group" aria-label="Варианты отделки">
          <div className={styles.finishTop}><span>Отделка</span><small>Меняет цену и доступные варианты</small></div>
          <div className={styles.finishPills}>
            <button type="button" aria-pressed={selectedFinish===null} className={selectedFinish===null?styles.finishSelected:""} onClick={()=>selectFinish(null)}>Все варианты</button>
            {finishTypes.map(([value,label])=><button key={value} type="button" aria-pressed={selectedFinish===value} className={selectedFinish===value?styles.finishSelected:""} onClick={()=>selectFinish(value)}>{label}</button>)}
          </div>
          <details className={styles.finishHelp}><summary>Чем отличаются варианты отделки?</summary>
            <p><b>Черновая:</b> основные строительные работы без чистовой отделки.</p>
            <p><b>White Box:</b> предчистовая подготовка под финальные покрытия.</p>
            <p><b>Готовый ремонт:</b> квартира с выполненной чистовой отделкой.</p>
            <p><b>Без отделки:</b> без отделочных работ или с минимальной подготовкой.</p>
            <small>Точный состав работ различается у застройщиков и указан в договоре.</small>
          </details>
        </div>}
        <div className={styles.roomCards}>{roomOptions.map(room=>{
          const plans=p.floorplans.filter(plan=>normalizeRoomLabel(plan.roomLabel)===room);
          const matching=plans.filter(matchesFinish);
          const prices=matching.map(priceForPlan).filter((price):price is number=>price!==null);
          const areas=matching.flatMap(plan=>plan.areaFrom!==null?[plan.areaFrom]:[]);
          const disabled=matching.length===0;
          const open=activeRoom===room;
          return <button type="button" key={room} aria-label={'Выбрать планировки: '+room} aria-expanded={open} aria-controls="room-plan-options" disabled={disabled} className={open?styles.selectedRoom:''} onClick={()=>selectRoom(open?'':room)}><span>{room==='Студия'?'Студии':room+' комн.'}<ChevronRight size={15}/></span><strong>{disabled?'Нет вариантов':prices.length?priceLabel(Math.min(...prices)):'Цена уточняется'}</strong><small>{disabled?'В выбранной отделке':(areas.length?'от '+Math.min(...areas).toLocaleString('ru-RU')+' м² · ':'')+'Планировок: '+matching.length}</small></button>;
        })}</div>
        {activeRoom&&<div id="room-plan-options" className={styles.planPanel}>
          <div className={styles.planPanelHeader}><div><span>ПЛАНИРОВКИ</span><h3>{activeRoom==='Студия'?'Студии':activeRoom+' комн.'}</h3></div><button type="button" aria-label="Скрыть планировки" onClick={()=>selectRoom('')}>Свернуть <ChevronRight size={15}/></button></div>
          {visiblePlans.length?<div className={styles.planRail}>
            {visiblePlans.map((plan,index)=>{
              const planPrice=priceForPlan(plan);
              const offers=planFinishOffers(plan);
              return <TrackedFloorplan property={p} plan={plan} className={styles.planCard} key={plan.id||plan.roomLabel+'-'+index}>
                <div className={plan.imageUrl?styles.planImage:styles.planImageMissing}><FloorplanViewer property={p} plan={plan} preferredFinish={selectedFinish}/></div>
                <div className={styles.planCopy}>
                  <span>{plan.roomLabel==='Студия'?'Студия':plan.roomLabel+' комн.'}</span>
                  <strong>{plan.areaFrom!==null?plan.areaFrom+(plan.areaTo&&plan.areaTo!==plan.areaFrom?'–'+plan.areaTo:'')+' м²':'Площадь уточняется'}</strong>
                  {offers.length>0&&<span className={styles.planFinishes}>{selectedFinish?apartmentFinishLabel(selectedFinish):offers.map(offer=>apartmentFinishLabel(offer.finishType)).join(' · ')}</span>}
                  <b>{planPrice!==null?priceLabel(planPrice):'Цена уточняется'}</b>
                  {planPrice!==null?<Link to={propertyMortgageLink(p,plan,selectedFinish)}>Рассчитать платёж <ChevronRight size={14}/></Link>:<small>Уточните стоимость у менеджера</small>}
                </div>
              </TrackedFloorplan>;
            })}
          </div>:<div className={styles.emptyPlans}>Для этой комнатности пока нет подтверждённых вариантов с выбранной отделкой.</div>}
        </div>}
      </section>}

      <section className={styles.section}>
        <div className={styles.sectionHead}><div><span>О ПРОЕКТЕ</span><h2>Главное о {p.name}</h2></div></div>
        <p className={styles.desc}>{p.description||"Описание проекта уточняется."}</p>
      {p.features.length>0&&<>
        <div className={styles.features}>
          {[...p.features].sort((a,b)=>a.sortOrder-b.sortOrder).map(feature=>{
            const Icon=featureIcon(feature.icon);
            return <div key={feature.id||feature.label}><IconTile><Icon size={18}/></IconTile><strong>{feature.label}</strong></div>;
          })}
        </div>
      </>}
      </section>

      <section id="property-location" className={styles.section} aria-label="Расположение ЖК">
        <div className={styles.sectionHead}><div><span>РАСПОЛОЖЕНИЕ</span><h2>Где находится дом</h2></div><MapPinned size={22}/></div>
        <div className={styles.addressCard}><IconTile><MapPin size={21}/></IconTile><div><strong>{p.address||p.city}</strong><small>{[p.city,p.district].filter(Boolean).join(' · ')}</small></div></div>
        <Link className={styles.mapLink} to={'/catalog?'+new URLSearchParams({view:'map',city:p.city,q:p.name})}>Посмотреть ЖК на карте <ChevronRight size={16}/></Link>
      </section>

      <details className={styles.moreDetails}>
        <summary>Все характеристики ЖК <ChevronRight size={18}/></summary>
        <div className={styles.specs}>
          <div><span>Адрес</span><strong>{p.address||p.city+" · "+p.district}</strong></div>
          <div><span>Застройщик</span><strong>{developer||"Уточняется"}</strong></div>
          <div><span>Класс</span><strong>{p.className||"Уточняется"}</strong></div>
          <div><span>Срок сдачи</span><strong>{p.delivery||"Уточняется"}</strong></div>
          <div><span>Плановый ввод дома</span><strong>{commissioning||"Дата уточняется"}</strong></div>
          {details?.totalApartments!=null&&<div><span>Всего квартир в ЖК</span><strong>{details.totalApartments.toLocaleString('ru-RU')}</strong></div>}
          {details?.availableApartments!=null&&<div><span>Квартир в продаже</span><strong>{details.availableApartments.toLocaleString('ru-RU')}</strong></div>}
          <div><span>Цена от</span><strong>{priceLabel(p.priceFrom).replace("от ","")}</strong></div>
          <div><span>Типы квартир</span><strong>{roomOptions.length?roomOptions.join(" · "):"Уточняются"}</strong></div>
          <div><span>Отделка</span><strong>{finishTypes.length?finishTypes.map(([,label])=>label).join(" · "):"Уточняется"}</strong></div>
        </div>
      </details>

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
