import React from "react";
import { useNavigate } from "react-router-dom";
import { Building2, CalendarDays, CarFront, Check, ChevronLeft, ChevronRight, MapPin, ShieldCheck, Sparkles, Trees, WalletCards, Waves } from "lucide-react";
import { Slider } from "../components/Slider";
import { Switch } from "../components/Switch";
import { Input } from "../components/Input";
import { PageHeader } from "../components/PageHeader";
import { usePriceBounds } from "../helpers/usePriceBounds";
import { useProperties } from "../helpers/useProperties";
import type { PropertyRecord } from "../helpers/propertyTypes";
import styles from "./selection.module.css";

const FALLBACK_MIN=4_000_000;
const FALLBACK_MAX=25_000_000;
const FALLBACK_STEP=100_000;

type Preference="sea"|"quiet"|"center"|"parking";

const formatRub=(value:number)=>new Intl.NumberFormat("ru-RU").format(Math.round(value));
const shortRub=(value:number)=>{
  const mln=value/1_000_000;
  return (Number.isInteger(mln)?mln.toFixed(0):mln.toFixed(1).replace(".",","))+" млн ₽";
};
const snap=(value:number,step:number)=>Math.round(value/step)*step;
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));

const roomMatches=(property:PropertyRecord,rooms:string)=>{
  if(rooms==="Любая")return true;
  if(!property.floorplans.length)return true;
  return property.floorplans.some(plan=>{
    const label=plan.roomLabel.toLowerCase();
    if(rooms==="Студия")return label.includes("студ");
    if(rooms==="3+"){
      const count=Number(label.match(/\d+/)?.[0]||0);
      return count>=3;
    }
    return label.startsWith(rooms)||label.includes(rooms+"-");
  });
};

const prices=(property:PropertyRecord)=>{
  const floorplanPrices=property.floorplans
    .map(item=>item.priceFrom)
    .filter((value):value is number=>value!==null)
    .map(value=>value*1_000_000);
  return floorplanPrices.length?floorplanPrices:[property.priceFrom*1_000_000];
};

const preferenceMatches=(property:PropertyRecord,preference:Preference)=>{
  const text=[property.district,...property.tags,...property.features.map(feature=>feature.label)].join(" ").toLowerCase();
  if(preference==="sea")return text.includes("мор")||text.includes("панорам");
  if(preference==="quiet")return text.includes("тиш")||text.includes("тих")||text.includes("спокой");
  if(preference==="center")return text.includes("центр")||text.includes("централь");
  return text.includes("парков")||text.includes("паркин");
};

export default function SelectionPage(){
  const navigate=useNavigate();
  const {data:bounds}=usePriceBounds();
  const {data:properties=[]}=useProperties();
  const minPrice=bounds?.minPriceRub??FALLBACK_MIN;
  const maxPrice=bounds?.maxPriceRub??FALLBACK_MAX;
  const priceStep=bounds?.stepRub??FALLBACK_STEP;

  const [step,setStep]=React.useState(0);
  const [city,setCity]=React.useState("Владивосток");
  const [rooms,setRooms]=React.useState("2");
  const [budget,setBudget]=React.useState<[number,number]>([FALLBACK_MIN,FALLBACK_MAX]);
  const [budgetDraft,setBudgetDraft]=React.useState<[string,string]>([formatRub(FALLBACK_MIN),formatRub(FALLBACK_MAX)]);
  const budgetInitialized=React.useRef(false);
  const [delivery,setDelivery]=React.useState("Любой");
  const [mortgage,setMortgage]=React.useState(true);
  const [preferences,setPreferences]=React.useState<Set<Preference>>(new Set());
  const last=step===3;

  React.useEffect(()=>{
    if(!bounds||budgetInitialized.current)return;
    const next:[number,number]=[bounds.minPriceRub,bounds.maxPriceRub];
    setBudget(next);
    setBudgetDraft([formatRub(next[0]),formatRub(next[1])]);
    budgetInitialized.current=true;
  },[bounds]);

  const setBudgetFromSlider=(values:number[])=>{
    const next:[number,number]=[values[0]??minPrice,values[1]??maxPrice];
    setBudget(next);
    setBudgetDraft([formatRub(next[0]),formatRub(next[1])]);
  };

  const editDraft=(index:0|1,value:string)=>{
    const clean=value.replace(/[^0-9]/g,"");
    setBudgetDraft(current=>{
      const next:[string,string]=[...current] as [string,string];
      next[index]=clean?formatRub(Number(clean)):"";
      return next;
    });
  };

  const commitDraft=(index:0|1)=>{
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

  const ranked=React.useMemo(()=>properties.map(property=>{
    let score=0;
    const reasons:string[]=[];
    if(city==="Любой"||property.city===city){score+=25;reasons.push(city==="Любой"?"география не ограничена":"подходит город")}
    if(roomMatches(property,rooms)){score+=20;reasons.push(rooms==="Любая"?"формат не ограничен":"есть нужная комнатность")}
    if(prices(property).some(price=>price>=budget[0]&&price<=budget[1])){score+=30;reasons.push("в вашем бюджете")}
    if(delivery==="Любой"||property.delivery.includes(delivery)){score+=10;reasons.push(delivery==="Любой"?"срок не ограничен":"подходит срок сдачи")}
    const activePreferences=[...preferences];
    if(activePreferences.length){
      const bonus=15/activePreferences.length;
      activePreferences.forEach(preference=>{
        if(preferenceMatches(property,preference)){
          score+=bonus;
          const labels:Record<Preference,string>={sea:"вид на море",quiet:"тихое окружение",center:"ближе к центру",parking:"парковка"};
          reasons.push(labels[preference]);
        }
      });
    }else{
      score+=15;
    }
    return {property,score:Math.round(Math.min(score,100)),reasons};
  }).sort((a,b)=>b.score-a.score),[properties,city,rooms,budget,delivery,preferences]);

  const top=ranked[0];
  const strongCount=ranked.filter(item=>item.score>=70).length;

  const togglePreference=(preference:Preference)=>{
    setPreferences(current=>{
      const next=new Set(current);
      next.has(preference)?next.delete(preference):next.add(preference);
      return next;
    });
  };

  const next=()=>{
    if(last){
      const params=new URLSearchParams({
        min:(budget[0]/1_000_000).toFixed(1),
        max:(budget[1]/1_000_000).toFixed(1),
        pulse:"1",
      });
      if(city!=="Любой")params.set("city",city);
      if(rooms!=="Любая")params.set("rooms",rooms);
      if(delivery!=="Любой")params.set("delivery",delivery);
      if(preferences.has("sea"))params.set("sea","1");
      if(preferences.size)params.set("priorities",[...preferences].join(","));
      if(mortgage)params.set("mortgage","1");
      try{
        const history=JSON.parse(localStorage.getItem("pulse_selection_history")||"[]");
        const nextHistory=[{
          city,rooms,min:budget[0],max:budget[1],delivery,mortgage,
          sea:preferences.has("sea"),
          createdAt:Date.now(),
        },...(Array.isArray(history)?history:[])].slice(0,5);
        localStorage.setItem("pulse_selection_history",JSON.stringify(nextHistory));
      }catch{}
      navigate("/catalog?"+params.toString());
      return;
    }
    setStep(value=>Math.min(3,value+1));
  };

  return <div className={styles.page}>
    <PageHeader eyebrow="PULSE Select" title="Найдём ваш вариант" subtitle="Четыре коротких шага. Без длинной анкеты — только параметры, которые реально помогают расставить проекты."/>

    <div className={styles.progress} aria-label={"Шаг "+(step+1)+" из 4"}>
      {[0,1,2,3].map(index=><i key={index} className={index<=step?styles.progressActive:""}/>)}
    </div>

    <section className={styles.card}>
      {step===0&&<>
        <div className={styles.cardIcon}><Building2 size={20}/></div>
        <span className={styles.stepLabel}>Шаг 1 из 4</span>
        <h2>Где ищем квартиру?</h2>
        <p>Можно выбрать конкретный город или не ограничивать географию.</p>
        <div className={styles.choiceGrid}>
          {["Владивосток","Уссурийск","Артём","Любой"].map(value=><button key={value} onClick={()=>setCity(value)} className={city===value?styles.active:""}>{value}</button>)}
        </div>
      </>}

      {step===1&&<>
        <div className={styles.cardIcon}><WalletCards size={20}/></div>
        <span className={styles.stepLabel}>Шаг 2 из 4</span>
        <h2>Комфортный бюджет</h2>
        <p>Задайте диапазон. Ползунок и ручной ввод работают с шагом 100 000 ₽.</p>
        <div className={styles.valueCard}><span>{shortRub(budget[0])} — {shortRub(budget[1])}</span><strong>шаг 100 000 ₽</strong></div>
        <div className={styles.budgetInputs}>
          <label><span>От</span><div><Input inputMode="numeric" value={budgetDraft[0]} onChange={event=>editDraft(0,event.target.value)} onBlur={()=>commitDraft(0)} onKeyDown={event=>{if(event.key==="Enter")event.currentTarget.blur()}}/><b>₽</b></div></label>
          <label><span>До</span><div><Input inputMode="numeric" value={budgetDraft[1]} onChange={event=>editDraft(1,event.target.value)} onBlur={()=>commitDraft(1)} onKeyDown={event=>{if(event.key==="Enter")event.currentTarget.blur()}}/><b>₽</b></div></label>
        </div>
        <div className={styles.sliderWrap}>
          <Slider min={minPrice} max={maxPrice} step={priceStep} value={budget} onValueChange={setBudgetFromSlider}/>
          <div className={styles.sliderBounds}><span>{shortRub(minPrice)}</span><span>{shortRub(maxPrice)}</span></div>
        </div>
      </>}

      {step===2&&<>
        <div className={styles.cardIcon}><Sparkles size={20}/></div>
        <span className={styles.stepLabel}>Шаг 3 из 4</span>
        <h2>Какой формат нужен?</h2>
        <p>Если комнатность пока не принципиальна — PULSE не будет отбрасывать проекты из-за неё.</p>
        <div className={styles.choiceGrid}>
          {["Студия","1","2","3+","Любая"].map(value=><button key={value} onClick={()=>setRooms(value)} className={rooms===value?styles.active:""}>{value}</button>)}
        </div>
      </>}

      {step===3&&<>
        <div className={styles.cardIcon}><CalendarDays size={20}/></div>
        <span className={styles.stepLabel}>Шаг 4 из 4</span>
        <h2>Что для вас важнее?</h2>
        <p>Это мягкие приоритеты. Они повышают подходящие проекты в выдаче, но не скрывают остальные.</p>
        <div className={styles.preferenceGrid}>
          <button onClick={()=>togglePreference("sea")} className={preferences.has("sea")?styles.preferenceActive:""}><Waves size={17}/><span>Вид на море</span>{preferences.has("sea")&&<Check size={15}/>}</button>
          <button onClick={()=>togglePreference("quiet")} className={preferences.has("quiet")?styles.preferenceActive:""}><Trees size={17}/><span>Тише вокруг</span>{preferences.has("quiet")&&<Check size={15}/>}</button>
          <button onClick={()=>togglePreference("center")} className={preferences.has("center")?styles.preferenceActive:""}><MapPin size={17}/><span>Ближе к центру</span>{preferences.has("center")&&<Check size={15}/>}</button>
          <button onClick={()=>togglePreference("parking")} className={preferences.has("parking")?styles.preferenceActive:""}><CarFront size={17}/><span>Парковка</span>{preferences.has("parking")&&<Check size={15}/>}</button>
        </div>
        <div className={styles.deliveryBlock}>
          <span>Срок сдачи</span>
          <div className={styles.deliveryChoices}>{["Любой","2026","2027"].map(value=><button onClick={()=>setDelivery(value)} key={value} className={delivery===value?styles.active:""}>{value}</button>)}</div>
        </div>
        <div className={styles.switchRow}><div><strong>Нужна ипотека</strong><span>Учтём это в следующем этапе консультации</span></div><Switch checked={mortgage} onCheckedChange={setMortgage}/></div>
      </>}
    </section>

    <div className={styles.result}>
      <div><Sparkles size={18}/><span><strong>{top?"Лучшее совпадение — "+top.score+"%":"Подбираем варианты"}</strong><small>{top?top.property.name+" · "+top.reasons.slice(0,2).join(" · "):"Меняйте параметры — результат обновится"}</small></span></div>
      <div className={styles.resultCount}>{strongCount}</div>
    </div>

    <div className={styles.actions}>
      {step>0&&<button className={styles.back} onClick={()=>setStep(value=>Math.max(0,value-1))}><ChevronLeft size={17}/>Назад</button>}
      <button className={styles.next} onClick={next}>{last?"Показать варианты":"Продолжить"}<ChevronRight size={18}/></button>
    </div>

    <div className={styles.note}><ShieldCheck size={15}/>PULSE Select объясняет совпадения и не скрывает варианты из-за мягких предпочтений</div>
  </div>
}