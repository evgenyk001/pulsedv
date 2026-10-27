import {propertyAreaRange,dimensionRange} from '../../../../packages/domain/propertyDimensions';
import {LoadRecovery} from '../components/LoadRecovery';
import {sortRoomLabels,normalizeRoomLabel} from '../../../../packages/domain/catalogFacets';
import {BackLink} from "../components/BackLink";
import {usePropertyHeroMotion} from "../helpers/usePropertyHeroMotion";
import {IconTile} from '../components/IconTile';
import { PropertyFreshness } from '../components/PropertyFreshness';
import React from "react";

import {propertyReturn} from "../helpers/navigationMemory";
import {FloorplanViewer} from "../components/FloorplanViewer";
import {APARTMENT_FINISHES,canonicalApartmentFinish,planFinishOffers,planPriceForFinish,planStartingPrice,apartmentFinishLabel} from "../../../../packages/domain/propertyFinish";
import type {ApartmentFinish} from "../../../../packages/pulse-data/model";
import {PropertyGallery} from "../components/PropertyGallery";
import {usePulseControlState} from "../helpers/usePulseControlState";
import {propertyPhotos,propertyMortgageLink,propertyPriceLabel,planPriceLabel,propertyPriceRub} from "../../../../packages/domain/propertyPresentation";
import {calculateMortgageScenario,readMortgageScenario,newbuildHasIncreasedLimit} from "../../../../packages/domain/mortgagePolicy";
import { TrackedFloorplan } from "../components/TrackedFloorplan";
import { Link, useParams, useLocation } from "react-router-dom";
import {
  Heart, Share2, MapPin, CalendarDays, Building2, Waves, Trees, CarFront,
  Baby, ShieldCheck, ChevronRight, Send, Sparkles, MapPinned, Ruler,
  WalletCards, FileText
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
const counted=(n:number,one:string,few:string,many:string)=>n.toLocaleString('ru-RU')+' '+(n%100>=11&&n%100<=14?many:n%10===1?one:n%10>=2&&n%10<=4?few:many);

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
  if(error&&!p)return <div className={styles.notFound}><LoadRecovery label="Обновить ЖК" onRetry={()=>void refetch()}/><Link to="/catalog">Вернуться в каталог</Link></div>;
  if(!p)return <div className={styles.notFound}><strong>Объект не найден</strong><Link to="/catalog">Вернуться в каталог</Link></div>;

  const favorite=isFavorite(p.id);
  const developer=p.developerName&&!/^Партнёр (PULSE\.DV|PULSEDV\.RU)$/.test(p.developerName)?p.developerName:"";
  const gallery=propertyPhotos(p);
  const roomOptions=sortRoomLabels(p.floorplans.map(plan=>plan.roomLabel));
  const activeRoom=selectedRoom&&roomOptions.includes(selectedRoom)?selectedRoom:"";
  const mortgageRule=control.mortgagePrograms.find(rule=>rule.id===savedScenario?.programId)??control.mortgagePrograms[0];
  const hasConfirmedFinishingPrices=p.floorplans.some(plan=>planFinishOffers(plan).some(offer=>offer.priceFrom!==null));
  const usesPlanPrice=!!selectedFinish||!!activeRoom||hasConfirmedFinishingPrices;
  const matchedPricedPlans=(usesPlanPrice?p.floorplans.filter(plan=>!activeRoom||normalizeRoomLabel(plan.roomLabel)===activeRoom).map(plan=>({plan,price:selectedFinish?planPriceForFinish(plan,selectedFinish):planStartingPrice(plan)})):[])
    .filter((offer):offer is {plan:typeof p.floorplans[number];price:number}=>offer.price!==null).sort((a,b)=>a.price-b.price);
  const selectedPrice=usesPlanPrice?(matchedPricedPlans[0]?.price??null):p.priceFrom;
  const mortgagePrice=selectedPrice===null?null:propertyPriceRub(selectedPrice);
  const mortgagePlan=matchedPricedPlans[0]?.plan??p.floorplans.find(plan=>planStartingPrice(plan)!==null&&propertyPriceRub(planStartingPrice(plan)!)===mortgagePrice);
  const mortgageQuote=mortgageRule&&mortgagePrice!==null?calculateMortgageScenario({programs:control.mortgagePrograms,settings:{...savedScenario,programId:mortgageRule.id,propertyKind:'newbuild',largeArea:newbuildHasIncreasedLimit(mortgagePlan)},price:mortgagePrice,down:0}):null;
  const minDown=mortgageQuote?.requiredDown??null;
  const presentation=p.documents?.find(doc=>doc.kind==="presentation");

  const details=p.projectDetails;
  const finishTypes=APARTMENT_FINISHES.filter(([value])=>
    (details?.finishes??[]).some(finish=>canonicalApartmentFinish(finish)===value)||p.floorplans.some(plan=>planFinishOffers(plan).some(offer=>canonicalApartmentFinish(offer.finishType)===value))
  );
  const priceForPlan=(plan:typeof p.floorplans[number])=>selectedFinish?planPriceForFinish(plan,selectedFinish):planStartingPrice(plan);
  const matchesFinish=(plan:typeof p.floorplans[number])=>!selectedFinish||planFinishOffers(plan).some(offer=>canonicalApartmentFinish(offer.finishType)===canonicalApartmentFinish(selectedFinish));
  const visiblePlans=p.floorplans
    .filter(plan=>activeRoom&&normalizeRoomLabel(plan.roomLabel)===activeRoom&&matchesFinish(plan))
    .sort((a,b)=>(priceForPlan(a)??Infinity)-(priceForPlan(b)??Infinity)||a.sortOrder-b.sortOrder);
  const fromPulse=returnTo.startsWith("/selection");
  const area=propertyAreaRange(p);
  const areaLabel=dimensionRange(area.from,area.to);
  const floorsLabel=dimensionRange(details?.floorsFrom,details?.floorsTo);
  const commissioning=formatProjectDate(details?.commissioningDate);
  const inventory=details?.availableApartments!=null
    ?'В продаже: '+counted(details.availableApartments,'квартира','квартиры','квартир')+(details.totalApartments!=null?' из '+details.totalApartments.toLocaleString('ru-RU'):'')+'.'
    :details?.totalApartments!=null?'Всего в ЖК: '+counted(details.totalApartments,'квартира','квартиры','квартир')+'. Наличие уточняется.':'Актуальное наличие уточним по запросу.';
  const facts=[
    {label:'Срок сдачи',value:p.delivery||'Уточняется',icon:CalendarDays},
    ...(commissioning?[{label:'Плановый ввод дома',value:commissioning,icon:Building2}]:[]),
    ...(areaLabel?[{label:'Площадь квартир',value:areaLabel+' м²',icon:Ruler}]:[]),
    ...(p.className?[{label:'Класс жилья',value:p.className,icon:ShieldCheck}]:[]),
  ];

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
      <header className={styles.intro} role="region" aria-label="Главное о жилом комплексе">
        {p.tags.length>0&&<div className={styles.tags}>{p.tags.slice(0,2).map(tag=><span key={tag}>{tag}</span>)}</div>}
        <h1>{p.name}</h1>
        {fromPulse&&<span className={styles.selectionBadge}>Из вашей подборки PULSE Select</span>}
        <div className={styles.location}><MapPin size={14}/>{p.city} · {p.district}</div>
        <div className={styles.startingPrice} role="region" aria-label="Стоимость выбранного варианта"><strong>{selectedPrice!==null?priceLabel(selectedPrice):'Цена уточняется'}</strong><span>{[activeRoom?(activeRoom==='Студия'?'Студия':activeRoom+' комн.'):null,selectedFinish?apartmentFinishLabel(selectedFinish):null].filter(Boolean).join(' · ')||'стоимость квартир в ЖК'}</span></div>
        <details className={styles.freshness}><summary>Цены и наличие подтвердим перед бронированием <ChevronRight size={13}/></summary><PropertyFreshness id={p.id}/></details>
        {shareNotice&&<span className={styles.shareNotice} role="status">{shareNotice}</span>}
        <div className={styles.projectFacts} data-count={facts.length} role="region" aria-label="Ключевые характеристики">{facts.map(({label,value,icon:Icon})=><div key={label}><Icon size={16}/><span>{label}</span><strong>{value}</strong></div>)}</div>
      </header>

      <section id="property-plans" className={styles.apartmentSummary} aria-label="Квартиры и планировки ЖК">
        <div className={styles.sectionHead}><div><span>КВАРТИРЫ И ПЛАНИРОВКИ</span><h2>Квартиры и цены</h2></div><small>{counted(p.floorplans.length,'планировка','планировки','планировок')}</small></div>
        <p className={styles.sectionHint}>{inventory} Выберите комнатность — ниже откроются планировки.</p>
        <div className={styles.finishSummary} role="group" aria-label="Варианты отделки">
          <span className={styles.finishLabel}>Отделка</span>
          {finishTypes.length>0?<><div className={styles.finishPills}>
            <button type="button" aria-pressed={selectedFinish===null} className={selectedFinish===null?styles.finishSelected:""} onClick={()=>selectFinish(null)}>Все варианты</button>
            {finishTypes.map(([value,label])=><button key={value} type="button" aria-pressed={selectedFinish===value} className={selectedFinish===value?styles.finishSelected:""} onClick={()=>selectFinish(value)}>{label}</button>)}
          </div>
          <details className={styles.finishHelp}><summary>Чем отличаются варианты отделки?</summary>
            <p><b>Черновая:</b> основные строительные работы без чистовой отделки.</p>
            <p><b>White Box:</b> предчистовая подготовка под финальные покрытия.</p>
            <p><b>Готовый ремонт:</b> квартира с выполненной чистовой отделкой.</p>
            <p><b>Без отделки:</b> без отделочных работ или с минимальной подготовкой.</p>
            <small>Точный состав работ различается у застройщиков и указан в договоре.</small>
          </details></>:
          <strong className={styles.finishUnknown}>Уточняется</strong>}
        </div>
        {roomOptions.length===0&&<p className={styles.emptyPlans}>Планировки пока не загружены. Уточним подходящие варианты по запросу.</p>}
        <div className={styles.roomCards}>{roomOptions.map(room=>{
          const plans=p.floorplans.filter(plan=>normalizeRoomLabel(plan.roomLabel)===room);
          const matching=plans.filter(matchesFinish);
          const prices=matching.map(priceForPlan).filter((price):price is number=>price!==null);
          const areas=matching.flatMap(plan=>plan.areaFrom!==null?[plan.areaFrom]:[]);
          const disabled=matching.length===0;
          const open=activeRoom===room;
          return <button type="button" key={room} aria-label={'Выбрать планировки: '+room} aria-expanded={open} aria-controls="room-plan-options" disabled={disabled} className={open?styles.selectedRoom:''} onClick={()=>selectRoom(open?'':room)}><span>{room==='Студия'?'Студии':room+' комн.'}<ChevronRight size={15}/></span><strong>{disabled?'Нет вариантов':prices.length?priceLabel(Math.min(...prices)):'Цена уточняется'}</strong><small>{disabled?'В выбранной отделке':(areas.length?'от '+Math.min(...areas).toLocaleString('ru-RU')+' м²':'Площадь уточняется')}</small></button>;
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
                  {offers.length>0&&<span className={styles.planFinishes}>{selectedFinish?apartmentFinishLabel(selectedFinish):[...new Set(offers.map(offer=>apartmentFinishLabel(offer.finishType)))].join(' · ')}</span>}
                  <b>{planPriceLabel(plan,selectedFinish)}</b>
                  {planPrice!==null?<Link to={propertyMortgageLink(p,plan,selectedFinish)}>Рассчитать платёж <ChevronRight size={14}/></Link>:<small>Уточните стоимость у менеджера</small>}
                </div>
              </TrackedFloorplan>;
            })}
          </div>:<div className={styles.emptyPlans}>Для этой комнатности пока нет подтверждённых вариантов с выбранной отделкой.</div>}
        </div>}
        <div className={styles.financeSummary}>
          {selectedPrice!==null?<Link aria-label="Рассчитать ипотеку" aria-describedby="property-mortgage-hint" to={propertyMortgageLink(p,mortgagePlan,selectedFinish)}>
            <WalletCards size={20}/><span><strong>Рассчитать ипотеку</strong><small id="property-mortgage-hint">{minDown!==null&&mortgagePrice!==null&&mortgagePrice>0?<><span>Первоначальный взнос от {(minDown/mortgagePrice*100).toLocaleString('ru-RU',{maximumFractionDigits:3})}%</span><span>{minDown.toLocaleString('ru-RU')} ₽{mortgageRule?' · '+mortgageRule.label:''}{savedScenario?.allowBlended&&mortgageRule?.blended?' · комбинированная':''}{activeRoom?' · '+(activeRoom==='Студия'?'студия':activeRoom+' комн.'):''}</span>{mortgageQuote&&minDown>mortgageQuote.minDown&&<span>С учётом лимита кредита {mortgageQuote.totalLimit.toLocaleString('ru-RU')} ₽</span>}</>:'Для выбранной стоимости'}</small></span><ChevronRight size={17}/>
          </Link>:<p>Цена выбранного варианта уточняется. Менеджер поможет с расчётом.</p>}
        </div>
      </section>

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
      <div id="property-location" className={styles.projectLocation} role="region" aria-label="Расположение ЖК">
        <h3>Расположение</h3>
        <div className={styles.addressCard}><IconTile><MapPin size={21}/></IconTile><div><strong>{p.address||p.city}</strong><small>{[p.city,p.district].filter(Boolean).join(' · ')}</small></div></div>
        <Link className={styles.mapLink} to={'/catalog?'+new URLSearchParams({view:'map',city:p.city,q:p.name})}>Посмотреть ЖК на карте <ChevronRight size={16}/></Link>
      </div>
      {developer&&<p className={styles.developerLine}><Building2 size={15}/><span>Застройщик: {developer}</span></p>}
      <details className={styles.moreDetails}>
        <summary>Все характеристики ЖК <ChevronRight size={18}/></summary>
        <div className={styles.specs}>
          <div><span>Адрес</span><strong>{p.address||p.city+" · "+p.district}</strong></div>
          <div><span>Застройщик</span><strong>{developer||"Уточняется"}</strong></div>
          <div><span>Класс</span><strong>{p.className||"Уточняется"}</strong></div>
          <div><span>Срок сдачи</span><strong>{p.delivery||"Уточняется"}</strong></div>
          <div><span>Плановый ввод дома</span><strong>{commissioning||"Дата уточняется"}</strong></div>
          {floorsLabel&&<div><span>Этажность</span><strong>{floorsLabel}</strong></div>}
          {areaLabel&&<div><span>Площадь квартир</span><strong>{areaLabel} м²</strong></div>}
          {details?.parkingSpaces!=null&&<div><span>Парковочных мест</span><strong>{details.parkingSpaces.toLocaleString('ru-RU')}</strong></div>}
          {details?.totalApartments!=null&&<div><span>Всего квартир в ЖК</span><strong>{details.totalApartments.toLocaleString('ru-RU')}</strong></div>}
          {details?.availableApartments!=null&&<div><span>Квартир в продаже</span><strong>{details.availableApartments.toLocaleString('ru-RU')}</strong></div>}
          <div><span>Стартовая цена ЖК</span><strong>{priceLabel(p.priceFrom).replace("от ","")}</strong></div>
          <div><span>Типы квартир</span><strong>{roomOptions.length?roomOptions.join(" · "):"Уточняются"}</strong></div>
          <div><span>Отделка</span><strong>{finishTypes.length?finishTypes.map(([,label])=>label).join(" · "):"Уточняется"}</strong></div>
        </div>
      </details>

      {(p.documents??[]).length>0&&<div id="property-materials" className={styles.projectMaterials}>
        <div className={styles.sectionHead}><div><span>МАТЕРИАЛЫ</span><h2>Документы проекта</h2></div><small>{(p.documents??[]).length} файлов</small></div>
        <div className={styles.materials}>
          {(p.documents??[]).map(doc=><a key={doc.id||doc.url} href={doc.url} target="_blank" rel="noreferrer">
            <IconTile><FileText size={18}/></IconTile>
            <div><strong>{doc.name}</strong><small>{doc.kind==="presentation"?"Презентация":"Документ"}{doc.sizeBytes?" · "+Math.round(doc.sizeBytes/1024/1024*10)/10+" МБ":""}</small></div>
            <ChevronRight size={16}/>
          </a>)}
        </div>
      </div>}
      </section>

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
