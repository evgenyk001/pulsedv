import { selectionMatch, preferenceLabel, type PreferenceId, type PurchaseMode } from "../../../../packages/domain/propertyMatch";
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
import { useProperties } from "../helpers/useProperties";
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

export default function SelectionPage(){
  const navigate=useNavigate();
  const control=usePulseControlState();
  const {data:bounds}=usePriceBounds();
  const {data:properties=[]}=useProperties();
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
  const [showAll,setShowAll]=React.useState(false);
  const [city,setCity]=React.useState(defaultCity);
  const [rooms,setRooms]=React.useState(defaultRooms);
  const [purchaseMode,setPurchaseMode]=React.useState<PurchaseMode>(saved.purchaseMode==="cash"?"cash":"mortgage");
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
  const [preferences,setPreferences]=React.useState<PreferenceId[]>(Array.isArray(saved.preferences)?saved.preferences.slice(0,3):[]);
  const last=step===3;

  React.useEffect(()=>{
    if(!control.select.cities.includes(city))setCity(control.select.cities[0]??"Владивосток");
    if(!control.select.roomOptions.includes(rooms))setRooms(control.select.roomOptions[0]??"1");
  },[control.select.cities,control.select.roomOptions,city,rooms]);

  React.useEffect(()=>{
    if(city!=="Владивосток"&&preferences.includes("sea"))setPreferences(current=>current.filter(id=>id!=="sea"));
  },[city,preferences]);

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

  const visiblePreferences=city==="Владивосток"
    ?preferenceOptions
    :preferenceOptions.filter(option=>option.id!=="sea");

  const togglePreference=(id:PreferenceId)=>{
    setPreferences(current=>{
      if(current.includes(id))return current.filter(item=>item!==id);
      if(current.length>=3)return current;
      return [...current,id];
    });
  };

  const criteria=React.useMemo(()=>({
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

  const ranked=React.useMemo(()=>properties
    .map(property=>({property,match:selectionMatch(property,criteria,control.mortgagePrograms,control.select.weights)}))
    .sort((a,b)=>Number(b.match.eligible)-Number(a.match.eligible)||b.match.score-a.match.score||a.property.sortOrder-b.property.sortOrder)
  ,[properties,criteria,control.mortgagePrograms]);

  const eligible=ranked.filter(item=>item.match.eligible);
  const strongCount=eligible.filter(item=>item.match.score>=85).length;
  const topScore=eligible[0]?.match.score??ranked[0]?.match.score??0;

  const persistSelection=()=>{
    const value:SavedSelection={city,rooms,delivery,purchaseMode,budget,downPayment,monthlyPayment,preferences};
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(value));}catch{}
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
        topScore,strongCount,
        source:"pulse-select-v2",
      }
    });
    setShowResult(true);
    setShowAll(false);
    window.scrollTo({top:0,behavior:"smooth"});
  };

  const next=()=>{
    if(last){finish();return;}
    setStep(value=>Math.min(3,value+1));
    window.scrollTo({top:0,behavior:"smooth"});
  };

  const reset=()=>{
    setShowResult(false);
    setShowAll(false);
    setStep(0);
    window.scrollTo({top:0,behavior:"smooth"});
  };

  if(showResult){
    const display=showAll?eligible:eligible.slice(0,3);
    return <div className={styles.page}>
      <section className={styles.resultHero}>
        <div className={styles.resultMark}><Sparkles size={20}/></div>
        <span className={styles.eyebrow}>PULSE SELECT</span>
        <h1>{eligible.length?"Подбор готов":"Почти нашли"}</h1>
        <p>{eligible.length
          ?<>Нашли <strong>{eligible.length}</strong> {plural(eligible.length,["подходящий вариант","подходящих варианта","подходящих вариантов"])} и расставили их по совпадению с вашими приоритетами.</>
          :<>С текущими условиями точных совпадений нет. Ниже — самые близкие варианты, чтобы было понятно, что стоит немного изменить.</>
        }</p>
        <div className={styles.summaryChips}>
          <span><Home size={13}/>{city}</span>
          <span>{rooms==="Студия"?"Студия":rooms+" комн."}</span>
          <span>{purchaseMode==="mortgage"?formatPayment(monthlyPayment):shortRub(budget[1])}</span>
          {delivery!=="Не важно"&&<span>{delivery==="Сдан"?"Сдан":"до "+delivery}</span>}
        </div>
      </section>

      <section className={styles.matchList}>
        {(eligible.length?display:ranked.slice(0,3)).map(({property,match},index)=>{
          const image=property.coverImageUrl||property.images[0]?.url;
          return <article className={styles.matchCard} key={property.id}>
            <div className={styles.matchMedia}>
              {image?<img src={image} alt={property.name}/>:<div className={styles.matchFallback}><Building2 size={28}/></div>}
              <span className={styles.matchRank}>#{index+1}</span>
              <span className={styles.matchScore}>{match.score}% совпадение</span>
            </div>
            <div className={styles.matchBody}>
              <div className={styles.matchTitle}>
                <div><strong>{property.name}</strong><span>{property.city} · {property.district}</span></div>
                <b>{match.price?("от "+shortRub(match.price)):"По запросу"}</b>
              </div>

              <div className={styles.reasonList}>
                {match.reasons.map(reason=><span key={reason}><Check size={12}/>{reason}</span>)}
              </div>

              {purchaseMode==="mortgage"&&match.mortgagePayment!==null&&<div className={styles.paymentHint}>
                <WalletCards size={15}/>
                <span><strong>≈ {formatPayment(match.mortgagePayment)}</strong><small>ориентир по программе «{match.mortgageProgram}», если она вам доступна</small></span>
              </div>}

              {match.tradeoffs.length>0&&<div className={styles.tradeoff}>
                <span>Что учесть</span>
                <p>{match.tradeoffs.join(" · ")}</p>
              </div>}

              <button type="button" className={styles.openProperty} onClick={()=>navigate("/property/"+property.id)}>
                Открыть ЖК <ArrowRight size={16}/>
              </button>
            </div>
          </article>
        })}
      </section>

      {eligible.length>3&&!showAll&&<button type="button" className={styles.moreButton} onClick={()=>setShowAll(true)}>
        Показать ещё {eligible.length-3} {plural(eligible.length-3,["вариант","варианта","вариантов"])}
      </button>}

      <div className={styles.resultActions}>
        <button type="button" className={styles.editButton} onClick={reset}><RotateCcw size={15}/>Изменить ответы</button>
        <button type="button" className={styles.catalogButton} onClick={()=>navigate("/catalog")}>Открыть каталог<ChevronRight size={16}/></button>
      </div>

      <div className={styles.disclaimer}><ShieldCheck size={14}/>Ипотечный платёж — ориентир. Точные условия зависят от программы и решения банка.</div>
    </div>;
  }

  return <div className={styles.page}>
    <header className={styles.hero}>
      <div className={styles.heroTop}><span className={styles.eyebrow}>PULSE SELECT</span><span>{step+1}/4</span></div>
      <h1>Подберём квартиру<br/>под вас</h1>
      <p>Четыре коротких шага. Без длинной анкеты и сотни фильтров.</p>
    </header>

    <div className={styles.progress} aria-label={"Шаг "+(step+1)+" из 4"}>
      {[0,1,2,3].map(i=><i key={i} className={i<=step?styles.progressActive:""}/>)}
    </div>

    <section className={styles.card}>
      {step===0&&<>
        <div className={styles.sectionHead}>
          <div className={styles.cardIcon}><Building2 size={19}/></div>
          <div><span className={styles.stepLabel}>ГЛАВНОЕ</span><h2>Где и что ищем?</h2><p>Два ответа — и мы сразу уберём заведомо неподходящие варианты.</p></div>
        </div>

        <div className={styles.fieldBlock}>
          <label>Город</label>
          <div className={styles.choiceGrid}>
            {control.select.cities.map(value=><button type="button" key={value} aria-pressed={city===value} onClick={()=>setCity(value)} className={city===value?styles.active:""}>{value}</button>)}
          </div>
        </div>

        <div className={styles.fieldBlock}>
          <label>Комнатность</label>
          <div className={styles.roomGrid}>
            {control.select.roomOptions.map(value=><button type="button" key={value} aria-pressed={rooms===value} onClick={()=>setRooms(value)} className={rooms===value?styles.active:""}>{value}</button>)}
          </div>
        </div>
      </>}

      {step===1&&<>
        <div className={styles.sectionHead}>
          <div className={styles.cardIcon}><WalletCards size={19}/></div>
          <div><span className={styles.stepLabel}>БЮДЖЕТ</span><h2>Как удобнее считать?</h2><p>Можно искать по полной стоимости или сразу по комфортному платежу.</p></div>
        </div>

        <SegmentedControl
          className={styles.purchaseTabs}
          value={purchaseMode}
          onChange={value=>setPurchaseMode(value as PurchaseMode)}
          ariaLabel="Способ покупки"
          options={[
            {value:"mortgage",label:"Ипотека"},
            {value:"cash",label:"По стоимости"},
          ]}
        />

        {purchaseMode==="cash"?<>
          <div className={styles.moneyHero}><span>Ваш диапазон</span><strong>{shortRub(budget[0])} — {shortRub(budget[1])}</strong></div>
          <div className={styles.moneyInputs}>
            <label><span>От</span><div><Input inputMode="numeric" value={budgetDraft[0]} onChange={e=>editBudgetDraft(0,e.target.value)} onBlur={()=>commitBudgetDraft(0)}/><b>₽</b></div></label>
            <label><span>До</span><div><Input inputMode="numeric" value={budgetDraft[1]} onChange={e=>editBudgetDraft(1,e.target.value)} onBlur={()=>commitBudgetDraft(1)}/><b>₽</b></div></label>
          </div>
          <div className={styles.sliderWrap}>
            <Slider min={minPrice} max={maxPrice} step={priceStep} value={budget} onValueChange={setBudgetFromSlider}/>
            <div className={styles.sliderBounds}><span>{shortRub(minPrice)}</span><span>{shortRub(maxPrice)}</span></div>
          </div>
        </>:<>
          <div className={styles.financeGrid}>
            <label className={styles.financeCard}>
              <span><Banknote size={15}/>Первоначальный взнос</span>
              <div><Input inputMode="numeric" value={downDraft} onChange={e=>editMoney("down",e.target.value)} onBlur={()=>commitMoney("down")}/><b>₽</b></div>
              <div className={styles.quickRow}>{[1_000_000,1_500_000,2_000_000,3_000_000].map(value=><button type="button" key={value} onClick={()=>{setDownPayment(value);setDownDraft(formatRub(value));}}>{shortRub(value)}</button>)}</div>
            </label>

            <label className={styles.financeCard}>
              <span><WalletCards size={15}/>Комфортный платёж</span>
              <div><Input inputMode="numeric" value={paymentDraft} onChange={e=>editMoney("payment",e.target.value)} onBlur={()=>commitMoney("payment")}/><b>₽</b></div>
              <div className={styles.quickRow}>{[40_000,60_000,80_000,100_000].map(value=><button type="button" key={value} onClick={()=>{setMonthlyPayment(value);setPaymentDraft(formatRub(value));}}>{Math.round(value/1_000)} тыс.</button>)}</div>
            </label>
          </div>
          <div className={styles.infoBox}><ShieldCheck size={15}/><span>Проверим, какие квартиры потенциально укладываются в платёж по доступным ипотечным программам. Одобрение банка считаем отдельно.</span></div>
        </>}
      </>}

      {step===2&&<>
        <div className={styles.sectionHead}>
          <div className={styles.cardIcon}><CalendarDays size={19}/></div>
          <div><span className={styles.stepLabel}>СРОК</span><h2>Когда нужны ключи?</h2><p>Срок — мягкий приоритет. Хороший вариант не исчезнет только из-за пары месяцев.</p></div>
        </div>

        <div className={styles.deliveryGrid}>
          {deliveryOptions.map(value=><button type="button" key={value} aria-pressed={delivery===value} onClick={()=>setDelivery(value)} className={delivery===value?styles.active:""}>
            {value==="Сдан"&&<Check size={14}/>}
            {value}
          </button>)}
        </div>

        <div className={styles.timelineNote}>
          <CalendarDays size={16}/>
          <span>Сроки формируются динамически из каталога. Если появятся проекты 2031+ — они добавятся автоматически.</span>
        </div>
      </>}

      {step===3&&<>
        <div className={styles.sectionHead}>
          <div className={styles.cardIcon}><Sparkles size={19}/></div>
          <div><span className={styles.stepLabel}>ПРИОРИТЕТЫ</span><h2>Что для вас важно?</h2><p>Выберите до трёх пунктов. Они влияют на порядок рекомендаций, но не отсекают хорошие квартиры жёстко.</p></div>
        </div>

        <div className={styles.preferenceGrid}>
          {visiblePreferences.map(option=>{
            const selected=preferences.includes(option.id);
            const disabled=!selected&&preferences.length>=3;
            return <button type="button" key={option.id} aria-pressed={selected} disabled={disabled} onClick={()=>togglePreference(option.id)} className={selected?styles.preferenceActive:""}>
              <span className={styles.preferenceIcon}>{selected?<Check size={16}/>:preferenceIcon(option.id)}</span>
              <span><strong>{option.label}</strong><small>{option.hint}</small></span>
            </button>
          })}
        </div>
        <div className={styles.selectionCount}>{preferences.length}/3 выбрано</div>
      </>}
    </section>

    <div className={styles.liveMatch}>
      <div><Sparkles size={17}/><span><strong>{eligible.length} {plural(eligible.length,["подходящий вариант","подходящих варианта","подходящих вариантов"])}</strong><small>{strongCount>0?strongCount+" с высоким совпадением":"Подбор обновляется сразу"}</small></span></div>
      <ChevronRight size={17}/>
    </div>

    <div className={styles.actions}>
      {step>0&&<button type="button" className={styles.back} onClick={()=>setStep(value=>Math.max(0,value-1))}><ChevronLeft size={17}/>Назад</button>}
      <button type="button" className={styles.next} onClick={next}>{last?"Показать подбор":"Продолжить"}<ChevronRight size={18}/></button>
    </div>

    <div className={styles.note}><ShieldCheck size={14}/>Ответы сохранятся — потом их можно изменить</div>
  </div>;
}
