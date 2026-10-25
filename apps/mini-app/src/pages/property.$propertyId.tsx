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
  const [selectedRoom,setSelectedRoom]=React.useState("");
  const [selectedFinish,setSelectedFinish]=React.useState<ApartmentFinish|null>(null);
  const [shareNotice,setShareNotice]=React.useState("");

  React.useEffect(()=>{setPhotoIndex(0);setSelectedRoom("");setSelectedFinish(null);setShareNotice("")},[propertyId]);

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
  const matchedPricedPlans=selectedFinish?p.floorplans.map(plan=>({plan,price:planPriceForFinish(plan,selectedFinish)})).filter((offer):offer is {plan:typeof p.floorplans[number];price:number}=>offer.price!==null).sort((a,b)=>a.price-b.price):[];
  const selectedPrice=selectedFinish?(matchedPricedPlans[0]?.price??null):p.priceFrom;
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
  const facts=[
    {label:'Срок сдачи',value:p.delivery||'Уточняется',icon:CalendarDays},
    ...(commissioning?[{label:'Плановый ввод дома',value:commissioning,icon:Building2}]:[]),
    ...(details?.totalApartments!=null?[{label:'Всего квартир в ЖК',value:details.totalApartments.toLocaleString('ru-RU'),icon:LayoutGrid}]:[]),
    ...(details?.availableApartments!=null?[{label:'Квартир в продаже',value:details.availableApartments.toLocaleString('ru-RU'),icon:Building2}]:[]),
    ...(minArea!==null?[{label:'Площадь от',value:minArea.toLocaleString('ru-RU')+' м²',icon:Ruler}]:[]),
    ...(p.className?[{label:'Класс жилья',value:p.className,icon:ShieldCheck}]:[]),
  ];
  if(facts.length<4&&roomOptions.length)facts.push({label:'Типы квартир',value:roomOptions.join(' · '),icon:LayoutGrid});

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
        <h1>{p.name}</h1>{fromPulse&&<span className={styles.selectionBadge}>Из вашей подборки PULSE Select</span>}<PropertyFreshness id={p.id}/>
        <div className={styles.location}><MapPin size={14}/>{p.city} · {p.district}</div>
        <div className={styles.developerLine}><Building2 size={13}/>{developer||"Застройщик уточняется"}</div>
        {shareNotice&&<span className={styles.shareNotice} role="status">{shareNotice}</span>}
      </section>



      <section className={styles.priceCard}>
        <div>
          <span>{selectedFinish?'Квартиры · '+apartmentFinishLabel(selectedFinish):'Стоимость квартиры'}</span>
          <strong>{selectedPrice!==null?priceLabel(selectedPrice):'Цена уточняется'}</strong>
          <small>{selectedFinish?'Цена зависит от выбранной планировки и отделки.':'Стартовая цена. Стоимость зависит от планировки.'}</small>
        </div>
        <div className={styles.projectFacts} role="region" aria-label="Ключевые характеристики">{facts.map(({label,value,icon:Icon})=><div key={label}><Icon size={16}/><span>{label}</span><strong>{value}</strong></div>)}</div>
        <div className={styles.finishSummary} role="group" aria-label="Варианты отделки">
          <span className={styles.finishLabel}>ОТДЕЛКА КВАРТИР</span>
          {finishTypes.length>0?<><div className={styles.finishPills}>
            <button type="button" aria-pressed={selectedFinish===null} className={selectedFinish===null?styles.finishSelected:""} onClick={()=>setSelectedFinish(null)}>Все варианты</button>
            {finishTypes.map(([value,label])=><button key={value} type="button" aria-pressed={selectedFinish===value} className={selectedFinish===value?styles.finishSelected:""} onClick={()=>setSelectedFinish(value)}>{label}</button>)}
          </div><small>Выберите отделку. Цены и доступные планировки зависят от варианта.</small>
          <details className={styles.finishHelp}><summary>Чем отличаются варианты отделки?</summary>
            <p><b>Черновая:</b> основные строительные работы без чистовой отделки.</p>
            <p><b>White Box:</b> предчистовая подготовка под финальные покрытия.</p>
            <p><b>Готовый ремонт:</b> квартира с выполненной чистовой отделкой.</p>
            <p><b>Без отделки:</b> без отделочных работ или с минимальной подготовкой.</p>
            <small>Точный состав работ различается у застройщиков и указан в договоре.</small>
          </details></>:
          <strong className={styles.finishUnknown}>Отделка уточняется</strong>}
        </div>
        {minDown!==null&&mortgageRule&&mortgagePrice!==null&&<div className={styles.downSummary}><span><small>Первоначальный взнос от {String(Math.round(minDown/mortgagePrice*1000)/10).replace('.',',')}%</small><b>{minDown.toLocaleString('ru-RU')} ₽</b></span><small>{mortgageRule.label}<br/>Право на программу проверим</small></div>}
        {selectedPrice!==null?<Link to={selectedFinish&&matchedPricedPlans[0]?propertyMortgageLink(p,matchedPricedPlans[0].plan,selectedFinish):propertyMortgageLink(p)}>
          <WalletCards size={17}/>
          <span>Рассчитать ипотеку</span>
          <ChevronRight size={16}/>
        </Link>:<div className={styles.pricePending}>Стоимость этой отделки ещё не подтверждена. Выберите другой вариант или уточните цену у менеджера.</div>}
        {p.floorplans.length>0&&<button type="button" className={styles.pricePlans} onClick={()=>jump('property-plans')}>Выбрать планировку и её цену <ArrowDown size={14}/></button>}
      </section>

      <nav className={styles.sectionNav} aria-label="Разделы жилого комплекса">
        {p.floorplans.length>0&&<button type="button" onClick={()=>jump('property-plans')}><LayoutGrid size={15}/>Планировки</button>}
        <button type="button" onClick={()=>jump('property-location')}><MapPin size={15}/>Расположение</button>
        {!!p.documents?.length&&<button type="button" onClick={()=>jump('property-materials')}><FileText size={15}/>Документы</button>}
      </nav>

      {roomOptions.length>0&&<section id="property-plans" className={styles.apartmentSummary} aria-label="Квартиры и планировки ЖК">
        <div className={styles.sectionHead}><div><span>КВАРТИРЫ И ПЛАНИРОВКИ</span><h2>Найдите свой вариант</h2></div><small>{p.floorplans.length} планировок</small></div>
        <p className={styles.sectionHint}>{details?.availableApartments!=null?'В продаже: '+details.availableApartments.toLocaleString('ru-RU')+' '+(details.availableApartments%100>=11&&details.availableApartments%100<=14?'квартир':details.availableApartments%10===1?'квартира':details.availableApartments%10>=2&&details.availableApartments%10<=4?'квартиры':'квартир')+'. ':'Актуальное наличие уточним по запросу. '}Нажмите на комнатность, чтобы посмотреть планировки и цены.</p>
        {finishTypes.length>0&&<div className={styles.activeFinish}>Отделка: <strong>{selectedFinish?apartmentFinishLabel(selectedFinish):'все варианты'}</strong></div>}
        <div className={styles.roomCards}>{roomOptions.map(room=>{
          const plans=p.floorplans.filter(plan=>normalizeRoomLabel(plan.roomLabel)===room);
          const matching=plans.filter(matchesFinish);
          const prices=matching.map(priceForPlan).filter((price):price is number=>price!==null);
          const areas=matching.flatMap(plan=>plan.areaFrom!==null?[plan.areaFrom]:[]);
          const disabled=matching.length===0;
          const open=activeRoom===room;
          return <button type="button" key={room} aria-label={'Выбрать планировки: '+room} aria-expanded={open} aria-controls="room-plan-options" disabled={disabled} className={open?styles.selectedRoom:''} onClick={()=>setSelectedRoom(open?'':room)}><span>{room==='Студия'?'Студии':room+' комн.'}<ChevronRight size={15}/></span><strong>{disabled?'Нет вариантов':prices.length?priceLabel(Math.min(...prices)):'Цена уточняется'}</strong><small>{disabled?'В выбранной отделке':(areas.length?'от '+Math.min(...areas).toLocaleString('ru-RU')+' м² · ':'')+'Планировок: '+matching.length}</small></button>;
        })}</div>
        {activeRoom&&<div id="room-plan-options" className={styles.planPanel}>
          <div className={styles.planPanelHeader}><div><span>ПЛАНИРОВКИ</span><h3>{activeRoom==='Студия'?'Студии':activeRoom+' комн.'}</h3></div><button type="button" aria-label="Скрыть планировки" onClick={()=>setSelectedRoom('')}>Свернуть <ChevronRight size={15}/></button></div>
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

      {developer&&<Sheet>
        <SheetTrigger asChild>
          <button className={styles.developer}>
            <IconTile as="div" className={styles.devIcon}><Building2 size={20}/></IconTile>
            <div><span>Застройщик</span><strong>{developer||"Информация уточняется"}</strong><small><ShieldCheck size={12}/> Данные проекта в базе PULSEDV.RU</small></div>
            <ChevronRight size={18}/>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className={styles.developerSheet}>
          <SheetHeader><SheetTitle>{developer||"О проекте"}</SheetTitle><SheetDescription>Перед бронированием менеджер PULSEDV.RU уточнит актуальные цены, наличие квартир и условия покупки.</SheetDescription></SheetHeader>
          <div className={styles.developerInfo}><ShieldCheck size={22}/><span><strong>Проверим перед сделкой</strong><small>Данные в приложении используются для подбора. Коммерческие условия могут меняться.</small></span></div>
        </SheetContent>
      </Sheet>}
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
