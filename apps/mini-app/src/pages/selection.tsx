import { representativePrice, selectionMatch, preferenceLabel, type PreferenceId, type PurchaseMode, type SelectionCriteria } from "../../../../packages/domain/propertyMatch";
import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Baby,
  Banknote,
  Building2,
  CalendarDays,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  Home,
  Paintbrush,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trees,
  WalletCards,
  Waves,
} from "lucide-react";
import { Slider } from "../components/Slider";
import { Input } from "../components/Input";
import { SegmentedControl } from "../components/SegmentedControl";
import { usePriceBounds } from "../helpers/usePriceBounds";
import { useSelectionProperties } from "../helpers/useCatalog";
import { usePulseControlState } from "../helpers/usePulseControlState";
import { recordPulseEvent } from "../../../../packages/pulse-data";
import styles from "./selection.module.css";

const FALLBACK_MIN=4_000_000;
const FALLBACK_MAX=25_000_000;
const FALLBACK_STEP=100_000;
const STORAGE_KEY="pulse_selection_current_v2";

const formatRub=(value:number)=>new Intl.NumberFormat("ru-RU").format(Math.round(value));
const shortRub=(value:number)=>{
  const mln=value/1_000_000;
  if(mln>=1)return (Number.isInteger(mln)?mln.toFixed(0):mln.toFixed(1).replace(".",","))+" млн ₽";
  return Math.round(value/1_000)+" тыс. ₽";
};
const formatPayment=(value:number)=>new Intl.NumberFormat("ru-RU").format(Math.round(value))+" ₽/мес";
const snap=(value:number,step:number)=>Math.round(value/step)*step;
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
const plural=(count:number,forms:[string,string,string])=>{
  const n=Math.abs(count)%100;
  const n1=n%10;
  if(n>10&&n<20)return forms[2];
  if(n1>1&&n1<5)return forms[1];
  if(n1===1)return forms[0];
  return forms[2];
};

const preferenceOptions:{id:PreferenceId;label:string;hint:string}[]=[
  {id:"sea",label:"Вид на море",hint:"Только Владивосток"},
  {id:"family",label:"Для семьи",hint:"Двор, дети, инфраструктура"},
  {id:"parking",label:"Парковка",hint:"Паркинг или места рядом"},
  {id:"center",label:"Ближе к центру",hint:"Городская инфраструктура"},
  {id:"courtyard",label:"Красивый двор",hint:"Благоустройство и прогулки"},
  {id:"finish",label:"С отделкой",hint:"Быстрее заехать"},
];

const preferenceIcon=(id:PreferenceId)=>{
  if(id==="sea")return <Waves size={17}/>;
  if(id==="family")return <Baby size={17}/>;
  if(id==="parking")return <Car size={17}/>;
  if(id==="center")return <Building2 size={17}/>;
  if(id==="courtyard")return <Trees size={17}/>;
  return <Paintbrush size={17}/>;
};

type SavedSelection={
  city?:string;
  rooms?:string;
  delivery?:string;
  purchaseMode?:PurchaseMode;
  budget?:[number,number];
  downPayment?:number;
  monthlyPayment?:number;
  preferences?:PreferenceId[];
};

type ScenarioId="more-payment"|"more-down"|"relax-preference"|"relax-delivery";
type Scenario={
  id:ScenarioId;
  title:string;
  detail:string;
  value:string;
  gain:number;
};

function safeHaptic(kind:"light"|"medium"="light"){
  try{
    const telegram=(window as Window&{Telegram?:{WebApp?:{HapticFeedback?:{impactOccurred?:(style:string)=>void}}}}).Telegram;
    telegram?.WebApp?.HapticFeedback?.impactOccurred?.(kind);
  }catch{}
}

function parseScaledMoney(value:string,unit:string){
  const amount=Number(value.replace(",","."));
  if(!Number.isFinite(amount)||amount<=0)return null;
  return /млн|мил/i.test(unit)?Math.round(amount*1_000_000):Math.round(amount*1_000);
}

function PulseRing({value,label,sublabel}:{value:number;label:string;sublabel:string}){
  const gradientId=React.useId().replace(/:/g,"");
  const radius=42;
  const circumference=2*Math.PI*radius;
  const percent=Math.max(0,Math.min(100,value));
  const offset=circumference*(1-percent/100);

  return <div className={styles.pulseRing}>
    <svg className={styles.ringSvg} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="22" y1="8" x2="82" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ff4352"/>
          <stop offset="48%" stopColor="#f20d1d"/>
          <stop offset="100%" stopColor="#ff2639"/>
        </linearGradient>
      </defs>
      <circle className={styles.ringTrackOuter} cx="50" cy="50" r={radius}/>
      <circle className={styles.ringTrack} cx="50" cy="50" r={radius}/>
      <circle
        className={styles.ringProgressOutline}
        cx="50" cy="50" r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
      <circle
        className={styles.ringProgress}
        cx="50" cy="50" r={radius}
        stroke={`url(#${gradientId})`}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
      <circle
        className={styles.ringProgressGlow}
        cx="50" cy="50" r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
    <div className={styles.ringCenter}><strong>{label}</strong><span>{sublabel}</span></div>
  </div>;
}

export default function SelectionPage(){
  const navigate=useNavigate();
  const control=usePulseControlState();
  const {data:bounds}=usePriceBounds();
  const {data:properties=[]}=useSelectionProperties();
  const minPrice=bounds?.minPriceRub??FALLBACK_MIN;
  const maxPrice=bounds?.maxPriceRub??FALLBACK_MAX;
  const priceStep=bounds?.stepRub??FALLBACK_STEP;

  const saved=React.useMemo<SavedSelection>(()=>{
    try{
      const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");
      return parsed&&typeof parsed==="object"?parsed:{};
    }catch{return{};}
  },[]);

  const defaultCity=control.select.cities.includes(saved.city||"")
    ?saved.city!
    :control.select.cities[0]??"Владивосток";
  const defaultRooms=control.select.roomOptions.includes(saved.rooms||"")
    ?saved.rooms!
    :control.select.roomOptions.includes("2")?"2":control.select.roomOptions[0]??"1";

  const [step,setStep]=React.useState(0);
  const [showResult,setShowResult]=React.useState(false);
  const [matching,setMatching]=React.useState(false);
  const [showAll,setShowAll]=React.useState(false);
  const [city,setCity]=React.useState(defaultCity);
  const [rooms,setRooms]=React.useState(defaultRooms);
  const [purchaseMode,setPurchaseMode]=React.useState<PurchaseMode>(control.select.mortgageEnabled&&saved.purchaseMode!=="cash"?"mortgage":"cash");
  const [budget,setBudget]=React.useState<[number,number]>(saved.budget||[FALLBACK_MIN,FALLBACK_MAX]);
  const [budgetDraft,setBudgetDraft]=React.useState<[string,string]>([
    formatRub(saved.budget?.[0]??FALLBACK_MIN),
    formatRub(saved.budget?.[1]??FALLBACK_MAX),
  ]);
  const budgetInitialized=React.useRef(false);
  const [downPayment,setDownPayment]=React.useState(saved.downPayment??1_500_000);
  const [downDraft,setDownDraft]=React.useState(formatRub(saved.downPayment??1_500_000));
  const [monthlyPayment,setMonthlyPayment]=React.useState(saved.monthlyPayment??60_000);
  const [paymentDraft,setPaymentDraft]=React.useState(formatRub(saved.monthlyPayment??60_000));
  const [delivery,setDelivery]=React.useState(saved.delivery||"Не важно");
  const [preferences,setPreferences]=React.useState<PreferenceId[]>(Array.isArray(saved.preferences)?saved.preferences.slice(0,control.select.maxPreferences):[]);
  const [smartQuery,setSmartQuery]=React.useState("");
  const [smartStatus,setSmartStatus]=React.useState("");
  const [smartSignal,setSmartSignal]=React.useState(0);
  const last=step===3;

  React.useEffect(()=>{
    if(!control.select.cities.includes(city))setCity(control.select.cities[0]??"Владивосток");
    if(!control.select.roomOptions.includes(rooms))setRooms(control.select.roomOptions[0]??"1");
  },[control.select.cities,control.select.roomOptions,city,rooms]);

  React.useEffect(()=>{
    if(!control.select.mortgageEnabled&&purchaseMode!=="cash")setPurchaseMode("cash");
  },[control.select.mortgageEnabled,purchaseMode]);

  React.useEffect(()=>{
    setPreferences(current=>{
      const next=current
        .filter(id=>control.select.preferenceEnabled[id])
        .filter(id=>id!=="sea"||(control.select.seaEnabled&&city==="Владивосток"))
        .slice(0,control.select.maxPreferences);
      return next.length===current.length&&next.every((id,index)=>id===current[index])?current:next;
    });
  },[city,control.select.seaEnabled,control.select.maxPreferences,control.select.preferenceEnabled]);

  React.useEffect(()=>{
    if(!bounds||budgetInitialized.current)return;
    const savedBudget=saved.budget;
    const next:[number,number]=savedBudget
      ?[clamp(savedBudget[0],bounds.minPriceRub,bounds.maxPriceRub),clamp(savedBudget[1],bounds.minPriceRub,bounds.maxPriceRub)]
      :[bounds.minPriceRub,bounds.maxPriceRub];
    if(next[0]>next[1])next[0]=next[1];
    setBudget(next);
    setBudgetDraft([formatRub(next[0]),formatRub(next[1])]);
    budgetInitialized.current=true;
  },[bounds,saved.budget]);

  const deliveryOptions=React.useMemo(()=>{
    const currentYear=new Date().getFullYear();
    const years=new Set<string>();
    for(let year=currentYear;year<=Math.max(2030,currentYear+4);year++)years.add(String(year));
    for(const value of control.select.deliveryOptions){
      const match=value.match(/20\d{2}/);
      if(match)years.add(match[0]);
    }
    for(const property of properties){
      for(const match of property.delivery.matchAll(/20\d{2}/g))years.add(match[0]);
    }
    return ["Не важно","Сдан",...[...years].sort((a,b)=>Number(a)-Number(b))];
  },[control.select.deliveryOptions,properties]);

  React.useEffect(()=>{
    if(!deliveryOptions.includes(delivery))setDelivery("Не важно");
  },[delivery,deliveryOptions]);

  const setBudgetFromSlider=(values:number[])=>{
    const next:[number,number]=[values[0]??minPrice,values[1]??maxPrice];
    setBudget(next);
    setBudgetDraft([formatRub(next[0]),formatRub(next[1])]);
  };

  const editBudgetDraft=(index:0|1,value:string)=>{
    const clean=value.replace(/[^0-9]/g,"");
    setBudgetDraft(prev=>{
      const next:[string,string]=[...prev] as [string,string];
      next[index]=clean?formatRub(Number(clean)):"";
      return next;
    });
  };

  const commitBudgetDraft=(index:0|1)=>{
    const raw=Number(budgetDraft[index].replace(/[^0-9]/g,""));
    let value=Number.isFinite(raw)&&raw>0?raw:budget[index];
    value=clamp(snap(value,priceStep),minPrice,maxPrice);
    const next:[number,number]=[...budget] as [number,number];
    next[index]=value;
    if(index===0&&next[0]>next[1])next[1]=next[0];
    if(index===1&&next[1]<next[0])next[0]=next[1];
    setBudget(next);
    setBudgetDraft([formatRub(next[0]),formatRub(next[1])]);
  };

  const editMoney=(kind:"down"|"payment",value:string)=>{
    const clean=value.replace(/[^0-9]/g,"");
    const formatted=clean?formatRub(Number(clean)):"";
    if(kind==="down")setDownDraft(formatted);
    else setPaymentDraft(formatted);
  };

  const commitMoney=(kind:"down"|"payment")=>{
    const draft=kind==="down"?downDraft:paymentDraft;
    const current=kind==="down"?downPayment:monthlyPayment;
    const raw=Number(draft.replace(/[^0-9]/g,""));
    const value=Number.isFinite(raw)&&raw>0?raw:current;
    if(kind==="down"){
      const next=clamp(snap(value,100_000),0,Math.max(500_000,maxPrice));
      setDownPayment(next);
      setDownDraft(formatRub(next));
    }else{
      const next=clamp(snap(value,5_000),15_000,300_000);
      setMonthlyPayment(next);
      setPaymentDraft(formatRub(next));
    }
  };

  const visiblePreferences=preferenceOptions.filter(option=>{
    if(!control.select.preferenceEnabled[option.id])return false;
    if(option.id==="sea")return control.select.seaEnabled&&city==="Владивосток";
    return true;
  });

  const togglePreference=(id:PreferenceId)=>{
    setPreferences(current=>{
      if(current.includes(id))return current.filter(item=>item!==id);
      if(current.length>=control.select.maxPreferences)return current;
      return [...current,id];
    });
    safeHaptic();
  };

  const criteria=React.useMemo<SelectionCriteria>(()=>({
    city,
    rooms,
    delivery,
    purchaseMode,
    min:budget[0],
    max:budget[1],
    downPayment,
    monthlyPayment,
    preferences,
  }),[city,rooms,delivery,purchaseMode,budget,downPayment,monthlyPayment,preferences]);

  const rankFor=React.useCallback((next:SelectionCriteria)=>properties
    .map(property=>({property,match:selectionMatch(property,next,control.mortgagePrograms,control.select.weights)}))
    .sort((a,b)=>Number(b.match.eligible)-Number(a.match.eligible)||b.match.score-a.match.score||a.property.sortOrder-b.property.sortOrder)
  ,[properties,control.mortgagePrograms,control.select.weights]);

  const ranked=React.useMemo(()=>rankFor(criteria),[rankFor,criteria]);
  const eligible=ranked.filter(item=>item.match.eligible);
  const strongCount=eligible.filter(item=>item.match.score>=85).length;
  const topScore=eligible[0]?.match.score??0;

  const firstStepCount=React.useMemo(()=>properties.filter(property=>{
    const cityOk=city==="Все"||city==="Не важно"||property.city===city;
    return cityOk&&representativePrice(property,rooms)!==null;
  }).length,[properties,city,rooms]);
  const liveCount=step===0?firstStepCount:eligible.length;

  const pulseLevel=React.useMemo(()=>{
    const catalogSize=Math.max(1,properties.length);
    const narrowing=Math.max(0,Math.min(1,1-firstStepCount/catalogSize));
    const smartBoost=Math.min(10,smartSignal*1.7);

    if(step===0){
      if(firstStepCount===0)return 0;
      return Math.round(Math.max(3,Math.min(18,4+narrowing*6+smartBoost)));
    }

    // После финансового шага и дальше PULSE показывает только реальную уверенность:
    // если нет ни одного допустимого варианта, кольцо не растёт.
    if(eligible.length===0)return 0;

    const matchSignal=Math.max(0,Math.min(1,topScore/100));
    const strongRatio=Math.max(0,Math.min(1,strongCount/Math.max(1,eligible.length)));
    const choiceSignal=Math.max(0,Math.min(1,eligible.length/Math.max(3,firstStepCount)));
    const preferenceSignal=Math.min(1,preferences.length/3);

    const stageBase=step===1?20:step===2?43:64;
    const stageDetail=step===1
      ?Math.min(6,smartBoost*.45)
      :step===2
        ?(delivery!=="Не важно"?6:1)
        :preferenceSignal*8;

    const value=
      stageBase+
      matchSignal*14+
      strongRatio*7+
      choiceSignal*5+
      stageDetail;

    return Math.round(Math.max(4,Math.min(97,value)));
  },[step,properties.length,firstStepCount,topScore,eligible.length,strongCount,preferences.length,smartSignal,delivery]);
  const [animatedPulseLevel,setAnimatedPulseLevel]=React.useState(0);
  const [animatedResultScore,setAnimatedResultScore]=React.useState(0);
  React.useEffect(()=>{
    const frame=window.requestAnimationFrame(()=>setAnimatedPulseLevel(pulseLevel));
    return()=>window.cancelAnimationFrame(frame);
  },[pulseLevel]);
  React.useEffect(()=>{
    if(!showResult){
      setAnimatedResultScore(0);
      return;
    }
    const frame=window.requestAnimationFrame(()=>setAnimatedResultScore(topScore));
    return()=>window.cancelAnimationFrame(frame);
  },[showResult,topScore]);
  const financeLabel=purchaseMode==="mortgage"?("до "+Math.round(monthlyPayment/1000)+" тыс./мес"):("до "+shortRub(budget[1]));

  const persistSelection=()=>{
    const value:SavedSelection={city,rooms,delivery,purchaseMode,budget,downPayment,monthlyPayment,preferences};
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(value));}catch{}
  };

  const applySmartQuery=()=>{
    const raw=smartQuery.trim();
    if(!raw){
      setSmartStatus("Напишите запрос одним предложением.");
      return;
    }
    const text=raw.toLowerCase().replace(/ё/g,"е");
    let found=0;
    let nextCity=city;
    let nextRooms=rooms;
    let nextMode=purchaseMode;
    let nextBudget:[number,number]=budget;
    let nextDown=downPayment;
    let nextPayment=monthlyPayment;
    let nextDelivery=delivery;
    const nextPreferences=[...preferences];

    const cityMatch=control.select.cities.find(value=>text.includes(value.toLowerCase().replace(/ё/g,"е")));
    if(cityMatch){nextCity=cityMatch;found++;}

    if(/студи/.test(text)){nextRooms="Студия";found++;}
    else if(/двуш|2\s*[- ]?(?:комн|к\b)|двухкомнат/.test(text)){nextRooms="2";found++;}
    else if(/однуш|1\s*[- ]?(?:комн|к\b)|однокомнат/.test(text)){nextRooms="1";found++;}
    else if(/треш|трехкомнат|3\s*[- ]?(?:комн|к\b)/.test(text)){nextRooms="3+";found++;}

    const mortgageIntent=/ипотек|платеж|платёж|в месяц|\/мес/.test(text);
    const cashIntent=/налич|без ипотек|полная стоимость/.test(text);
    if(mortgageIntent&&control.select.mortgageEnabled){nextMode="mortgage";found++;}
    else if(cashIntent){nextMode="cash";found++;}

    const paymentMatch=text.match(/(?:плат[её]ж[^\d]{0,18})?(\d{2,3})\s*(тыс|тысяч|к)\.?(?:\s*(?:руб|₽))?\s*(?:\/\s*мес|в месяц)/i);
    if(paymentMatch){
      const parsed=parseScaledMoney(paymentMatch[1],paymentMatch[2]);
      if(parsed&&control.select.mortgageEnabled){nextPayment=clamp(snap(parsed,5_000),15_000,300_000);nextMode="mortgage";found++;}
    }

    const downMatch=text.match(/(?:первоначальн\w*\s+)?взнос[^\d]{0,18}(\d+(?:[.,]\d+)?)\s*(млн|миллион\w*|тыс|тысяч)/i);
    if(downMatch){
      const parsed=parseScaledMoney(downMatch[1],downMatch[2]);
      if(parsed&&control.select.mortgageEnabled){nextDown=clamp(snap(parsed,100_000),0,Math.max(maxPrice,parsed));nextMode="mortgage";found++;}
    }

    const budgetMatch=text.match(/(?:до|бюджет[^\d]{0,12}|стоимост\w*[^\d]{0,12})(\d+(?:[.,]\d+)?)\s*(млн|миллион\w*)/i);
    if(budgetMatch&&!downMatch){
      const parsed=parseScaledMoney(budgetMatch[1],budgetMatch[2]);
      if(parsed){
        const max=clamp(snap(parsed,priceStep),minPrice,maxPrice);
        nextBudget=[minPrice,max];
        if(!mortgageIntent)nextMode="cash";
        found++;
      }
    }

    const year=text.match(/20(?:2[6-9]|3\d)/)?.[0];
    if(year&&deliveryOptions.includes(year)){nextDelivery=year;found++;}
    else if(/сдан|готовый дом|готовое/.test(text)){nextDelivery="Сдан";found++;}

    const preferenceMap:[PreferenceId,RegExp][]=[
      ["sea",/море|морск|панорам.*вод/],
      ["family",/семь|семейн|дет|школ|садик/],
      ["parking",/парков|паркинг|машин/],
      ["center",/центр|центральн/],
      ["courtyard",/двор|благоустрой|зел[её]н/],
      ["finish",/отделк|ремонт|готов.*заех/],
    ];
    for(const [id,pattern] of preferenceMap){
      const enabled=control.select.preferenceEnabled[id]&&(id!=="sea"||control.select.seaEnabled);
      if(enabled&&pattern.test(text)&&!nextPreferences.includes(id)){
        nextPreferences.push(id);
        found++;
      }
    }

    if(nextCity!=="Владивосток"||!control.select.seaEnabled){
      const index=nextPreferences.indexOf("sea");
      if(index>=0)nextPreferences.splice(index,1);
    }

    setCity(nextCity);
    setRooms(nextRooms);
    setPurchaseMode(nextMode);
    setBudget(nextBudget);
    setBudgetDraft([formatRub(nextBudget[0]),formatRub(nextBudget[1])]);
    setDownPayment(nextDown);
    setDownDraft(formatRub(nextDown));
    setMonthlyPayment(nextPayment);
    setPaymentDraft(formatRub(nextPayment));
    setDelivery(nextDelivery);
    setPreferences(nextPreferences.filter(id=>control.select.preferenceEnabled[id]).slice(0,control.select.maxPreferences));
    setSmartSignal(found);
    setSmartStatus(found
      ?`PULSE понял ${found} ${plural(found,["параметр","параметра","параметров"])}. Проверьте — всё уже выставлено ниже.`
      :"Не хочу додумывать за вас. Выберите параметры ниже — это займёт меньше минуты."
    );
    safeHaptic(found>2?"medium":"light");
  };

  const finish=()=>{
    persistSelection();
    try{
      const history=JSON.parse(localStorage.getItem("pulse_selection_history")||"[]");
      const nextHistory=[{
        city,rooms,min:budget[0],max:budget[1],delivery,
        mortgage:purchaseMode==="mortgage",downPayment,monthlyPayment,
        preferences,score:topScore,strongCount,createdAt:Date.now(),
      },...(Array.isArray(history)?history:[])].slice(0,5);
      localStorage.setItem("pulse_selection_history",JSON.stringify(nextHistory));
    }catch{}
    recordPulseEvent({
      eventType:"select_submit",
      entityType:"selection",
      metadata:{
        city,rooms,min:budget[0],max:budget[1],delivery,
        mortgage:purchaseMode==="mortgage",
        sea:preferences.includes("sea"),
        down:downPayment,
        payment:monthlyPayment,
        preferences:preferences.join(","),
        purchaseMode,
        topScore,strongCount,results:eligible.length,
        source:"pulse-select-v3",
      }
    });
    setMatching(true);
    safeHaptic("medium");
    window.setTimeout(()=>{
      setMatching(false);
      setShowResult(true);
      setShowAll(false);
      window.scrollTo({top:0,behavior:"smooth"});
    },820);
  };

  const next=()=>{
    if(last){finish();return;}
    setStep(value=>Math.min(3,value+1));
    safeHaptic();
    window.scrollTo({top:0,behavior:"smooth"});
  };

  const reset=()=>{
    setShowResult(false);
    setShowAll(false);
    setStep(0);
    window.scrollTo({top:0,behavior:"smooth"});
  };

  const measure=React.useCallback((next:SelectionCriteria)=>{
    const list=rankFor(next);
    const exact=list.filter(item=>item.match.eligible);
    return {
      eligible:exact.length,
      strong:exact.filter(item=>item.match.score>=85).length,
    };
  },[rankFor]);

  const scenarios=React.useMemo<Scenario[]>(()=>{
    const items:Scenario[]=[];
    const base={eligible:eligible.length,strong:strongCount};
    const gainFor=(next:SelectionCriteria)=>{
      const measured=measure(next);
      return {
        measured,
        gain:Math.max(measured.eligible-base.eligible,measured.strong-base.strong),
      };
    };

    if(purchaseMode==="mortgage"){
      const extraPayment=10_000;
      const next={...criteria,monthlyPayment:monthlyPayment+extraPayment};
      const {measured,gain}=gainFor(next);
      items.push({
        id:"more-payment",
        title:"+10 тыс. ₽ к платежу",
        detail:"Проверить, что откроется без изменения остальных пожеланий.",
        value:`${measured.eligible} ${plural(measured.eligible,["вариант","варианта","вариантов"])}`,
        gain,
      });
      const nextDown={...criteria,downPayment:downPayment+500_000};
      const downResult=gainFor(nextDown);
      items.push({
        id:"more-down",
        title:"+500 тыс. ₽ к взносу",
        detail:"Посмотреть, даст ли больший первоначальный взнос заметный выбор.",
        value:`${downResult.measured.eligible} ${plural(downResult.measured.eligible,["вариант","варианта","вариантов"])}`,
        gain:downResult.gain,
      });
    }else{
      const extra=Math.max(500_000,Math.round(budget[1]*.08/100_000)*100_000);
      const next={...criteria,max:Math.min(maxPrice,budget[1]+extra)};
      const result=gainFor(next);
      items.push({
        id:"more-payment",
        title:"Чуть расширить бюджет",
        detail:`Добавить до ${shortRub(extra)} к верхней границе.`,
        value:`${result.measured.eligible} ${plural(result.measured.eligible,["вариант","варианта","вариантов"])}`,
        gain:result.gain,
      });
    }

    if(preferences.length){
      const relaxed=preferences.slice(0,-1);
      const result=gainFor({...criteria,preferences:relaxed});
      items.push({
        id:"relax-preference",
        title:`Без «${preferenceLabel(preferences[preferences.length-1])}»`,
        detail:"Остальные пожелания останутся — ослабим только один мягкий приоритет.",
        value:`${result.measured.strong} сильных`,
        gain:result.gain,
      });
    }

    if(delivery!=="Не важно"){
      const result=gainFor({...criteria,delivery:"Не важно"});
      items.push({
        id:"relax-delivery",
        title:"Гибче по сроку сдачи",
        detail:"Не отбрасывать сильные проекты из-за выбранного года.",
        value:`${result.measured.strong} сильных`,
        gain:result.gain,
      });
    }

    return items.sort((a,b)=>b.gain-a.gain).slice(0,3);
  },[criteria,eligible.length,strongCount,purchaseMode,monthlyPayment,downPayment,budget,preferences,delivery,measure]);

  const applyScenario=(id:ScenarioId)=>{
    if(id==="more-payment"){
      if(purchaseMode==="mortgage"){
        const next=monthlyPayment+10_000;
        setMonthlyPayment(next);setPaymentDraft(formatRub(next));
      }else{
        const extra=Math.max(500_000,Math.round(budget[1]*.08/100_000)*100_000);
        const next:[number,number]=[budget[0],Math.min(maxPrice,budget[1]+extra)];
        setBudget(next);setBudgetDraft([formatRub(next[0]),formatRub(next[1])]);
      }
    }
    if(id==="more-down"){
      const next=downPayment+500_000;
      setDownPayment(next);setDownDraft(formatRub(next));
    }
    if(id==="relax-preference")setPreferences(current=>current.slice(0,-1));
    if(id==="relax-delivery")setDelivery("Не важно");
    setShowAll(false);
    safeHaptic("medium");
  };

  const resultLabel=(index:number,payment:number|null,topPayment:number|null)=>{
    if(index===0)return"Лучшее совпадение";
    if(payment!==null&&topPayment!==null&&payment+5_000<topPayment)return"Выгоднее по платежу";
    if(index===1)return"Сильная альтернатива";
    return"Стоит посмотреть";
  };

  if(matching){
    return <div className={styles.matchingScreen} aria-live="polite">
      <div className={styles.matchingCore}>
        <div className={styles.scanRing}/>
        <div className={styles.scanRingTwo}/>
        <Sparkles size={25}/>
      </div>
      <span className={styles.eyebrow}>PULSE SELECT</span>
      <h1>Собираем ваш подбор</h1>
      <p>Сопоставляем бюджет, планировки, срок и ваши приоритеты.</p>
      <div className={styles.matchingSteps}><i/><i/><i/></div>
    </div>;
  }

  if(showResult){
    const display=showAll?eligible:eligible.slice(0,3);
    const source=eligible.length?display:ranked.slice(0,3);
    const topPayment=source[0]?.match.mortgagePayment??null;
    return <div className={styles.page}>
      <section className={styles.resultHero} aria-label="Результат PULSE Select">
        <PulseRing
          value={animatedResultScore}
          label={`${topScore}%`}
          sublabel="PULSE MATCH"
        />
        <span className={styles.eyebrow}>PULSE SELECT</span>
        <h1>{eligible.length?"Мы нашли ваш вектор":"Нужно немного расширить рамки"}</h1>
        <p>{eligible.length
          ?<>PULSE сопоставил ваши ответы и выделил <strong>{eligible.length}</strong> {plural(eligible.length,["вариант","варианта","вариантов"])}. Ниже — не просто рейтинг, а причины каждого совпадения.</>
          :<>Точных совпадений пока нет. Показываем ближайшие проекты и сразу подсказываем, какое небольшое изменение даст больше выбора.</>
        }</p>
        <div className={styles.summaryChips}>
          <span><Home size={13}/>{city}</span>
          <span>{rooms==="Студия"?"Студия":rooms+" комн."}</span>
          <span>{financeLabel}</span>
          {delivery!=="Не важно"&&<span>{delivery==="Сдан"?"Сдан":"до "+delivery}</span>}
        </div>
      </section>

      <section className={styles.resultIntro}>
        <div><span>ТОП PULSE</span><strong>{source.length?"Лучшие совпадения":"Ближайшие варианты"}</strong></div>
        <small>Объясняем, почему каждый проект здесь.</small>
      </section>

      <section className={styles.matchList}>
        {source.map(({property,match},index)=>{
          const image=property.coverImageUrl||property.images[0]?.url;
          return <article className={styles.matchCard} key={property.id}>
            <div className={styles.matchMedia}>
              {image?<img src={image} alt={property.name}/>:<div className={styles.matchFallback}><Building2 size={28}/></div>}
              <span className={styles.matchRank}>{resultLabel(index,match.mortgagePayment,topPayment)}</span>
              <span className={styles.matchScore}>{match.score}%</span>
            </div>
            <div className={styles.matchBody}>
              <div className={styles.matchTitle}>
                <div><strong>{property.name}</strong><span>{property.city} · {property.district}</span></div>
                <b>{match.price?("от "+shortRub(match.price)):"По запросу"}</b>
              </div>

              <div className={styles.whyTitle}><Sparkles size={13}/><span>Почему PULSE выбрал его</span></div>
              <div className={styles.reasonList}>
                {match.reasons.map(reason=><span key={reason}><Check size={12}/>{reason}</span>)}
              </div>

              {purchaseMode==="mortgage"&&match.mortgagePayment!==null&&<div className={styles.paymentHint}>
                <WalletCards size={15}/>
                <span><strong>≈ {formatPayment(match.mortgagePayment)}</strong><small>ориентир по программе «{match.mortgageProgram}», если она вам доступна</small></span>
              </div>}

              {match.tradeoffs.length>0&&<div className={styles.tradeoff}>
                <span>КОМПРОМИСС</span>
                <p>{match.tradeoffs.join(" · ")}</p>
              </div>}

              <button type="button" className={styles.openProperty} onClick={()=>navigate("/property/"+property.id)}>
                Посмотреть проект <ArrowRight size={16}/>
              </button>
            </div>
          </article>
        })}
      </section>

      {control.select.whatIfEnabled&&scenarios.length>0&&<section className={styles.whatIf}>
        <div className={styles.whatIfHead}>
          <div><Sparkles size={16}/><span>А что если?</span></div>
          <p>Одно изменение — и PULSE сразу пересчитает подбор.</p>
        </div>
        <div className={styles.scenarioList}>
          {scenarios.map(item=><button type="button" key={item.id} onClick={()=>applyScenario(item.id)}>
            <span><strong>{item.title}</strong><small>{item.detail}</small></span>
            <b>{item.value}<ChevronRight size={14}/></b>
          </button>)}
        </div>
      </section>}

      {eligible.length>3&&!showAll&&<button type="button" className={styles.moreButton} onClick={()=>setShowAll(true)}>
        Показать ещё {eligible.length-3} {plural(eligible.length-3,["вариант","варианта","вариантов"])}
      </button>}

      <div className={styles.resultActions}>
        <button type="button" className={styles.editButton} onClick={reset}><RotateCcw size={15}/>Изменить запрос</button>
        <button type="button" className={styles.catalogButton} onClick={()=>navigate("/catalog")}>Весь каталог<ChevronRight size={16}/></button>
      </div>

      <div className={styles.disclaimer}><ShieldCheck size={14}/>Подбор и ипотечный платёж — ориентиры. Финальные условия подтверждаются по конкретной квартире и программе.</div>
    </div>;
  }

  return <div className={styles.page}>
    <header className={styles.hero}>
      <div className={styles.heroTop}><span className={styles.eyebrow}>PULSE SELECT</span><span>{step+1}/4</span></div>
      <h1>Не ищите квартиру.<br/><em>Опишите её.</em></h1>
      <p>PULSE соберёт ваш запрос и покажет не сотню карточек, а несколько осмысленных вариантов.</p>
    </header>

    {step===0&&control.select.smartQueryEnabled&&<section className={styles.smartPrompt}>
      <div className={styles.smartPromptHead}><Sparkles size={16}/><span>Можно своими словами</span><small>beta</small></div>
      <div className={styles.smartInput}>
        <Search size={17}/>
        <Input
          value={smartQuery}
          onChange={event=>{setSmartQuery(event.target.value);setSmartStatus("");}}
          onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();applySmartQuery();}}}
          placeholder="Двушка во Владивостоке, до 70 тыс./мес, у моря"
          aria-label="Опишите квартиру своими словами"
        />
        <button type="button" onClick={applySmartQuery} aria-label="Понять запрос"><ArrowRight size={16}/></button>
      </div>
      <button type="button" className={styles.exampleQuery} onClick={()=>{
        setSmartQuery("Двушка во Владивостоке, ипотека до 70 тыс. в месяц, первоначальный взнос 2 млн, желательно у моря");
        setSmartStatus("");
      }}>Попробовать пример</button>
      {smartStatus&&<div className={styles.smartStatus}><Check size={13}/>{smartStatus}</div>}
    </section>}

    <section className={styles.pulseCore} aria-label="Живой профиль PULSE Select">
      <PulseRing
        value={animatedPulseLevel}
        label={String(liveCount)}
        sublabel={plural(liveCount,["вариант","варианта","вариантов"])}
      />
      <div className={styles.coreCopy}>
        <span>PULSE CORE · LIVE</span>
        <strong>{step===0?"Уже понимаем основу":step===1?"Проверяем покупательную способность":step===2?"Уточняем горизонт":"Расставляем личные приоритеты"}</strong>
        <small>{step===0?"Выберите город и комнатность — остальные фильтры пока не мешают.":eligible.length?"Сильные варианты перестраиваются после каждого ответа.":"Если рамки слишком узкие, покажем ближайший разумный компромисс."}</small>
        <div className={styles.coreChips}>
          <i>{city}</i><i>{rooms==="Студия"?"Студия":rooms+" комн."}</i>
          {step>0&&<i>{financeLabel}</i>}
          {step>1&&delivery!=="Не важно"&&<i>{delivery}</i>}
          {step>2&&preferences.slice(0,2).map(id=><i key={id}>{preferenceLabel(id)}</i>)}
        </div>
      </div>
    </section>

    <div className={styles.progress} aria-label={"Шаг "+(step+1)+" из 4"}>
      {[0,1,2,3].map(i=><i key={i} className={i<=step?styles.progressActive:""}/>)}
    </div>

    <section className={styles.card}>
      {step===0&&<>
        <div className={styles.sectionHead}>
          <div className={styles.cardIcon}><Building2 size={19}/></div>
          <div><span className={styles.stepLabel}>ОСНОВА</span><h2>Где и что ищем?</h2><p>Это жёсткие условия: другой город или неподходящую планировку PULSE не будет выдавать как «почти совпадение».</p></div>
        </div>

        <div className={styles.fieldBlock}>
          <label>Город</label>
          <div className={styles.choiceGrid}>
            {control.select.cities.map(value=><button type="button" key={value} aria-pressed={city===value} onClick={()=>{setCity(value);safeHaptic();}} className={city===value?styles.active:""}>{value}</button>)}
          </div>
        </div>

        <div className={styles.fieldBlock}>
          <label>Комнатность</label>
          <div className={styles.roomGrid}>
            {control.select.roomOptions.map(value=><button type="button" key={value} aria-pressed={rooms===value} onClick={()=>{setRooms(value);safeHaptic();}} className={rooms===value?styles.active:""}>{value}</button>)}
          </div>
        </div>
      </>}

      {step===1&&<>
        <div className={styles.sectionHead}>
          <div className={styles.cardIcon}><WalletCards size={19}/></div>
          <div><span className={styles.stepLabel}>ВОЗМОЖНОСТИ</span><h2>Как удобнее считать?</h2><p>Если берёте ипотеку, PULSE ориентируется на взнос и комфортный платёж, а не заставляет угадывать цену квартиры.</p></div>
        </div>

        {control.select.mortgageEnabled&&<SegmentedControl
          className={styles.purchaseTabs}
          value={purchaseMode}
          onChange={value=>{setPurchaseMode(value as PurchaseMode);safeHaptic();}}
          ariaLabel="Способ покупки"
          options={[
            {value:"mortgage",label:"Ипотека"},
            {value:"cash",label:"По стоимости"},
          ]}
        />}

        {purchaseMode==="cash"?<>
          <div className={styles.moneyHero}><span>Ваш диапазон</span><strong>{shortRub(budget[0])} — {shortRub(budget[1])}</strong></div>
          <div className={styles.moneyInputs}>
            <label><span>От</span><div><Input inputMode="numeric" value={budgetDraft[0]} onChange={e=>editBudgetDraft(0,e.target.value)} onBlur={()=>commitBudgetDraft(0)} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/><b>₽</b></div></label>
            <label><span>До</span><div><Input inputMode="numeric" value={budgetDraft[1]} onChange={e=>editBudgetDraft(1,e.target.value)} onBlur={()=>commitBudgetDraft(1)} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/><b>₽</b></div></label>
          </div>
          <div className={styles.sliderWrap}>
            <Slider min={minPrice} max={maxPrice} step={priceStep} value={budget} onValueChange={setBudgetFromSlider}/>
            <div className={styles.sliderBounds}><span>{shortRub(minPrice)}</span><span>{shortRub(maxPrice)}</span></div>
          </div>
        </>:<>
          <div className={styles.financeGrid}>
            <label className={styles.financeCard}>
              <span><Banknote size={15}/>Первоначальный взнос</span>
              <div><Input inputMode="numeric" value={downDraft} onChange={e=>editMoney("down",e.target.value)} onBlur={()=>commitMoney("down")} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/><b>₽</b></div>
              <div className={styles.quickRow}>{[1_000_000,1_500_000,2_000_000,3_000_000].map(value=><button type="button" key={value} onClick={()=>{setDownPayment(value);setDownDraft(formatRub(value));safeHaptic();}}>{shortRub(value)}</button>)}</div>
            </label>

            <label className={styles.financeCard}>
              <span><WalletCards size={15}/>Комфортный платёж</span>
              <div><Input inputMode="numeric" value={paymentDraft} onChange={e=>editMoney("payment",e.target.value)} onBlur={()=>commitMoney("payment")} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/><b>₽</b></div>
              <div className={styles.quickRow}>{[40_000,60_000,80_000,100_000].map(value=><button type="button" key={value} onClick={()=>{setMonthlyPayment(value);setPaymentDraft(formatRub(value));safeHaptic();}}>{Math.round(value/1_000)} тыс.</button>)}</div>
            </label>
          </div>
          <div className={styles.infoBox}><ShieldCheck size={15}/><span>Это предварительная модель доступности. Она помогает ранжировать варианты, но не подменяет одобрение банка.</span></div>
        </>}
      </>}

      {step===2&&<>
        <div className={styles.sectionHead}>
          <div className={styles.cardIcon}><CalendarDays size={19}/></div>
          <div><span className={styles.stepLabel}>ГОРИЗОНТ</span><h2>Когда нужны ключи?</h2><p>Срок остаётся мягким приоритетом: сильный проект не пропадёт только потому, что сдаётся немного позже.</p></div>
        </div>

        <div className={styles.deliveryGrid}>
          {deliveryOptions.map(value=><button type="button" key={value} aria-pressed={delivery===value} onClick={()=>{setDelivery(value);safeHaptic();}} className={delivery===value?styles.active:""}>
            {value==="Сдан"&&<Check size={14}/>}
            {value}
          </button>)}
        </div>

        <div className={styles.timelineNote}>
          <CalendarDays size={16}/>
          <span>Годы формируются динамически. Когда в каталоге появятся проекты 2031+, PULSE добавит их автоматически.</span>
        </div>
      </>}

      {step===3&&<>
        <div className={styles.sectionHead}>
          <div className={styles.cardIcon}><Sparkles size={19}/></div>
          <div><span className={styles.stepLabel}>ХАРАКТЕР</span><h2>Что делает квартиру «вашей»?</h2><p>Выберите до {control.select.maxPreferences} приоритетов. Это не жёсткие фильтры — они учат PULSE правильно расставлять приоритеты.</p></div>
        </div>

        <div className={styles.preferenceGrid}>
          {visiblePreferences.map(option=>{
            const selected=preferences.includes(option.id);
            const disabled=!selected&&preferences.length>=control.select.maxPreferences;
            return <button type="button" key={option.id} aria-pressed={selected} disabled={disabled} onClick={()=>togglePreference(option.id)} className={selected?styles.preferenceActive:""}>
              <span className={styles.preferenceIcon}>{selected?<Check size={16}/>:preferenceIcon(option.id)}</span>
              <span><strong>{option.label}</strong><small>{option.hint}</small></span>
            </button>
          })}
        </div>
        <div className={styles.selectionCount}>{preferences.length}/{control.select.maxPreferences} выбрано</div>
      </>}
    </section>

    <div className={styles.liveMatch}>
      <div><Sparkles size={17}/><span><strong>{liveCount} {plural(liveCount,["вариант","варианта","вариантов"])}</strong><small>{step===0?"после города и планировки":strongCount>0?strongCount+" с высоким совпадением":"PULSE продолжает искать лучший баланс"}</small></span></div>
      <ChevronRight size={17}/>
    </div>

    <div className={styles.actions}>
      {step>0&&<button type="button" className={styles.back} onClick={()=>{setStep(value=>Math.max(0,value-1));safeHaptic();}}><ChevronLeft size={17}/>Назад</button>}
      <button type="button" className={styles.next} onClick={next}>{last?"Собрать мой подбор":"Продолжить"}<ChevronRight size={18}/></button>
    </div>

    <div className={styles.note}><ShieldCheck size={14}/>PULSE запомнит ответы — к подбору можно вернуться позже</div>
  </div>;
}
