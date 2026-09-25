import React from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ChevronRight, ChevronLeft, ShieldCheck, Waves, Building2, CalendarDays, WalletCards } from "lucide-react";
import { Slider } from "../components/Slider";
import { Switch } from "../components/Switch";
import { Input } from "../components/Input";
import { PageHeader } from "../components/PageHeader";
import { SegmentedControl } from "../components/SegmentedControl";
import { usePriceBounds } from "../helpers/usePriceBounds";
import { useProperties } from "../helpers/useProperties";
import { usePulseControlState } from "../helpers/usePulseControlState";
import { recordPulseEvent } from "../../../../packages/pulse-data";
import styles from "./selection.module.css";

const FALLBACK_MIN=4_000_000;
const FALLBACK_MAX=25_000_000;
const FALLBACK_STEP=100_000;

const formatRub=(value:number)=>new Intl.NumberFormat("ru-RU").format(Math.round(value));
const shortRub=(value:number)=>{
  const mln=value/1_000_000;
  return (Number.isInteger(mln)?mln.toFixed(0):mln.toFixed(1).replace(".",","))+" млн ₽";
};
const snap=(value:number,step:number)=>Math.round(value/step)*step;
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));

export default function SelectionPage(){
  const navigate=useNavigate();
  const control=usePulseControlState();
  const {data:bounds}=usePriceBounds();
  const {data:properties=[]}=useProperties();
  const minPrice=bounds?.minPriceRub??FALLBACK_MIN;
  const maxPrice=bounds?.maxPriceRub??FALLBACK_MAX;
  const priceStep=bounds?.stepRub??FALLBACK_STEP;

  const [step,setStep]=React.useState(0);
  const [city,setCity]=React.useState(control.select.cities[0]??"Владивосток");
  const [rooms,setRooms]=React.useState(control.select.roomOptions.includes("2")?"2":control.select.roomOptions[0]??"1");
  const [budget,setBudget]=React.useState<[number,number]>([FALLBACK_MIN,FALLBACK_MAX]);
  const [budgetDraft,setBudgetDraft]=React.useState<[string,string]>([formatRub(FALLBACK_MIN),formatRub(FALLBACK_MAX)]);
  const budgetInitialized=React.useRef(false);
  const [delivery,setDelivery]=React.useState(control.select.deliveryOptions[0]??"Любой");
  const [mortgage,setMortgage]=React.useState(true);
  const [sea,setSea]=React.useState(false);
  const last=step===3;

  React.useEffect(()=>{
    if(!control.select.cities.includes(city))setCity(control.select.cities[0]??"Владивосток");
    if(!control.select.roomOptions.includes(rooms))setRooms(control.select.roomOptions[0]??"1");
    if(!control.select.deliveryOptions.includes(delivery))setDelivery(control.select.deliveryOptions[0]??"Любой");
  },[control.select.cities,control.select.roomOptions,control.select.deliveryOptions,city,rooms,delivery]);

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
    setBudgetDraft(prev=>{
      const next:[string,string]=[...prev] as [string,string];
      next[index]=clean?new Intl.NumberFormat("ru-RU").format(Number(clean)):"";
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

  const ranked=React.useMemo(()=>{
    const weights=control.select.weights;
    const maxScore=weights.city+weights.budget+weights.rooms+weights.delivery+weights.preferences;
    return properties.map(property=>{
      let score=0;
      if(property.city===city)score+=weights.city;

      const prices=property.floorplans.map(x=>x.priceFrom).filter((x):x is number=>x!=null).map(x=>x*1_000_000);
      const priceMatch=prices.length?prices.some(price=>price>=budget[0]&&price<=budget[1]):property.priceFrom*1_000_000<=budget[1];
      if(priceMatch)score+=weights.budget;

      const roomMatch=!property.floorplans.length||property.floorplans.some(plan=>{
        const label=plan.roomLabel.toLowerCase();
        if(rooms==="Студия")return label.includes("студ");
        if(rooms==="3+")return Number(label.match(/\d+/)?.[0]||0)>=3;
        return label.startsWith(rooms)||label.includes(rooms+"-");
      });
      if(roomMatch)score+=weights.rooms;

      if(delivery==="Любой"||property.delivery.includes(delivery))score+=weights.delivery;

      const haystack=[...property.tags,...property.features.map(x=>x.label)].join(" ").toLowerCase();
      const seaMatch=!sea||haystack.includes("мор")||haystack.includes("панорам");
      if(seaMatch)score+=weights.preferences;

      return {property,score:Math.round(score/Math.max(1,maxScore)*100)};
    }).sort((a,b)=>b.score-a.score);
  },[properties,city,budget,rooms,delivery,sea,control.select.weights]);

  const strongCount=ranked.filter(item=>item.score>=70).length;
  const topScore=ranked[0]?.score??0;

  const next=()=>{
    if(last){
      const params=new URLSearchParams({city,min:(budget[0]/1_000_000).toFixed(1),max:(budget[1]/1_000_000).toFixed(1),rooms,pulse:"1"});
      if(delivery!=="Любой")params.set("delivery",delivery);
      if(sea)params.set("sea","1");
      if(mortgage)params.set("mortgage","1");
      try{
        const history=JSON.parse(localStorage.getItem("pulse_selection_history")||"[]");
        const nextHistory=[{city,rooms,min:budget[0],max:budget[1],delivery,mortgage,sea,score:topScore,createdAt:Date.now()},...(Array.isArray(history)?history:[])].slice(0,5);
        localStorage.setItem("pulse_selection_history",JSON.stringify(nextHistory));
      }catch{}
      recordPulseEvent({eventType:"select_submit",entityType:"selection",metadata:{city,rooms,min:budget[0],max:budget[1],delivery,mortgage,sea,topScore,strongCount}});
      navigate("/catalog?"+params.toString());
      return;
    }
    setStep(v=>Math.min(3,v+1));
  };

  return <div className={styles.page}>
    <PageHeader eyebrow="PULSE Select" title="Найдём ваш вариант" subtitle="Четыре коротких шага — параметры и веса управляются из PULSE Control."/>

    <div className={styles.progress} aria-label={"Шаг "+(step+1)+" из 4"}>
      {[0,1,2,3].map(i=><i key={i} className={i<=step?styles.progressActive:""}/>)}
    </div>

    <section className={styles.card}>
      {step===0&&<>
        <div className={styles.cardIcon}><Building2 size={20}/></div>
        <span className={styles.stepLabel}>Шаг 1 из 4</span>
        <h2>Где ищем квартиру?</h2>
        <p>Выберите город — список приходит из PULSE Control.</p>
        <div className={styles.choiceGrid}>
          {control.select.cities.map(v=><button type="button" key={v} onClick={()=>setCity(v)} className={city===v?styles.active:""}>{v}</button>)}
        </div>
      </>}

      {step===1&&<>
        <div className={styles.cardIcon}><WalletCards size={20}/></div>
        <span className={styles.stepLabel}>Шаг 2 из 4</span>
        <h2>Комфортный бюджет</h2>
        <p>Диапазон построен по опубликованным квартирам в едином каталоге.</p>
        <div className={styles.valueCard}><span>{shortRub(budget[0])} — {shortRub(budget[1])}</span><strong>шаг 100 000 ₽</strong></div>
        <div className={styles.budgetInputs}>
          <label><span>От</span><div><Input inputMode="numeric" value={budgetDraft[0]} onChange={e=>editDraft(0,e.target.value)} onBlur={()=>commitDraft(0)} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/><b>₽</b></div></label>
          <label><span>До</span><div><Input inputMode="numeric" value={budgetDraft[1]} onChange={e=>editDraft(1,e.target.value)} onBlur={()=>commitDraft(1)} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/><b>₽</b></div></label>
        </div>
        <div className={styles.sliderWrap}>
          <Slider min={minPrice} max={maxPrice} step={priceStep} value={budget} onValueChange={setBudgetFromSlider}/>
          <div className={styles.sliderBounds}><span>{shortRub(minPrice)}</span><span>{shortRub(maxPrice)}</span></div>
        </div>
      </>}

      {step===2&&<>
        <div className={styles.cardIcon}><Sparkles size={20}/></div>
        <span className={styles.stepLabel}>Шаг 3 из 4</span>
        <h2>Сколько комнат?</h2>
        <p>Варианты также настраиваются в PULSE Control.</p>
        <div className={styles.choiceGrid}>
          {control.select.roomOptions.map(v=><button type="button" key={v} onClick={()=>setRooms(v)} className={rooms===v?styles.active:""}>{v}</button>)}
        </div>
      </>}

      {step===3&&<>
        <div className={styles.cardIcon}><CalendarDays size={20}/></div>
        <span className={styles.stepLabel}>Шаг 4 из 4</span>
        <h2>Последние детали</h2>
        <p>Мягкие приоритеты помогают ранжировать проекты, а не жёстко отбрасывать всё подряд.</p>
        <SegmentedControl className={styles.deliveryTabs} value={delivery} onChange={setDelivery} ariaLabel="Срок сдачи"
          options={control.select.deliveryOptions.map(value=>({value,label:value}))}/>
        <div className={styles.switches}>
          {control.select.mortgageEnabled&&<div className={styles.switchRow}><div><strong>Нужна ипотека</strong><span>Учтём это как параметр подбора</span></div><Switch checked={mortgage} onCheckedChange={setMortgage}/></div>}
          {control.select.seaEnabled&&<div className={styles.switchRow}><div><strong>Вид на море</strong><span>Добавим преимущество проектам с панорамами</span></div><Switch checked={sea} onCheckedChange={setSea}/></div>}
        </div>
      </>}
    </section>

    <div className={styles.result}>
      <div><Sparkles size={18}/><span><strong>{strongCount} {strongCount===1?"сильное совпадение":"сильных совпадений"}</strong><small>Лучший результат · {topScore}%</small></span></div>
      {sea?<Waves size={18}/>:<ChevronRight size={18}/>}
    </div>

    <div className={styles.actions}>
      {step>0&&<button type="button" className={styles.back} onClick={()=>setStep(v=>Math.max(0,v-1))}><ChevronLeft size={17}/>Назад</button>}
      <button type="button" className={styles.next} onClick={next}>{last?"Показать варианты":"Продолжить"}<ChevronRight size={18}/></button>
    </div>

    <div className={styles.note}><ShieldCheck size={15}/>Параметры можно изменить позже</div>
  </div>;
}
