import {safeLocalStorage} from '../../../../packages/browser/storage';
import {rememberCityInterest} from '../helpers/cityInterest';
import {housingClassChoices,mentionedHousingClasses} from '../../../../packages/domain/housingClass';
import {APARTMENT_FINISHES,apartmentFinishLabel} from '../../../../packages/domain/propertyFinish';
import {propertyPricePerSqmLabel} from '../../../../packages/domain/propertyPresentation';
import type {ApartmentFinish} from '../../../../packages/pulse-data/model';
import {LoadRecovery} from '../components/LoadRecovery';
import {publishedCatalogFacets,roomChoiceLabel} from '../../../../packages/domain/catalogFacets';
import {IconTile} from '../components/IconTile';
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
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Home,
  Paintbrush,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trees,
  WalletCards,
  Waves,
} from "lucide-react";
import {
  selectionMatch,
  districtKey,
  preferenceLabel,
  type PreferenceId,
  type PurchaseMode,
  type SelectionCriteria,
} from "../../../../packages/domain/propertyMatch";
import {
  MORTGAGE_POLICY_VERSION,
  readMortgageScenario,
  type MortgageScenarioSettings,
} from "../../../../packages/domain/mortgagePolicy";
import { Slider } from "../components/Slider";
import { Input } from "../components/Input";
import {NativeSelect} from "../components/NativeSelect";
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
  district?:string|null;
  districtRequired?:boolean;
  preferredPreferences?:PreferenceId[];
  housingClasses?:string[];
  areaFrom?:number|null;
  areaTo?:number|null;
  finishType?:ApartmentFinish|null;
  step?:number;
  city?:string;
  rooms?:string;
  delivery?:string;
  purchaseMode?:PurchaseMode;
  budget?:[number,number];
  downPayment?:number;
  monthlyPayment?:number;
  mortgageProgram?:"standard"|"family"|"farEast"|"it";
  preferences?:PreferenceId[];
  showResult?:boolean;
  started?:boolean;
  version?:number;
};

type PanelId="essentials"|"finance"|"delivery"|"preferences";
type ScenarioId="more-payment"|"more-down"|"relax-preference"|"relax-delivery"|"relax-district"|"relax-class"|"relax-area"|"relax-finish";
type Scenario={id:ScenarioId;title:string;detail:string;value:string;gain:number};

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

export default function SelectionPage(){
  const navigate=useNavigate();
  const control=usePulseControlState();
  const {data:bounds}=usePriceBounds();
  const catalog=useSelectionProperties();
  const properties=catalog.data??[];
  const facets=React.useMemo(()=>publishedCatalogFacets(catalog.data??[]),[catalog.data]);
  const roomOptions=React.useMemo(()=>["Все",...facets.rooms],[facets.rooms]);
  const minPrice=0;
  const maxPrice=bounds?.maxPriceRub??FALLBACK_MAX;
  const priceStep=bounds?.stepRub??FALLBACK_STEP;

  const saved=React.useMemo<SavedSelection>(()=>{
    try{
      const parsed=JSON.parse(safeLocalStorage.getItem(STORAGE_KEY)||"{}");
      return parsed&&typeof parsed==="object"?parsed:{};
    }catch{return{};}
  },[]);

  const defaultCity=control.select.cities.includes(saved.city||"")
    ?saved.city!
    :control.select.cities[0]??"Владивосток";
  const defaultRooms=saved.rooms||"2";

  const [showResult,setShowResult]=React.useState(saved.showResult===true);
  const [showAll,setShowAll]=React.useState(false);
  const [started,setStarted]=React.useState(saved.started===true||saved.showResult===true||(Number.isInteger(saved.step)&&Number(saved.step)>0));
  const [openPanel,setOpenPanel]=React.useState<PanelId|null>("essentials");
  const [city,setCity]=React.useState(defaultCity);
  const [district,setDistrict]=React.useState<string|null>(saved.district??(saved.preferences?.includes("center")?"Центр":null));
  const [districtRequired,setDistrictRequired]=React.useState(saved.districtRequired??!saved.preferredPreferences?.includes("center"));
  const [preferredPreferences,setPreferredPreferences]=React.useState<PreferenceId[]>(saved.preferredPreferences??[]);
  const districtOptions=React.useMemo(()=>[...new Set(properties.filter(p=>p.status==='published'&&(city==='Все'||p.city===city)).map(p=>p.district.trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru')),[properties,city]);
  const [rooms,setRooms]=React.useState(defaultRooms);
  const [housingClasses,setHousingClasses]=React.useState<string[]>(Array.isArray(saved.housingClasses)?saved.housingClasses.filter((v):v is string=>typeof v==='string').slice(0,8):[]);
  const [areaFrom,setAreaFrom]=React.useState<number|null>(typeof saved.areaFrom==='number'&&saved.areaFrom>0&&saved.areaFrom<=10000?saved.areaFrom:null);
  const [areaTo,setAreaTo]=React.useState<number|null>(typeof saved.areaTo==='number'&&saved.areaTo>0&&saved.areaTo<=10000?saved.areaTo:null);
  const [finishType,setFinishType]=React.useState<ApartmentFinish|null>(APARTMENT_FINISHES.some(([id])=>id===saved.finishType)?saved.finishType!:null);
  const classOptions=React.useMemo(()=>housingClassChoices(properties.filter(p=>city==='Все'||p.city===city).map(p=>p.className)),[properties,city]);
  const invalidArea=[areaFrom,areaTo].some(value=>value!==null&&(!Number.isFinite(value)||value<=0||value>10000))||(areaFrom!==null&&areaTo!==null&&areaFrom>areaTo);
  const [purchaseMode,setPurchaseMode]=React.useState<PurchaseMode>(control.select.mortgageEnabled&&saved.purchaseMode!=="cash"?"mortgage":"cash");
  const [budget,setBudget]=React.useState<[number,number]>(saved.budget||[FALLBACK_MIN,FALLBACK_MAX]);
  const [budgetDraft,setBudgetDraft]=React.useState<[string,string]>([
    formatRub(saved.budget?.[0]??FALLBACK_MIN),
    formatRub(saved.budget?.[1]??FALLBACK_MAX),
  ]);
  const budgetInitialized=React.useRef(false);
  const [mortgageProgram,setMortgageProgram]=React.useState<"standard"|"family"|"farEast"|"it">(saved.mortgageProgram??"standard");
  const [mortgageScenario,setMortgageScenario]=React.useState<MortgageScenarioSettings|null>(()=>readMortgageScenario(typeof safeLocalStorage==="undefined"?null:safeLocalStorage));
  const [downPayment,setDownPayment]=React.useState(saved.downPayment??1_500_000);
  const [downDraft,setDownDraft]=React.useState(formatRub(saved.downPayment??1_500_000));
  const [monthlyPayment,setMonthlyPayment]=React.useState(saved.monthlyPayment??60_000);
  const [paymentDraft,setPaymentDraft]=React.useState(formatRub(saved.monthlyPayment??60_000));
  const [delivery,setDelivery]=React.useState(saved.delivery||"Не важно");
  const [preferences,setPreferences]=React.useState<PreferenceId[]>(Array.isArray(saved.preferences)?saved.preferences.filter(id=>id!=="center").slice(0,control.select.maxPreferences):[]);
  const [smartQuery,setSmartQuery]=React.useState("");
  const [smartStatus,setSmartStatus]=React.useState("");

  React.useEffect(()=>{
    const shared=readMortgageScenario(safeLocalStorage);
    if(!shared)return;
    setMortgageScenario(shared);
    if(control.mortgagePrograms.some(item=>item.id===shared.programId))setMortgageProgram(shared.programId);
  },[control.mortgagePrograms]);

  React.useEffect(()=>{
    if(!control.select.cities.includes(city))setCity(control.select.cities[0]??"Владивосток");
  },[control.select.cities,roomOptions,city,rooms,catalog.isSuccess,facets.rooms]);

  React.useEffect(()=>{
    if(!control.select.mortgageEnabled&&purchaseMode!=="cash")setPurchaseMode("cash");
  },[control.select.mortgageEnabled,purchaseMode]);

  React.useEffect(()=>{
    if(!control.mortgagePrograms.some(item=>item.id===mortgageProgram)&&control.mortgagePrograms[0]){
      setMortgageProgram(control.mortgagePrograms[0].id);
      setMortgageScenario(null);
    }
  },[control.mortgagePrograms,mortgageProgram]);

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
      ?[Math.max(0,savedBudget[0]),Math.max(0,savedBudget[1])]
      :[bounds.minPriceRub,bounds.maxPriceRub];
    if(next[0]>next[1])next[0]=next[1];
    setBudget(next);
    setBudgetDraft([formatRub(next[0]),formatRub(next[1])]);
    budgetInitialized.current=true;
  },[bounds,saved.budget]);

  const deliveryOptions=React.useMemo(()=>["Не важно",...facets.deliveries],[facets.deliveries]);

  const appliedMortgageScenario=React.useMemo(()=>{
    if(purchaseMode!=="mortgage"||!mortgageScenario)return null;
    if(mortgageScenario.programId!==mortgageProgram)return null;
    if(mortgageScenario.propertyKind!=="newbuild")return null;
    return mortgageScenario;
  },[purchaseMode,mortgageScenario,mortgageProgram]);

  const setBudgetFromSlider=(values:number[])=>{
    budgetInitialized.current=true;
    setStarted(true);
    const next:[number,number]=[values[0]??minPrice,values[1]??maxPrice];
    setBudget(next);
    setBudgetDraft([formatRub(next[0]),formatRub(next[1])]);
  };

  const editBudgetDraft=(index:0|1,value:string)=>{
    budgetInitialized.current=true;
    setStarted(true);
    const clean=value.replace(/[^0-9]/g,"");
    setBudgetDraft(prev=>{
      const next:[string,string]=[...prev] as [string,string];
      next[index]=clean?formatRub(Number(clean)):"";
      return next;
    });
  };

  const commitBudgetDraft=(index:0|1)=>{
    setStarted(true);
    const raw=Number(budgetDraft[index].replace(/[^0-9]/g,""));
    let value=Number.isFinite(raw)&&raw>0?raw:budget[index];
    value=Math.max(0,Math.round(value));
    const next:[number,number]=[...budget] as [number,number];
    next[index]=value;
    if(index===0&&next[0]>next[1])next[1]=next[0];
    if(index===1&&next[1]<next[0])next[0]=next[1];
    setBudget(next);
    setBudgetDraft([formatRub(next[0]),formatRub(next[1])]);
  };

  const editMoney=(kind:"down"|"payment",value:string)=>{
    setStarted(true);
    const clean=value.replace(/[^0-9]/g,"");
    const formatted=clean?formatRub(Number(clean)):"";
    if(kind==="down")setDownDraft(formatted);
    else setPaymentDraft(formatted);
  };

  const commitMoney=(kind:"down"|"payment")=>{
    setStarted(true);
    const draft=kind==="down"?downDraft:paymentDraft;
    const current=kind==="down"?downPayment:monthlyPayment;
    const raw=Number(draft.replace(/[^0-9]/g,""));
    const value=draft.trim()!==""&&Number.isFinite(raw)&&(kind==="down"?raw>=0:raw>0)?raw:current;
    if(kind==="down"){
      const next=clamp(Math.round(value),0,Math.max(500_000,maxPrice));
      setDownPayment(next);setDownDraft(formatRub(next));
    }else{
      const next=clamp(Math.round(value),15_000,300_000);
      setMonthlyPayment(next);setPaymentDraft(formatRub(next));
    }
  };

  const visiblePreferences=preferenceOptions.filter(option=>{
    if(!control.select.preferenceEnabled[option.id])return false;
    if(option.id==="sea")return control.select.seaEnabled&&city==="Владивосток";
    return true;
  });

  const togglePreference=(id:PreferenceId)=>{
    setStarted(true);
    setPreferences(current=>{
      if(current.includes(id))return current.filter(item=>item!==id);
      if(current.length>=control.select.maxPreferences)return current;
      return [...current,id];
    });
    safeHaptic();
  };

  const criteria=React.useMemo<SelectionCriteria>(()=>({
    city,district,districtRequired,requiredPreferences:preferences.filter(id=>!preferredPreferences.includes(id)),
    rooms,
    housingClasses,areaFrom,areaTo,finishType,
    delivery,
    purchaseMode,
    min:budget[0],
    max:budget[1],
    downPayment,
    monthlyPayment,
    mortgageProgram,
    mortgageScenario:appliedMortgageScenario,
    preferences,
  }),[city,district,districtRequired,preferredPreferences,rooms,housingClasses,areaFrom,areaTo,finishType,delivery,purchaseMode,budget,downPayment,monthlyPayment,mortgageProgram,appliedMortgageScenario,preferences]);

  const rankFor=React.useCallback((next:SelectionCriteria)=>properties
    .map(property=>({property,match:selectionMatch(property,next,control.mortgagePrograms,control.select.weights)}))
    .sort((a,b)=>Number(b.match.eligible)-Number(a.match.eligible)||b.match.score-a.match.score||a.match.tradeoffs.length-b.match.tradeoffs.length||(a.match.price??Infinity)-(b.match.price??Infinity)||a.property.id.localeCompare(b.property.id))
  ,[properties,control.mortgagePrograms,control.select.weights]);

  const ranked=React.useMemo(()=>rankFor(criteria),[rankFor,criteria]);
  const eligible=ranked.filter(item=>item.match.eligible);
  const strongCount=eligible.filter(item=>item.match.score>=85).length;
  const topScore=eligible[0]?.match.score??0;
  const financeLabel=purchaseMode==="mortgage"
    ?("до "+Math.round(monthlyPayment/1000)+" тыс./мес")
    :("до "+shortRub(budget[1]));

  const persistSelection=React.useCallback(()=>{
    const value:SavedSelection={city,district,districtRequired,preferredPreferences,rooms,housingClasses,areaFrom,areaTo,finishType,delivery,purchaseMode,budget,downPayment,monthlyPayment,mortgageProgram,preferences,showResult,started,version:6};
    try{safeLocalStorage.setItem(STORAGE_KEY,JSON.stringify(value));}catch{}
  },[city,district,districtRequired,preferredPreferences,rooms,housingClasses,areaFrom,areaTo,finishType,delivery,purchaseMode,budget,downPayment,monthlyPayment,mortgageProgram,preferences,showResult,started]);

  React.useEffect(()=>{persistSelection()},[persistSelection]);

  const applySmartQuery=()=>{
    const raw=smartQuery.trim();
    if(!raw){setSmartStatus("Напишите запрос одним предложением.");return;}
    setStarted(true);
    const text=raw.toLowerCase().replace(/ё/g,"е").replace(/(\d)[\s\u00a0\u202f]+(?=\d{3}\b)/g,"$1");
    let found=0;
    let nextCity=city;
    let nextRooms=rooms;
    let nextMode=purchaseMode;
    let nextBudget:[number,number]=budget;
    let nextDown=downPayment;
    let nextPayment=monthlyPayment;
    let nextDelivery=delivery;
    const nextPreferences=[...preferences];
    let nextDistrict=district;
    let nextDistrictRequired=districtRequired;
    const classes=mentionedHousingClasses(text,housingClassChoices(properties.map(p=>p.className)));
    if(classes.length){setHousingClasses(classes);found++;}
    else if(/любой класс|класс не важен/.test(text)){setHousingClasses([]);found++;}
    const parsedFinish=/без отделки|без ремонта|чернов/.test(text)?'rough':/white\s*box|вайт\s*бокс|предчистов/.test(text)?'white_box':/готов[а-я]* ремонт|с ремонтом|чистов[а-я]* отделк/.test(text)?'finished':null;
    if(parsedFinish){setFinishType(parsedFinish);found++;}
    const areaRange=text.match(/(?:от\s*)?(\d+(?:[.,]\d+)?)\s*(?:м[²2]\s*)?(?:до|[-–])\s*(\d+(?:[.,]\d+)?)\s*(?:м[²2]|кв\.?\s*м)/);
    if(areaRange){const from=Number(areaRange[1].replace(',','.')),to=Number(areaRange[2].replace(',','.'));if(from>0&&to>=from&&to<=10000){setAreaFrom(from);setAreaTo(to);found++;}}

    const cityMatch=control.select.cities.find(value=>text.includes(value.toLowerCase().replace(/ё/g,"е")));
    if(cityMatch){nextCity=cityMatch;rememberCityInterest(cityMatch);found++;}
    if(nextCity!==city)nextDistrict=null;
    const possibleDistricts=properties.filter(p=>p.city===nextCity&&p.status==='published').map(p=>p.district.trim()).filter(Boolean);
    const mentionedDistrict=possibleDistricts.find(value=>districtKey(value)!=='центр'&&text.includes(districtKey(value)));
    const centerRequest=/(?:^|[^а-я])центр[а-я]*(?:$|[^а-я])/.test(text)&&!/не\s+(?:в\s+)?центр|без\s+центр/.test(text);
    const centerDistrict=possibleDistricts.find(value=>districtKey(value)==='центр');
    if(mentionedDistrict||centerRequest){nextDistrict=mentionedDistrict??centerDistrict??'Центр';nextDistrictRequired=!/желательн|ближе|недалеко|рядом/.test(text);found++;}
    if(/любой район|район не важен|без ограничения по району/.test(text)){nextDistrict=null;found++;}


    if(/студи/.test(text)){nextRooms="Студия";found++;}
    else if(/двуш|2\s*[- ]?(?:комн|к\b)|двухкомнат/.test(text)){nextRooms="2";found++;}
    else if(/однуш|1\s*[- ]?(?:комн|к\b)|однокомнат/.test(text)){nextRooms="1";found++;}
    else if(/треш|трехкомнат|3\s*[- ]?(?:комн|к\b)/.test(text)){nextRooms=facets.rooms.includes("3")?"3":"3+";found++;}

    const mortgageIntent=!/без\s+ипотек/.test(text)&&/ипотек|платеж|платёж|в месяц|\/мес/.test(text);
    const cashIntent=/налич|без ипотек|полная стоимость/.test(text);
    if(mortgageIntent&&control.select.mortgageEnabled){nextMode="mortgage";found++;}
    else if(cashIntent){nextMode="cash";found++;}

    const paymentMatch=text.match(/(\d+(?:[.,]\d+)?)\s*(тыс|тысяч|к)?\.?\s*(?:руб(?:лей|ля|ль)?\.?|₽)?\s*(?:\/\s*мес|в месяц)/i);
    if(paymentMatch){
      const parsed=paymentMatch[2]?parseScaledMoney(paymentMatch[1],paymentMatch[2]):Number(paymentMatch[1].replace(",","."));
      if(parsed&&control.select.mortgageEnabled){nextPayment=Math.round(parsed);nextMode="mortgage";found++;}
    }

    const downMatch=text.match(/(?:первоначальн\w*\s+)?взнос[^\d]{0,18}(\d+(?:[.,]\d+)?)\s*(млн|миллион\w*|тыс|тысяч)/i);
    if(downMatch){
      const parsed=parseScaledMoney(downMatch[1],downMatch[2]);
      if(parsed&&control.select.mortgageEnabled){nextDown=Math.round(parsed);nextMode="mortgage";found++;}
    }

    const budgetMatch=text.match(/(?:до\s*|бюджет[^\d]{0,12}|стоимост\w*[^\d]{0,12})(\d+(?:[.,]\d+)?)\s*(млн|миллион\w*)/i);
    if(budgetMatch&&!downMatch){
      budgetInitialized.current=true;
      const parsed=parseScaledMoney(budgetMatch[1],budgetMatch[2]);
      if(parsed){
        const nextMax=Math.round(parsed);
        nextBudget=[minPrice,nextMax];
        if(!mortgageIntent)nextMode="cash";
        found++;
      }
    }

    const year=text.match(/20(?:2[6-9]|3\d)/)?.[0];
    if(year){nextDelivery=year;found++;}
    else if(/сдан|готовый дом|готовое/.test(text)){nextDelivery="Сдан";found++;}

    const preferenceMap:[PreferenceId,RegExp][]=[
      ["sea",/море|моря|морю|морем|морск|панорам.*вод/],
      ["family",/семь|семейн|дет|школ|садик/],
      ["parking",/парков|паркинг|машин/],
      ["courtyard",/двор|благоустрой|зел[её]н/],
      ["finish",/white\s*box|предчистов|с отделкой|с ремонтом|готов.*заех/],
    ];
    if(parsedFinish==='rough'){const index=nextPreferences.indexOf('finish');if(index>=0)nextPreferences.splice(index,1);}
    for(const [id,pattern] of preferenceMap){
      const enabled=control.select.preferenceEnabled[id]&&(id!=="sea"||control.select.seaEnabled);
      const preferenceText=id==='family'?text.replace(/семейн[а-я]*\s+ипотек[а-я]*/g,''):text;
      const negated=id==='parking'&&/без\s+парков|парковк[а-я]*\s+не\s+нуж/.test(text);
      if(enabled&&!negated&&!(id==="finish"&&parsedFinish==="rough")&&pattern.test(preferenceText)&&!nextPreferences.includes(id)){nextPreferences.push(id);found++;}
    }

    if(nextCity!=="Владивосток"||!control.select.seaEnabled){
      const index=nextPreferences.indexOf("sea");
      if(index>=0)nextPreferences.splice(index,1);
    }

    setCity(nextCity);
    setDistrict(nextDistrict);setDistrictRequired(nextDistrictRequired);
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
    setSmartStatus(found
      ?"PULSE понял "+found+" "+plural(found,["параметр","параметра","параметров"])+". Проверьте карточки ниже."
      :"Не хочу додумывать за вас. Выберите параметры ниже."
    );
    setShowResult(false);
    safeHaptic(found>2?"medium":"light");
  };

  const finish=()=>{
    setStarted(true);
    persistSelection();
    try{
      const history=JSON.parse(safeLocalStorage.getItem("pulse_selection_history")||"[]");
      const nextHistory=[{
        city,district,districtRequired,preferredPreferences,rooms,housingClasses,areaFrom,areaTo,finishType,min:budget[0],max:budget[1],delivery,
        mortgage:purchaseMode==="mortgage",downPayment,monthlyPayment,mortgageProgram,
        preferences,score:topScore,strongCount,createdAt:Date.now(),
      },...(Array.isArray(history)?history:[])].slice(0,5);
      safeLocalStorage.setItem("pulse_selection_history",JSON.stringify(nextHistory));
    }catch{}

    rememberCityInterest(city);
    recordPulseEvent({
      eventType:"select_submit",
      entityType:"selection",
      metadata:{
        city,district,districtRequired,requiredPreferences:preferences.filter(id=>!preferredPreferences.includes(id)).join(","),rooms,housingClasses:housingClasses.join(","),areaFrom,areaTo,finishType,min:budget[0],max:budget[1],delivery,
        mortgage:purchaseMode==="mortgage",
        sea:preferences.includes("sea"),
        down:downPayment,
        payment:monthlyPayment,
        preferences:preferences.join(","),
        purchaseMode,
        program:purchaseMode==="mortgage"?mortgageProgram:null,
        topScore,strongCount,results:eligible.length,
        propertyIds:eligible.slice(0,3).map(item=>item.property.id),
        source:"pulse-select-v6",
        policyVersion:MORTGAGE_POLICY_VERSION,
      }
    });

    setShowResult(true);
    setShowAll(false);
    safeHaptic("medium");
    window.setTimeout(()=>window.scrollTo({top:0,behavior:"smooth"}),20);
  };

  const reset=()=>{
    setShowResult(false);
    setShowAll(false);
    setOpenPanel("essentials");
    window.scrollTo({top:0,behavior:"smooth"});
  };

  const measure=React.useCallback((next:SelectionCriteria)=>{
    const list=rankFor(next);
    const exact=list.filter(item=>item.match.eligible);
    return {eligible:exact.length,strong:exact.filter(item=>item.match.score>=85).length};
  },[rankFor]);

  const scenarios=React.useMemo<Scenario[]>(()=>{
    const items:Scenario[]=[];
    const base={eligible:eligible.length,strong:strongCount};
    const extraLabel=(count:number,strong=false)=>{const n=Math.max(0,count);return "+"+n+" "+plural(n,strong?["сильное","сильных","сильных"]:["вариант","варианта","вариантов"]);};
    const gainFor=(next:SelectionCriteria)=>{
      const measured=measure(next);
      return {measured,gain:Math.max(measured.eligible-base.eligible,measured.strong-base.strong)};
    };

    if(purchaseMode==="mortgage"){
      const paymentResult=gainFor({...criteria,monthlyPayment:monthlyPayment+10_000});
      items.push({id:"more-payment",title:"+10 тыс. ₽ к платежу",detail:"Остальные пожелания не меняются.",value:extraLabel(paymentResult.measured.eligible-base.eligible),gain:paymentResult.gain});

      const downResult=gainFor({...criteria,downPayment:downPayment+500_000});
      items.push({id:"more-down",title:"+500 тыс. ₽ к взносу",detail:"Проверим влияние большего первоначального взноса.",value:extraLabel(downResult.measured.eligible-base.eligible),gain:downResult.gain});
    }else{
      const extra=Math.max(500_000,Math.round(budget[1]*.08/100_000)*100_000);
      const result=gainFor({...criteria,max:Math.min(maxPrice,budget[1]+extra)});
      items.push({id:"more-payment",title:"Чуть расширить бюджет",detail:"Добавить до "+shortRub(extra)+" к верхней границе.",value:extraLabel(result.measured.eligible-base.eligible),gain:result.gain});
    }

    const alternatives:{id:ScenarioId;title:string;detail:string;active:boolean;criteria:SelectionCriteria}[]=[
      {id:'relax-class',title:'Рассмотреть другие классы',detail:'Снять только ограничение по классу жилья.',active:housingClasses.length>0,criteria:{...criteria,housingClasses:[]}},
      {id:'relax-area',title:'Гибче по площади',detail:'Снять только ограничения по площади квартиры.',active:areaFrom!==null||areaTo!==null,criteria:{...criteria,areaFrom:null,areaTo:null}},
      {id:'relax-finish',title:'Рассмотреть другую отделку',detail:'Снять только выбор конкретной отделки.',active:finishType!==null,criteria:{...criteria,finishType:null}},
    ];
    for(const alternative of alternatives.filter(item=>item.active)){
      const result=gainFor(alternative.criteria);items.push({id:alternative.id,title:alternative.title,detail:alternative.detail,value:extraLabel(result.measured.eligible-base.eligible),gain:result.gain});
    }
    if(district){
      const result=gainFor({...criteria,district:null});
      items.push({id:"relax-district",title:"Рассмотреть другие районы",detail:"Снять только ограничение по району; остальные условия сохранятся.",value:extraLabel(result.measured.eligible-base.eligible),gain:result.gain});
    }
    if(preferences.length){
      const result=gainFor({...criteria,preferences:preferences.slice(0,-1)});
      items.push({id:"relax-preference",title:"Без «"+preferenceLabel(preferences[preferences.length-1])+"»",detail:"Снимем только это условие; остальные сохранятся.",value:extraLabel(result.measured.eligible-base.eligible),gain:result.gain});
    }

    if(delivery!=="Не важно"){
      const result=gainFor({...criteria,delivery:"Не важно"});
      items.push({id:"relax-delivery",title:"Гибче по сроку сдачи",detail:"Не ограничивать выбор одним сроком.",value:extraLabel(result.measured.eligible-base.eligible),gain:result.gain});
    }

    return items.sort((a,b)=>b.gain-a.gain).slice(0,3);
  },[criteria,eligible.length,strongCount,purchaseMode,monthlyPayment,downPayment,budget,preferences,delivery,district,housingClasses,areaFrom,areaTo,finishType,measure,maxPrice]);

  const applyScenario=(id:ScenarioId)=>{
    if(id==="more-payment"){
      if(purchaseMode==="mortgage"){
        const next=monthlyPayment+10_000;setMonthlyPayment(next);setPaymentDraft(formatRub(next));
      }else{
        const extra=Math.max(500_000,Math.round(budget[1]*.08/100_000)*100_000);
        const next:[number,number]=[budget[0],Math.min(maxPrice,budget[1]+extra)];
        setBudget(next);setBudgetDraft([formatRub(next[0]),formatRub(next[1])]);
      }
    }
    if(id==="more-down"){const next=downPayment+500_000;setDownPayment(next);setDownDraft(formatRub(next));}
    if(id==="relax-preference")setPreferences(current=>current.slice(0,-1));
    if(id==="relax-delivery")setDelivery("Не важно");
    if(id==="relax-district")setDistrict(null);
    if(id==='relax-class')setHousingClasses([]);
    if(id==='relax-area'){setAreaFrom(null);setAreaTo(null);}
    if(id==='relax-finish')setFinishType(null);
    setShowAll(false);
    safeHaptic("medium");
  };

  const panelSummary=(id:PanelId)=>{
    if(id==="essentials")return [city,district,roomChoiceLabel(rooms),...housingClasses,finishType?apartmentFinishLabel(finishType):null].filter(Boolean).join(" · ");
    if(id==="finance")return purchaseMode==="mortgage"
      ?formatRub(downPayment)+" ₽ ПВ · "+Math.round(monthlyPayment/1000)+" тыс./мес"
      :shortRub(budget[0])+" — "+shortRub(budget[1]);
    if(id==="delivery")return delivery;
    return preferences.length?preferences.map(preferenceLabel).slice(0,2).join(" · "):"Не выбрано";
  };

  const panelHeader=(id:PanelId,title:string,subtitle:string,icon:React.ReactNode)=><button
    type="button"
    className={styles.selectPanelHead}
    onClick={()=>{setStarted(true);setOpenPanel(current=>current===id?null:id);safeHaptic()}}
    aria-expanded={openPanel===id}
  >
    <IconTile className={styles.selectPanelIcon}>{icon}</IconTile>
    <span className={styles.selectPanelCopy}><strong>{title}</strong><small>{openPanel===id?subtitle:panelSummary(id)}</small></span>
    <ChevronDown size={17}/>
  </button>;

  if(showResult){
    const display=showAll?eligible:eligible.slice(0,6);
    const source=display;
    return <div className={styles.page}>
      <section className={styles.selectResultSummary} aria-label="Результат PULSE Select">
        <div className={styles.selectResultTop}>
          <span className={styles.eyebrow}>PULSE SELECT</span>
          <span className={styles.selectPolicy}><CircleCheck size={12}/>v6</span>
        </div>
        <h1>{eligible.length
          ?eligible.length+" "+plural(eligible.length,["вариант подходит","варианта подходят","вариантов подходят"])
          :"Точного совпадения пока нет"}</h1>
        <p>{eligible.length
          ?<>Из них <strong>{strongCount}</strong> {plural(strongCount,["сильное совпадение","сильных совпадения","сильных совпадений"])}. PULSE объясняет, почему каждый проект попал сюда.</>
          :<>ЖК по всем обязательным условиям пока нет. Измените запрос или выберите ниже, какое ограничение можно снять.</>
        }</p>
        <div className={styles.summaryChips}>
          <span><Home size={13}/>{city}</span>
          <span>{roomChoiceLabel(rooms)}</span>{district&&<span>{district}{!districtRequired?" · желательно":""}</span>}
        {housingClasses.map(value=><span key={value}>{value}</span>)}
        {(areaFrom!==null||areaTo!==null)&&<span>{areaFrom??0}–{areaTo??"∞"} м²</span>}
        {finishType&&<span>{apartmentFinishLabel(finishType)}</span>}
          <span>{financeLabel}</span>
          {delivery!=="Не важно"&&<span>{delivery}</span>}
        </div>
      </section>

      <section className={styles.resultIntro}>
        <div><span>РЕКОМЕНДАЦИИ</span><strong>{eligible.length?"Сначала самое подходящее":"Измените условия поиска"}</strong></div>
        <small>Процент показывает совпадение с условиями и пожеланиями, а не вероятность покупки.</small>
      </section>

      <section className={styles.matchList}>
        {!source.length&&<p className={styles.disclaimer}>Нет подтверждённых совпадений по всем условиям. Другие ЖК появятся только после изменения запроса.</p>}
        {source.map(({property,match},index)=>{
          const image=property.coverImageUrl||property.images[0]?.url;
          return <article className={styles.matchCard} key={property.id}>
            <div className={styles.matchMedia}>
              {image?<img src={image} alt={property.name}/>:<div className={styles.matchFallback}><Building2 size={28}/></div>}
              <span className={styles.matchRank}>{!match.eligible?"Стоит уточнить параметры":index===0?"Лучшее совпадение":index===1?"Сильная альтернатива":"Подходит по запросу"}</span>
              <span className={styles.matchScore}>{match.score}%</span>
            </div>
            <div className={styles.matchBody}>
              <div className={styles.matchTitle}>
                <div><strong>{property.name}</strong><span>{property.city} · {property.district}</span></div>
                <div className={styles.resultPrice}><b>{match.price?("от "+shortRub(match.price)):"По запросу"}</b>{propertyPricePerSqmLabel(property)&&<small>{propertyPricePerSqmLabel(property)}</small>}</div>
              </div>

              <div className={styles.whyTitle}><Sparkles size={13}/><span>{match.eligible?"Почему подходит":"Что совпало"}</span></div>
              <div className={styles.reasonList}>
                {match.reasons.map(reason=><span key={reason}><Check size={12}/>{reason}</span>)}
              </div>

              {purchaseMode==="mortgage"&&match.mortgagePayment!==null&&<div className={styles.paymentHint}>
                <WalletCards size={15}/>
                <span><strong>≈ {formatPayment(match.mortgagePayment)}</strong><small>по сценарию «{match.mortgageProgram}» · право на льготу подтверждает банк</small></span>
              </div>}

              {match.tradeoffs.length>0&&<div className={styles.tradeoff}>
                <span>ЧТО НУЖНО ПРИНЯТЬ</span><p>{match.tradeoffs.join(" · ")}</p>
              </div>}

              <button type="button" className={styles.openProperty} onClick={()=>navigate("/property/"+property.id,{state:{returnTo:"/selection"}})}>
                Посмотреть проект <ArrowRight size={16}/>
              </button>
            </div>
          </article>
        })}
      </section>

      {control.select.whatIfEnabled&&scenarios.length>0&&<section className={styles.whatIf}>
        <div className={styles.whatIfHead}>
          <IconTile><Sparkles/></IconTile><div><span>Другие сценарии покупки</span><p>Измените один параметр и сравните результат.</p></div>
        </div>
        <div className={styles.scenarioList}>
          {scenarios.map(item=><button type="button" key={item.id} onClick={()=>applyScenario(item.id)}>
            <span><strong>{item.title}</strong><small>{item.detail}</small></span>
            <span className={styles.scenarioOutcome} data-gain={item.gain>0?"positive":"neutral"}><b>{item.gain<=0?"Без новых вариантов":item.value.startsWith("+0 ")?"+"+item.gain+" "+plural(item.gain,["сильное","сильных","сильных"]):item.value}</b><ChevronRight size={16}/></span>
          </button>)}
        </div>
      </section>}

      {eligible.length>6&&!showAll&&<button type="button" className={styles.moreButton} onClick={()=>setShowAll(true)}>
        Показать ещё {eligible.length-6} {plural(eligible.length-6,["вариант","варианта","вариантов"])}
      </button>}

      <div className={styles.resultActions}>
        <button type="button" className={styles.editButton} onClick={reset}><RotateCcw size={15}/>Изменить запрос</button>
        <button type="button" className={styles.catalogButton} onClick={()=>navigate("/catalog")}>Весь каталог<ChevronRight size={16}/></button>
      </div>

      <div className={styles.disclaimer}><ShieldCheck size={14}/>Подбор учитывает ваши пожелания и бюджет. Окончательные условия ипотеки подтверждает банк.</div>
    </div>;
  }

  return <div className={styles.page}>
    <header className={styles.selectHero}>
      <div className={styles.selectHeroTop}><span className={styles.eyebrow}>PULSE SELECT</span><span className={styles.selectVersion}>6.0</span></div>
      <h1>Опишите, что ищете.<br/><em>PULSE соберёт остальное.</em></h1>
      <p>Не анкета и не сотня фильтров. Один живой запрос, который можно уточнять в любом порядке.</p>
    </header>

    <section className={styles.requestComposer} aria-label="Ваш подбор">
    {control.select.smartQueryEnabled&&<section className={styles.smartPrompt}>
      <div className={styles.smartPromptHead}><IconTile><Sparkles/></IconTile><div><span>Можно своими словами</span><small>Город, бюджет и то, что важно</small></div></div>
      <div className={styles.smartInput}>
        <textarea
          rows={2}
          value={smartQuery}
          onChange={event=>{setSmartQuery(event.target.value);setSmartStatus("");}}
          onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();applySmartQuery();}}}
          placeholder="Двушка во Владивостоке, до 70 тыс./мес, у моря"
          aria-label="Опишите квартиру своими словами"
        />
        <button type="button" onClick={applySmartQuery} aria-label="Понять запрос"><ArrowRight size={19}/></button>
      </div>
      {smartStatus&&<div className={styles.smartStatus}><Check size={13}/>{smartStatus}</div>}
    </section>}

    <section className={styles.liveRequest} aria-live="polite">
      <div className={styles.liveRequestTop}>
        <div><span>ВАШ ЗАПРОС</span><div className={styles.requestCount}>{catalog.isLoading?<strong className={styles.requestLoading}>Сверяем каталог…</strong>:<><strong>{eligible.length}</strong><span>{plural(eligible.length,["вариант подходит","варианта подходят","вариантов подходят"])}</span></>}</div></div>
        {!catalog.isLoading&&strongCount>0&&<div className={styles.liveBadge} aria-label={strongCount+" "+plural(strongCount,["сильное совпадение","сильных совпадения","сильных совпадений"])}><Check size={12}/>{strongCount+" "+plural(strongCount,["сильное","сильных","сильных"])}</div>}
      </div>
      <div className={styles.liveRequestChips}>
        <span>{city}</span>
        <span>{roomChoiceLabel(rooms)}</span>{district&&<span>{district}{!districtRequired?" · желательно":""}</span>}
        {housingClasses.map(value=><span key={value}>{value}</span>)}
        {(areaFrom!==null||areaTo!==null)&&<span>{areaFrom??0}–{areaTo??"∞"} м²</span>}
        {finishType&&<span>{apartmentFinishLabel(finishType)}</span>}
        <span>{financeLabel}</span>
        {delivery!=="Не важно"&&<span>{delivery==="Сдан"?"Сдан":delivery}</span>}
        {preferences.slice(0,2).map(id=><span key={id}>{preferenceLabel(id)}</span>)}
      </div>
      {catalog.isError&&!catalog.data?.length&&<LoadRecovery label="Обновить подбор" onRetry={()=>void catalog.refetch()}/>}
    </section>

    </section>

    <section className={styles.selectPanels}>
      <article className={openPanel==="essentials"?styles.selectPanelOpen:styles.selectPanel}>
        {panelHeader("essentials","Где и что","Город, комнатность, класс и площадь",<Building2 size={18}/>)}
        {openPanel==="essentials"&&<div className={styles.selectPanelBody}>
          <div className={styles.fieldBlock}>
            <label>Город</label>
            <NativeSelect aria-label="Город" value={city} onChange={e=>{setStarted(true);setCity(e.target.value);rememberCityInterest(e.target.value);setDistrict(null);safeHaptic();}}>{control.select.cities.map(value=><option key={value} value={value}>{value}</option>)}</NativeSelect>
          </div>
          <div className={styles.fieldBlock}>
            <label>Район</label>
            <NativeSelect aria-label="Район" value={district??""} onChange={e=>{setStarted(true);setDistrict(e.target.value||null)}}><option value="">Любой район</option>{district&&!districtOptions.includes(district)&&<option value={district}>{district}</option>}{districtOptions.map(value=><option key={value} value={value}>{value}</option>)}</NativeSelect>
            {district&&<NativeSelect aria-label="Важность района" value={districtRequired?'required':'preferred'} onChange={e=>setDistrictRequired(e.target.value==='required')}><option value="required">Обязательно этот район</option><option value="preferred">Желательно этот район</option></NativeSelect>}
          </div>
          <div className={styles.fieldBlock}>
            <label>Комнатность</label>
            <NativeSelect aria-label="Комнатность" value={rooms} onChange={e=>{setStarted(true);setRooms(e.target.value);safeHaptic();}}>{!roomOptions.includes(rooms)&&<option value={rooms}>{rooms}</option>}{roomOptions.map(value=><option key={value} value={value}>{value}</option>)}</NativeSelect>
          </div>
          <div className={styles.fieldBlock}>
            <label>Класс жилья</label>
            <NativeSelect aria-label="Класс жилья" value={housingClasses.length>1?'saved':housingClasses[0]??''} onChange={e=>{setStarted(true);setHousingClasses(e.target.value?[e.target.value]:[])}}><option value="">Любой класс</option>{housingClasses.length>1&&<option value="saved">{housingClasses.join(' / ')}</option>}{housingClasses.length===1&&!classOptions.includes(housingClasses[0])&&<option value={housingClasses[0]}>{housingClasses[0]}</option>}{classOptions.map(value=><option key={value} value={value}>{value}</option>)}</NativeSelect>
          </div>
          <div className={styles.fieldBlock}>
            <label>Площадь квартиры, м²</label>
            <div className={styles.areaInputs}>
              <Input aria-label="Площадь от" placeholder="От" type="number" inputMode="decimal" min={1} max={10000} step="0.1" value={areaFrom??""} onChange={e=>{setStarted(true);setAreaFrom(e.target.value?Number(e.target.value):null)}}/>
              <Input aria-label="Площадь до" placeholder="До" type="number" inputMode="decimal" min={1} max={10000} step="0.1" value={areaTo??""} onChange={e=>{setStarted(true);setAreaTo(e.target.value?Number(e.target.value):null)}}/>
            </div>
            {invalidArea&&<small role="status">Площадь «от» должна быть не больше площади «до».</small>}
          </div>
          <div className={styles.fieldBlock}>
            <label>Отделка</label>
            <NativeSelect aria-label="Отделка" value={finishType??""} onChange={e=>{setStarted(true);setFinishType(e.target.value as ApartmentFinish||null)}}><option value="">Не важно</option>{APARTMENT_FINISHES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</NativeSelect>
          </div>
        </div>}
      </article>

      <article className={openPanel==="finance"?styles.selectPanelOpen:styles.selectPanel}>
        {panelHeader("finance","Как покупаем","Бюджет или ипотечный сценарий",<WalletCards size={18}/>)}
        {openPanel==="finance"&&<div className={styles.selectPanelBody}>
          {control.select.mortgageEnabled&&<NativeSelect aria-label="Способ покупки" value={purchaseMode} onChange={e=>{setStarted(true);setPurchaseMode(e.target.value as PurchaseMode);safeHaptic();}}><option value="mortgage">Ипотека</option><option value="cash">По стоимости</option></NativeSelect>}

          {purchaseMode==="mortgage"?<>
            <div className={styles.fieldBlock}>
              <label>Сценарий для расчёта</label>
              <NativeSelect aria-label="Сценарий для расчёта" value={mortgageProgram} onChange={e=>{setStarted(true);setMortgageProgram(e.target.value as typeof mortgageProgram);safeHaptic();}}>{control.mortgagePrograms.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</NativeSelect>
            </div>

            <div className={styles.financeGrid}>
              <label className={styles.financeCard}>
                <span><Banknote size={15}/>Первоначальный взнос</span>
                <div><Input aria-label="Первоначальный взнос" inputMode="numeric" value={downDraft} onChange={e=>editMoney("down",e.target.value)} onBlur={()=>commitMoney("down")} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/><b>₽</b></div>
                <div className={styles.quickRow}>{[1_000_000,1_500_000,2_000_000,3_000_000].map(value=><button type="button" key={value} onClick={()=>{setStarted(true);setDownPayment(value);setDownDraft(formatRub(value));safeHaptic();}}>{shortRub(value)}</button>)}</div>
              </label>

              <label className={styles.financeCard}>
                <span><WalletCards size={15}/>Комфортный платёж</span>
                <div><Input aria-label="Комфортный платёж" inputMode="numeric" value={paymentDraft} onChange={e=>editMoney("payment",e.target.value)} onBlur={()=>commitMoney("payment")} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/><b>₽</b></div>
                <div className={styles.quickRow}>{[40_000,60_000,80_000,100_000].map(value=><button type="button" key={value} onClick={()=>{setStarted(true);setMonthlyPayment(value);setPaymentDraft(formatRub(value));safeHaptic();}}>{Math.round(value/1_000)} тыс.</button>)}</div>
              </label>
            </div>

            <div className={appliedMortgageScenario?styles.mortgageLinked:styles.mortgageLink}>
              <div>
                <span>{appliedMortgageScenario?<CircleCheck size={14}/>:<ShieldCheck size={14}/>}</span>
                <div><strong>{appliedMortgageScenario?"Сценарий ипотеки подключён":"Хотите учесть льготную ипотеку?"}</strong><small>{appliedMortgageScenario
                  ?"Учитываем параметры, которые вы выбрали в калькуляторе"
                  :"Рассчитайте ипотеку — учтём состав семьи, взнос и комфортный платёж при подборе."
                }</small></div>
              </div>
              <button type="button" onClick={()=>navigate("/mortgage?from=select&program="+encodeURIComponent(mortgageProgram))}>{appliedMortgageScenario?"Изменить":"Настроить"}</button>
            </div>
          </>:<>
            <div className={styles.moneyHero}><span>Ваш диапазон</span><strong>{shortRub(budget[0])} — {shortRub(budget[1])}</strong></div>
            <div className={styles.moneyInputs}>
              <label><span>От</span><div><Input inputMode="numeric" value={budgetDraft[0]} onChange={e=>editBudgetDraft(0,e.target.value)} onBlur={()=>commitBudgetDraft(0)} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/><b>₽</b></div></label>
              <label><span>До</span><div><Input inputMode="numeric" value={budgetDraft[1]} onChange={e=>editBudgetDraft(1,e.target.value)} onBlur={()=>commitBudgetDraft(1)} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/><b>₽</b></div></label>
            </div>
            <div className={styles.sliderWrap}>
              <Slider min={minPrice} max={Math.max(maxPrice,budget[1])} step={priceStep} value={budget} onValueChange={setBudgetFromSlider}/>
              <div className={styles.sliderBounds}><span>{shortRub(minPrice)}</span><span>{shortRub(maxPrice)}</span></div>
            </div>
          </>}
        </div>}
      </article>

      <article className={openPanel==="delivery"?styles.selectPanelOpen:styles.selectPanel}>
        {panelHeader("delivery","Когда нужны ключи","Срок сдачи — обязательное условие",<CalendarDays size={18}/>)}
        {openPanel==="delivery"&&<div className={styles.selectPanelBody}>
          <NativeSelect aria-label="Срок сдачи" value={delivery} onChange={e=>{setStarted(true);setDelivery(e.target.value);safeHaptic();}}>{!deliveryOptions.includes(delivery)&&<option value={delivery}>{delivery}</option>}{deliveryOptions.map(value=><option key={value} value={value}>{value}</option>)}</NativeSelect>
          <div className={styles.timelineNote}><CalendarDays size={16}/><span>Выбранный год ограничивает выдачу этим годом сдачи. «Сдан» — только введённые дома.</span></div>
        </div>}
      </article>

      <article className={openPanel==="preferences"?styles.selectPanelOpen:styles.selectPanel}>
        {panelHeader("preferences","Что для вас важно","До "+control.select.maxPreferences+" условий и пожеланий",<Sparkles size={18}/>)}
        {openPanel==="preferences"&&<div className={styles.selectPanelBody}>
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
          {preferences.map(id=><label key={id} className={styles.fieldBlock}><span>{preferenceLabel(id)}</span><NativeSelect aria-label={'Важность: '+preferenceLabel(id)} value={preferredPreferences.includes(id)?'preferred':'required'} onChange={e=>setPreferredPreferences(current=>e.target.value==='preferred'?[...new Set([...current,id])]:current.filter(value=>value!==id))}><option value="required">Обязательно</option><option value="preferred">Желательно</option></NativeSelect></label>)}
          <div className={styles.selectionCount}>{preferences.length}/{control.select.maxPreferences} выбрано</div>
        </div>}
      </article>
    </section>

    <button type="button" className={styles.selectPrimary} disabled={catalog.isLoading||properties.length===0||invalidArea} onClick={finish}>
      <span><strong>Показать подходящие</strong><small>{eligible.length?eligible.length+" "+plural(eligible.length,["вариант","варианта","вариантов"])+" сейчас":"Проверим выбранные условия"}</small></span>
      <ArrowRight size={18}/>
    </button>

  </div>;
}
