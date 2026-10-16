import {IconTile} from '../components/IconTile';
import React from "react";
import {NativeSelect} from "../components/NativeSelect";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  BadgePercent,
  Calculator,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Info,
  Landmark,
  Percent,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { Slider } from "../components/Slider";
import { Switch } from "../components/Switch";
import { LeadSheet } from "../components/LeadSheet";
import { PageHeader } from "../components/PageHeader";
import { Input } from "../components/Input";
import { MortgageStoryOnboarding, MORTGAGE_STORY_STORAGE, MORTGAGE_STORY_VERSION } from "../components/MortgageStoryOnboarding";
import { usePulseControlState } from "../helpers/usePulseControlState";
import {usePropertyDetail} from "../helpers/useCatalog";
import {propertyPlan,propertyPriceRub} from "../../../../packages/domain/propertyPresentation";
import { recordPulseEvent, type MortgageProgramRule } from "../../../../packages/pulse-data";
import {
  calculateMortgageScenario,
  defaultMarketRate,
  FAMILY_SUBSIDY_YEARS,
  MORTGAGE_POLICY_VERSION,
  MORTGAGE_SCENARIO_KEY,
  readMortgageScenario,
  minimumMortgageDown,
  type FamilyChildren,
  type MortgagePropertyKind,
  type MortgageScenarioSettings,
} from "../../../../packages/domain/mortgagePolicy";
import styles from "./mortgage.module.css";

type ProgramId=MortgageProgramRule["id"];
type PropertyKind=MortgagePropertyKind;

const MONEY_STEP=100_000;
const PRICE_MIN=3_000_000;
const PRICE_MAX=45_000_000;
const RULES_UPDATED="02.10.2026";

const formatRub=(value:number)=>new Intl.NumberFormat("ru-RU").format(Math.round(value));
const formatRate=(value:number)=>String(Math.round(value*10)/10).replace(".",",")+"%";
const formatYears=(value:number)=>value+" "+(value%100>=11&&value%100<=14?"лет":value%10===1?"год":value%10>=2&&value%10<=4?"года":"лет");
const parseNumber=(value:string)=>Number(value.replace(/[^0-9.,]/g,"").replace(",","."));
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
const snap=(value:number,step:number)=>Math.round(value/step)*step;

const propertyLabels:Record<PropertyKind,string>={
  newbuild:"Новостройка",
  secondary:"Вторичка",
  house:"Дом / ИЖС",
};

export default function MortgagePage(){
  const [params]=useSearchParams();
  return <MortgageCalculator key={params.toString()}/>;
}

function MortgageCalculator(){
  const navigate=useNavigate();
  const [params]=useSearchParams();
  const sourcePropertyId=params.get('property')||'';
  const fromProperty=!!sourcePropertyId;
  const {data:sourceProperty,isLoading:sourceLoading,error:sourceError}=usePropertyDetail(sourcePropertyId);
  const sourcePlan=sourceProperty?propertyPlan(sourceProperty,params.get('floorplan')):undefined;
  const sourcePrice=sourceProperty?propertyPriceRub(sourcePlan?.priceFrom??sourceProperty.priceFrom):null;
  const sourceUnavailable=fromProperty&&!sourceLoading&&(!sourceProperty||!!sourceError);
  const requested=Number(params.get("price"));
  const control=usePulseControlState();
  const programs=control.mortgagePrograms;
  const scenarioKey=fromProperty?MORTGAGE_SCENARIO_KEY+":property:"+sourcePropertyId+":"+(params.get("floorplan")||""):MORTGAGE_SCENARIO_KEY;
  const storedScenario=React.useMemo(()=>readMortgageScenario(typeof localStorage==="undefined"?null:localStorage,scenarioKey),[scenarioKey]);
  const requestedProgram=params.get("program");
  const storedProgram=storedScenario&&programs.some(item=>item.id===storedScenario.programId)?storedScenario.programId:null;
  const initialProgram:ProgramId=programs.some(item=>item.id===requestedProgram)
    ?requestedProgram as ProgramId
    :storedProgram??programs[0]?.id??"family";
  const savedPrice=storedScenario?.price;
  const initialPrice=sourcePrice&&sourcePrice>1?sourcePrice:Number.isFinite(requested)&&requested>1
    ?fromProperty?Math.min(10_000_000_000,Math.round(requested)):clamp(Math.round(requested),PRICE_MIN,PRICE_MAX)
    :typeof savedPrice==="number"&&Number.isFinite(savedPrice)
      ?clamp(Math.round(savedPrice),PRICE_MIN,PRICE_MAX):9_000_000;
  const initialMin=minimumMortgageDown(initialPrice,programs.find(item=>item.id===initialProgram)?.minDownPct??20.1);
  const savedDown=storedScenario?.down;
  const initialDown=(fromProperty||params.get('down')!=='min')&&typeof savedDown==="number"&&Number.isFinite(savedDown)
    ?clamp(Math.round(savedDown),initialMin,initialPrice-1):initialMin;
  const initialKind:PropertyKind=fromProperty||params.get("from")==="select"?"newbuild":storedScenario?.propertyKind??"newbuild";
  const initialMarketRate=storedScenario?.propertyKind===initialKind&&storedScenario.marketRate
    ?storedScenario.marketRate
    :defaultMarketRate(programs,initialKind);

  const [program,setProgram]=React.useState<ProgramId>(initialProgram);
  const [propertyKind,setPropertyKind]=React.useState<PropertyKind>(initialKind);
  const [price,setPrice]=React.useState(initialPrice);
  const [down,setDown]=React.useState(initialDown);
  const [years,setYears]=React.useState(storedScenario?.years??15);
  const [marketRate,setMarketRate]=React.useState(initialMarketRate);
  const [marketRateDraft,setMarketRateDraft]=React.useState(String(initialMarketRate).replace(".",","));
  const [futureRateDraft,setFutureRateDraft]=React.useState(storedScenario?.futureRate===undefined?'':String(storedScenario.futureRate).replace('.',','));
  const parsedFutureRate=futureRateDraft.trim()===''?NaN:Number(futureRateDraft.replace(',','.'));
  const futureRate=Number.isFinite(parsedFutureRate)&&parsedFutureRate>=0&&parsedFutureRate<=40?parsedFutureRate:undefined;
  const [childrenCount,setChildrenCount]=React.useState<FamilyChildren>(storedScenario?.childrenCount??1);
  const [hasYoungChild,setHasYoungChild]=React.useState(storedScenario?.hasYoungChild??true);
  const [disabledChild,setDisabledChild]=React.useState(storedScenario?.disabledChild??false);
  const [largeArea,setLargeArea]=React.useState(fromProperty?false:storedScenario?.largeArea??false);
  const [priceDraft,setPriceDraft]=React.useState(formatRub(initialPrice));
  const [downDraft,setDownDraft]=React.useState(formatRub(initialDown));
  const [interacted,setInteracted]=React.useState(false);
  const [showMortgageStory,setShowMortgageStory]=React.useState(()=>{
    try{return localStorage.getItem(MORTGAGE_STORY_STORAGE)!==MORTGAGE_STORY_VERSION}catch{return true}
  });
  const lastCalculation=React.useRef("");
  const propertyKindMounted=React.useRef(false);
  const appliedSource=React.useRef(false);
  const priceTouched=React.useRef(false);

  const rule=programs.find(item=>item.id===program)??programs[0];
  if(!rule)return null;

  const settings:MortgageScenarioSettings={
    programId:program,
    propertyKind,
    childrenCount:program==="family"?childrenCount:undefined,
    hasYoungChild:program==="family"?hasYoungChild:undefined,
    disabledChild:program==="family"?disabledChild:undefined,
    largeArea:program==="farEast"?largeArea:undefined,
    marketRate,
    futureRate,
    years,
  };

  const calculation=calculateMortgageScenario({programs,settings,price,down,years});
  if(!calculation)return null;

  const downPercent=price?down/price*100:0;
  const preferredRate=calculation.preferredRate;
  const subsidizedLimit=calculation.subsidizedLimit;
  const totalLimit=calculation.totalLimit;
  const maxYears=calculation.maxYears;
  const minDown=calculation.minDown;
  const maxDown=Math.max(minDown,price-1);
  const priceMin=fromProperty?Math.min(PRICE_MIN,initialPrice,sourcePrice??PRICE_MIN):PRICE_MIN;
  const priceMax=fromProperty?Math.max(PRICE_MAX,initialPrice,sourcePrice??PRICE_MAX):PRICE_MAX;
  const loan=calculation.loan;
  const subsidizedPrincipal=calculation.subsidizedPrincipal;
  const marketPrincipal=calculation.marketPrincipal;
  const preferredPayment=calculation.preferredPayment;
  const marketPayment=calculation.marketPayment;
  const payment=calculation.payment;
  const totalKnown=calculation.totalKnown;
  const overpayment=calculation.overpayment;
  const mixed=calculation.mixed;
  const requiredDown=calculation.requiredDown;
  const invalid=calculation.invalid;
  const income=payment/.45;

  const familyEligibilityBlocked=program==="family"&&!hasYoungChild&&!disabledChild;
  const objectBlocked=program==="it"&&propertyKind==="secondary";
  const limitExceeded=calculation.blockReason==="Сумма кредита выше доступного лимита";

  const cardRate=(id:ProgramId)=>{
    const item=programs.find(value=>value.id===id);
    if(id==="family")return program==="family"?formatRate(preferredRate):"2–10%";
    if(id==="standard")return "от "+formatRate(defaultMarketRate(programs,propertyKind));
    return "от "+formatRate(item?.rate??0);
  };

  const ruleCards=program==="family"
    ?[
      {main:formatRate(preferredRate),sub:"ставка сейчас"},
      {main:formatRub(subsidizedLimit)+" ₽",sub:"льготный лимит"},
      {main:FAMILY_SUBSIDY_YEARS+" лет",sub:"субсидирование"},
    ]
    :program==="farEast"
      ?[
        {main:formatRate(preferredRate),sub:"льготная ставка"},
        {main:formatRub(subsidizedLimit)+" ₽",sub:"макс. кредит"},
        {main:maxYears+" лет",sub:"макс. срок"},
      ]
      :program==="it"
        ?[
          {main:formatRate(preferredRate),sub:"льготная ставка"},
          {main:formatRub(subsidizedLimit)+" ₽",sub:"льготная часть"},
          {main:formatRub(totalLimit)+" ₽",sub:"с увеличением"},
        ]
        :[
          {main:formatRate(marketRate),sub:"ориентир ставки"},
          {main:String(rule.minDownPct).replace(".",",")+"%",sub:"взнос от"},
          {main:maxYears+" лет",sub:"макс. срок"},
        ];

  React.useEffect(()=>{
    if(!programs.some(item=>item.id===program)&&programs[0])setProgram(programs[0].id);
  },[programs,program]);

  React.useEffect(()=>{
    if(years>maxYears)setYears(maxYears);
  },[maxYears,years]);

  React.useEffect(()=>{
    if(!fromProperty||!sourcePrice||sourcePrice<=1||appliedSource.current)return;
    appliedSource.current=true;
    if(priceTouched.current)return;
    const nextMin=minimumMortgageDown(sourcePrice,rule.minDownPct);
    setPrice(sourcePrice);setPriceDraft(formatRub(sourcePrice));
    const nextDown=typeof savedDown==="number"?clamp(savedDown,nextMin,sourcePrice-1):nextMin;
    setDown(nextDown);setDownDraft(formatRub(nextDown));
  },[fromProperty,sourcePrice,rule.minDownPct]);

  React.useEffect(()=>{
    const next=clamp(down,minDown,maxDown);
    if(next!==down){setDown(next);setDownDraft(formatRub(next))}
  },[minDown,maxDown,down]);

  React.useEffect(()=>{
    if(!propertyKindMounted.current){
      propertyKindMounted.current=true;
      return;
    }
    const next=defaultMarketRate(programs,propertyKind);
    setMarketRate(next);
    setMarketRateDraft(String(next).replace(".",","));
    setLargeArea(false);
  },[propertyKind,programs]);

  React.useEffect(()=>{
    const shared:MortgageScenarioSettings={
      ...settings,
      price,
      down,
      updatedAt:new Date().toISOString(),
    };
    try{localStorage.setItem(MORTGAGE_SCENARIO_KEY,JSON.stringify(shared));if(fromProperty)localStorage.setItem(scenarioKey,JSON.stringify(shared));}catch{}
  },[program,propertyKind,childrenCount,hasYoungChild,disabledChild,largeArea,marketRate,futureRate,years,price,down]);

  React.useEffect(()=>{
    if(!interacted||invalid)return;
    const metadata={
      program,
      price,
      down,
      years,
      rate:preferredRate,
      payment:Math.round(payment),
      source:"mortgage-policy-"+MORTGAGE_POLICY_VERSION,
      ...(sourceProperty?{propertyIds:[sourceProperty.id],propertyName:sourceProperty.name,floorplanId:sourcePlan?.id}:{}),
    };
    const key=JSON.stringify(metadata);
    if(lastCalculation.current===key)return;
    const timer=window.setTimeout(()=>{
      lastCalculation.current=key;
      recordPulseEvent({eventType:"mortgage_calculated",entityType:"mortgage",entityId:program,metadata});
    },800);
    return()=>window.clearTimeout(timer);
  },[interacted,invalid,program,price,down,years,preferredRate,payment,sourceProperty,sourcePlan]);

  const chooseProgram=(id:ProgramId)=>{
    setInteracted(true);
    const next=programs.find(item=>item.id===id);
    if(!next)return;
    const nextMin=minimumMortgageDown(price,next.minDownPct);
    const nextDown=clamp(down===minDown?nextMin:down,nextMin,price-1);
    setDown(nextDown);
    setDownDraft(formatRub(nextDown));
    setProgram(id);
    setYears(current=>Math.min(current,next.maxYears));
    if(id!=="farEast")setLargeArea(false);
    recordPulseEvent({eventType:"mortgage_program",entityType:"mortgage_program",entityId:id});
  };

  const updatePrice=(value:number,fromSlider=false)=>{
    setInteracted(true);
    priceTouched.current=true;
    const next=clamp(fromSlider?snap(value,MONEY_STEP):Math.round(value),priceMin,priceMax);
    const nextMin=minimumMortgageDown(next,rule.minDownPct);
    // Keep a minimum-position slider at the minimum; otherwise preserve exact cash.
    const nextDown=clamp(down===minDown?nextMin:down,nextMin,next-1);
    setDown(nextDown);
    setDownDraft(formatRub(nextDown));
    setPrice(next);
    setPriceDraft(formatRub(next));
  };

  const updateDown=(value:number)=>{
    setInteracted(true);
    priceTouched.current=true;
    const next=clamp(Math.round(value),minDown,maxDown);
    setDown(next);
    setDownDraft(formatRub(next));
  };

  const commitMoney=(kind:"price"|"down")=>{
    const draft=kind==="price"?priceDraft:downDraft;
    const raw=parseNumber(draft);
    if(!Number.isFinite(raw)||raw<=0){
      kind==="price"?setPriceDraft(formatRub(price)):setDownDraft(formatRub(down));
      return;
    }
    kind==="price"?updatePrice(raw):updateDown(raw);
  };

  const commitMarketRate=()=>{
    setInteracted(true);
    const raw=marketRateDraft.trim()===""?NaN:parseNumber(marketRateDraft);
    const next=Number.isFinite(raw)&&raw>=.1&&raw<=40?Math.round(raw*10)/10:marketRate;
    setMarketRate(next);
    setMarketRateDraft(String(next).replace(".",","));
  };

  const programHint=()=>{
    // Older saved settings may still contain the former technical default copy.
    const hint=rule.hint
      .replace("Ставки по типу объекта управляются из PULSE Control и остаются ориентировочными.","Ставка зависит от типа недвижимости и условий банка. Расчёт ориентировочный.")
      .replace(" Mini App рассчитывает шкалу динамически.","");
    if(program==="family"){
      // Replace legacy numeric boilerplate while retaining an editor's own note.
      const customHint=hint
        .replace(/Льготная часть[^.]*\./giu,"")
        .replace(/Увеличенный лимит[^.]*\./giu,"")
        .replace(/^С 01\.10\.2026 в Приморье[\s\S]*$/u,"").trim();
      const limitHint="Льготная часть — до "+formatRub(subsidizedLimit)+" ₽ под "+formatRate(preferredRate)+".";
      const condition=propertyKind==="house"
        ?" Для строительства или завершения частного дома. Базовое право на программу сохраняется."
        :disabledChild?" Для семьи с ребёнком с инвалидностью до 18 лет."
        :downPercent>=50?" Взнос от 50%. Право на программу подтверждает банк."
        :" Условия зависят от числа детей и права на программу.";
      return limitHint+condition+(mixed?" Часть сверх льготного лимита рассчитана по рыночной ставке; доступность подтверждает банк.":"")+(customHint?" "+customHint:"");
    }
    return hint;
  };

  return <div className={styles.page}>
    <PageHeader
      eyebrow="Финансовый сценарий"
      title="Ипотека"
      subtitle="Расчёт по действующим правилам для Приморского края."
      action={<button
        type="button"
        className={styles.headerIcon}
        aria-label="Как работает ипотека"
        title="Как работает ипотека"
        onClick={()=>{
          recordPulseEvent({eventType:"mortgage_intro_replay",entityType:"onboarding",entityId:MORTGAGE_STORY_VERSION});
          setShowMortgageStory(true);
        }}
      ><IconTile><Calculator/></IconTile></button>}
    />

    <div className={styles.freshness}><CircleCheck size={14}/><span>Правила проверены {RULES_UPDATED}</span></div>

    {fromProperty&&<section className={styles.propertyContext} aria-label="Расчёт выбранного ЖК">
      {sourceProperty?<><div>{sourceProperty.coverImageUrl&&<img src={sourceProperty.coverImageUrl} alt=""/>}<span><small>{sourcePlan?'Выбранная планировка':'Расчёт по объекту'}</small><strong>{sourceProperty.name}</strong><em>{sourcePlan?[sourcePlan.roomLabel==='Студия'?'Студия':sourcePlan.roomLabel+' комн.',sourcePlan.areaFrom!==null?sourcePlan.areaFrom+(sourcePlan.areaTo&&sourcePlan.areaTo!==sourcePlan.areaFrom?'–'+sourcePlan.areaTo:'')+' м²':''].filter(Boolean).join(' · '):[sourceProperty.city,sourceProperty.district].filter(Boolean).join(' · ')}</em></span></div><p>{price===sourcePrice?'Цена подставлена из карточки. Взнос можно изменить.':'Вы изменили стоимость для своего расчёта.'}{params.has('floorplan')&&!sourcePlan?' Планировка больше не доступна; используем стартовую цену ЖК.':''}</p><button type="button" onClick={()=>navigate('/property/'+encodeURIComponent(sourceProperty.id))}><ChevronLeft size={15}/>Вернуться к ЖК</button></>:<p role={sourceUnavailable?'alert':undefined}>{sourceUnavailable?'Не удалось подтвердить актуальную карточку ЖК. Расчёт по указанной цене можно продолжить.':'Загружаем данные выбранного ЖК…'}</p>}
    </section>}

    <section className={styles.programSection}>
      <div className={styles.sectionLabel}><span>Программа</span><small>Приморский край</small></div>
      <NativeSelect aria-label="Ипотечная программа" value={program} onChange={e=>chooseProgram(e.target.value as ProgramId)}>{programs.map(item=><option key={item.id} value={item.id}>{item.label} · {cardRate(item.id)}</option>)}</NativeSelect>

      <NativeSelect className={styles.nativeObject} aria-label="Тип недвижимости" value={propertyKind} onChange={e=>{setInteracted(true);setPropertyKind(e.target.value as PropertyKind)}}>{(Object.keys(propertyLabels) as PropertyKind[]).map(kind=><option key={kind} value={kind}>{propertyLabels[kind]}</option>)}</NativeSelect>

      {program==="family"&&<div className={styles.scenario}>
        <div className={styles.scenarioHead}>
          <div><strong>Сколько детей в семье?</strong><span>Для Приморья ставка зависит от их количества</span></div>
          <span className={styles.liveRate}>{formatRate(preferredRate)}</span>
        </div>
        <NativeSelect aria-label="Количество детей" value={String(childrenCount)} onChange={e=>{setInteracted(true);setChildrenCount(Number(e.target.value) as FamilyChildren)}}>{([1,2,3,4,5] as FamilyChildren[]).map(count=><option key={count} value={String(count)}>{count===5?"5 и больше":count}</option>)}</NativeSelect>
        <div className={styles.toggleRows}>
          <div className={styles.toggleRow}>
            <div><strong>Есть ребёнок младше 7 лет</strong><span>Базовое условие для новых договоров</span></div>
            <Switch checked={hasYoungChild} onCheckedChange={value=>{setInteracted(true);setHasYoungChild(value)}}/>
          </div>
          <div className={styles.toggleRow}>
            <div><strong>Есть ребёнок с инвалидностью до 18 лет</strong><span>Ставка не выше 6%</span></div>
            <Switch checked={disabledChild} onCheckedChange={value=>{setInteracted(true);setDisabledChild(value)}}/>
          </div>
        </div>
      </div>}

      {program==="farEast"&&propertyKind!=="house"&&<div className={styles.optionRow}>
        <div>
          <strong>{propertyKind==="newbuild"?"Площадь квартиры свыше 64 м²":"Площадь свыше 60 м² и подходящий моногород"}</strong>
          <span>При выполнении условий программы доступен повышенный лимит кредита</span>
        </div>
        <Switch checked={largeArea} onCheckedChange={value=>{setInteracted(true);setLargeArea(value)}}/>
      </div>}

      <div className={styles.ruleStrip}>
        {ruleCards.map(item=><span key={item.sub}><b>{item.main}</b>{item.sub}</span>)}
      </div>
      <div className={styles.ruleHint}><Info size={14}/><span>{programHint()}</span></div>

      {propertyKind==="secondary"&&(program==="family"||program==="farEast")&&<div className={styles.contextWarning}>
        <Info size={15}/><span>Вторичка по этой программе доступна не везде. Перед подачей нужно проверить населённый пункт и сам объект по действующему перечню и условиям банка.</span>
      </div>}
    </section>

    <section className={styles.calc}>
      <div className={styles.field}>
        <div className={styles.label}><span>Стоимость недвижимости</span><b>{formatRub(price)} ₽</b></div>
        <div className={styles.moneyInput}>
          <Input aria-label="Стоимость недвижимости" inputMode="numeric" value={priceDraft} onChange={e=>{priceTouched.current=true;setPriceDraft(e.target.value.replace(/[^0-9 ]/g,""))}} onBlur={()=>commitMoney("price")} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/>
          <span>₽</span>
        </div>
        <Slider aria-label="Стоимость недвижимости" min={priceMin} max={priceMax} step={MONEY_STEP} value={[price]} onValueChange={values=>updatePrice(values[0]??price,true)}/>
      </div>

      <div className={styles.field}>
        <div className={styles.label}><span>Первоначальный взнос</span><b>{downPercent.toFixed(1).replace(".",",")}% · {formatRub(down)} ₽</b></div>
        <div className={styles.moneyInput}>
          <Input aria-label="Первоначальный взнос" inputMode="numeric" value={downDraft} onChange={e=>{priceTouched.current=true;setDownDraft(e.target.value.replace(/[^0-9 ]/g,""))}} onBlur={()=>commitMoney("down")} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/>
          <span>₽</span>
        </div>
        <Slider aria-label="Первоначальный взнос, %" min={calculation.minDownPct} max={100} step={0.1} value={[downPercent]} onValueChange={values=>updateDown(price*(values[0]??downPercent)/100)}/>
        <div className={styles.fieldMeta}>Минимальный взнос: {String(rule.minDownPct).replace(".",",")}% · {formatRub(minDown)} ₽</div>
        {program==="family"&&downPercent>=50&&<div className={styles.inlineSuccess}><CircleCheck size={13}/>Взнос 50%+: для подходящей семьи ставка не выше 6%</div>}
      </div>

      <div className={styles.twoFields}>
        <div className={styles.field}>
          <div className={styles.label}><span>Срок</span><b>{formatYears(years)}</b></div>
          <Slider aria-label="Срок кредита, лет" min={1} max={maxYears} step={1} value={[years]} onValueChange={values=>{setInteracted(true);setYears(Math.min(values[0]??years,maxYears))}}/>
        </div>
        <div className={styles.rateField}>
          <label>{program==="standard"?"Рыночная ставка":"Рыночная часть"}</label>
          <div>
            <Input aria-label="Рыночная ставка, %" inputMode="decimal" value={marketRateDraft} onChange={e=>setMarketRateDraft(e.target.value)} onBlur={commitMarketRate} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/>
            <Percent size={15}/>
          </div>
        </div>
      </div>

      {mixed&&<div className={styles.mixedRate}>
        <div><strong>Комбинированный расчёт</strong><span>{formatRub(subsidizedPrincipal)} ₽ под {formatRate(preferredRate)} + {formatRub(marketPrincipal)} ₽ под {formatRate(marketRate)}</span></div>
        <BadgePercent size={19}/>
      </div>}
    </section>

    {familyEligibilityBlocked&&<section className={styles.warning+" "+styles.warningStrong}>
      <AlertTriangle size={18}/><div><strong>Не подтверждено базовое право на Семейную ипотеку</strong><span>Для обычного сценария нужен ребёнок младше 7 лет. Отдельное основание — ребёнок с инвалидностью до 18 лет.</span></div>
    </section>}

    {objectBlocked&&<section className={styles.warning+" "+styles.warningStrong}>
      <AlertTriangle size={18}/><div><strong>Обычная вторичка не подходит под IT-ипотеку</strong><span>Программа рассчитана на первичное жильё от застройщика, дом от застройщика или строительство дома.</span></div>
    </section>}

    {limitExceeded&&<section className={styles.warning+" "+styles.warningStrong}>
      <AlertTriangle size={18}/><div><strong>Сумма кредита выше доступного лимита</strong><span>Увеличьте первоначальный взнос минимум до {formatRub(requiredDown)} ₽ или выберите другой сценарий.</span></div>
    </section>}

    {program==="family"&&years>FAMILY_SUBSIDY_YEARS&&<section className={styles.warning}>
      <Info size={18}/><div><strong>Льготная ставка действует первые {FAMILY_SUBSIDY_YEARS} лет</strong><span>Платёж ниже рассчитан для первого периода. Чтобы оценить следующий, укажите предполагаемую ставку — точные условия определит банк.</span></div>
    </section>}

    <section className={styles.result}>
      <div className={styles.resultTop}>
        <IconTile as="div" className={styles.resultIcon}><WalletCards size={20}/></IconTile>
        <div><span>{totalKnown?'Ориентировочный платёж':'Первые 15 лет · платёж'}</span><strong>{invalid?"—":formatRub(payment)+" ₽ / мес"}</strong></div>
        <BadgePercent size={20}/>
      </div>
      {mixed&&!invalid&&<div className={styles.splitResult}>
        <span>Льготная часть: {formatRub(preferredPayment)} ₽/мес</span>
        <span>Рыночная часть: {formatRub(marketPayment)} ₽/мес</span>
      </div>}
      <div className={styles.resultGrid}>
        <div><span>Сумма кредита</span><b>{formatRub(loan)} ₽</b></div>
        <div><span>Льготная часть</span><b>{program==="standard"?"—":formatRub(subsidizedPrincipal)+" ₽"}</b></div>
        <div><span>Переплата</span><b>{invalid||!totalKnown?"—":formatRub(overpayment)+" ₽"}</b></div>
        <div><span>Доход, ориентир</span><b>{invalid?"—":"от "+formatRub(income)+" ₽"}</b></div>
      </div>
      <div className={styles.incomeNote}>Ориентир дохода рассчитан при условной долговой нагрузке 45%. Банк считает платёжеспособность индивидуально.</div>
    </section>

    {!totalKnown&&<section className={styles.scenario} aria-label="Расчёт после льготного периода">
      <div className={styles.scenarioHead}><div><strong>После льготного периода</strong><span>Следующие {years-FAMILY_SUBSIDY_YEARS} лет · ваш сценарий</span></div><BadgePercent size={20}/></div>
      <label className={styles.label} htmlFor="future-mortgage-rate"><span>Предполагаемая ставка после 15 лет</span><b>% годовых</b></label>
      <Input id="future-mortgage-rate" aria-label="Ставка после льготного периода, %" inputMode="decimal" placeholder="Введите ставку" value={futureRateDraft} onChange={e=>setFutureRateDraft(e.target.value)} aria-invalid={futureRateDraft.trim()!==''&&futureRate===undefined}/>
      {futureRateDraft.trim()!==''&&futureRate===undefined&&<p role="alert" className={styles.incomeNote}>Введите ставку от 0 до 40%.</p>}
      {calculation.projection?<>
        <div className={styles.resultGrid}>
          <div><span>Остаток кредита через 15 лет</span><b>{formatRub(calculation.projection.remainingPreferred+calculation.projection.remainingMarket)} ₽</b></div>
          <div><span>Следующий платёж, сценарий</span><b>{formatRub(calculation.projection.futurePayment)} ₽ / мес</b></div>
          <div><span>Всего выплат по сценарию</span><b>{formatRub(calculation.projection.total)} ₽</b></div>
          <div><span>Переплата по сценарию</span><b>{formatRub(calculation.projection.overpayment)} ₽</b></div>
        </div>
        <div className={styles.incomeNote}>Расчёт при вашей ставке {String(futureRate).replace('.',',')}%. {mixed?'Рыночная часть продолжает рассчитываться по текущей ставке. ':''}Без страховок, комиссий и досрочных платежей. Это сценарий, а не предложение банка.</div>
      </>:<div className={styles.incomeNote}>{invalid?'Сначала исправьте условия основного расчёта.':'Укажите ставку, чтобы увидеть остаток долга, следующий платёж и общую переплату.'}</div>}
    </section>}

    {params.get("from")==="select"&&<button type="button" className={styles.returnSelect} onClick={()=>navigate("/selection")}>
      <ChevronLeft size={17}/> Использовать этот сценарий в PULSE Select
    </button>}

    <details className={styles.details} open={program==="family"}>
      <summary><span>Условия выбранной программы</span><ChevronRight size={16}/></summary>
      <div className={styles.detailsBody}>
        {program==="family"&&<>
          <p><b>Новые договоры с 1 октября 2026.</b> В Приморье: 1 ребёнок — 10% / до 6 млн ₽; 2 — 8% / до 8 млн ₽; 3 — 6% / до 10 млн ₽; 4 — 4% / до 10 млн ₽; 5+ — 2% / до 10 млн ₽.</p>
          <p>Хотя бы один ребёнок должен быть младше 7 лет. Для ребёнка с инвалидностью до 18 лет сохраняется ставка не выше 6%.</p>
          <p>При первоначальном взносе 50% и более ставка для подходящей семьи — не выше 6%. На строительство частного дома — 6% независимо от числа детей.</p>
          <p>Субсидирование — максимум 15 лет. Кредит может быть длиннее, но ставка после льготного периода меняется по правилам программы.</p>
          <p>Если сумма кредита выше льготного лимита, расчёт объединяет льготную и рыночную части в пределах максимального лимита программы. Доступность увеличенного лимита и его тариф подтверждает банк.</p>
          <p>Для вторичного жилья действует отдельный перечень населённых пунктов и требования к дому — поэтому объект нужно проверять отдельно.</p>
        </>}
        {program==="farEast"&&<>
          <p><b>Дальневосточная ипотека.</b> В расчёте учитываются ставка, лимит кредита и возможность повышенного лимита для подходящего объекта.</p>
          <p>Доступность зависит от категории заёмщика, территории и самого объекта. Банк подтверждает право на программу.</p>
        </>}
        {program==="it"&&<>
          <p><b>IT-ипотека.</b> Расчёт учитывает льготную ставку, льготный лимит и максимальную сумму кредита. Часть сверх льготного лимита считается по рыночной ставке.</p>
          <p>Обычная вторичная квартира не является стандартным объектом IT-ипотеки.</p>
        </>}
        {program==="standard"&&<>
          <p><b>Рыночный сценарий.</b> Для расчёта подставляется текущий ориентир по типу недвижимости. Ставку можно изменить вручную.</p>
        </>}
      </div>
    </details>

    <details className={styles.details}>
      <summary><span>Другие ипотечные сценарии</span><ChevronRight size={16}/></summary>
      <div className={styles.otherPrograms}>
        <div className={styles.otherProgram}><div><Landmark size={16}/><strong>Военная ипотека</strong></div><span className={styles.statusActive}>действует</span><p>Для участников НИС. Финальные условия зависят от банка и статуса участника.</p></div>
        <div className={styles.otherProgram}><div><Landmark size={16}/><strong>Сельская ипотека</strong></div><span className={styles.statusPaused}>приём закрыт</span><p>Не показываем её как доступную программу в основном калькуляторе, пока приём заявок закрыт.</p></div>
        <div className={styles.otherProgram}><div><Landmark size={16}/><strong>Материнский капитал</strong></div><span className={styles.statusInfo}>поддержка</span><p>Это не отдельная процентная программа: средства можно учитывать в первоначальном взносе, если сделка и банк это допускают.</p></div>
      </div>
    </details>

    <LeadSheet
      title="Проверить ипотечные программы"
      source="mortgage"
      propertyId={sourceProperty?.id}
      project={sourceProperty?.name}
      context={{program,propertyKind,price,down,years,rate:preferredRate,preferredRate,marketRate,payment:invalid?null:payment,status:calculation.status,blockReason:calculation.blockReason,childrenCount,hasYoungChild,largeArea,futureRate:futureRate??null,projection:calculation.projection,scenarioVersion:1,subsidizedLimit,marketPrincipal,policyVersion:MORTGAGE_POLICY_VERSION,...(sourcePlan?{floorplanId:sourcePlan.id,rooms:sourcePlan.roomLabel,areaFrom:sourcePlan.areaFrom,areaTo:sourcePlan.areaTo}:{})}}
    >
      <button className={styles.cta}>Получить точный расчёт <ChevronRight size={18}/></button>
    </LeadSheet>

    <div className={styles.note}><ShieldCheck size={15}/>Расчёт предварительный. Финальные условия, право на льготу и объект подтверждает банк.</div>

    {showMortgageStory&&<MortgageStoryOnboarding onDone={()=>setShowMortgageStory(false)}/>}
  </div>;
}
