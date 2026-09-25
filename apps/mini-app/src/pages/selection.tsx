import React from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ChevronRight, ChevronLeft, ShieldCheck, Waves, Building2, CalendarDays, WalletCards } from "lucide-react";
import { Slider } from "../components/Slider";
import { Switch } from "../components/Switch";
import { Input } from "../components/Input";
import { PageHeader } from "../components/PageHeader";
import { usePriceBounds } from "../helpers/usePriceBounds";
import { useProperties } from "../helpers/useProperties";
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
  const [sea,setSea]=React.useState(false);
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

  const count=React.useMemo(()=>properties.filter(property=>{
    if(property.city!==city)return false;
    if(delivery!=="Любой"&&!property.delivery.includes(delivery))return false;
    const floorplanPrices=property.floorplans.map(x=>x.priceFrom).filter((x):x is number=>x!=null).map(x=>x*1_000_000);
    const priceMatch=floorplanPrices.length
      ?floorplanPrices.some(price=>price>=budget[0]&&price<=budget[1])
      :property.priceFrom*1_000_000<=budget[1];
    if(!priceMatch)return false;
    if(sea){
      const search=[...property.tags,...property.features.map(x=>x.label)].join(" ").toLowerCase();
      if(!search.includes("мор")&&!search.includes("панорам"))return false;
    }
    if(property.floorplans.length){
      const roomMatch=property.floorplans.some(plan=>{
        const label=plan.roomLabel.toLowerCase();
        if(rooms==="Студия")return label.includes("студ");
        if(rooms==="3+"){
          const n=Number(label.match(/\d+/)?.[0]||0);
          return n>=3;
        }
        return label.startsWith(rooms)||label.includes(rooms+"-");
      });
      if(!roomMatch)return false;
    }
    return true;
  }).length,[properties,city,delivery,budget,sea,rooms]);

  const next=()=>{
    if(last){
      const params=new URLSearchParams({
        city,
        min:(budget[0]/1_000_000).toFixed(1),
        max:(budget[1]/1_000_000).toFixed(1),
        rooms,
      });
      if(delivery!=="Любой")params.set("delivery",delivery);
      if(sea)params.set("sea","1");
      if(mortgage)params.set("mortgage","1");
      try{
        const history=JSON.parse(localStorage.getItem("pulse_selection_history")||"[]");
        const nextHistory=[{
          city,
          rooms,
          min:budget[0],
          max:budget[1],
          delivery,
          mortgage,
          sea,
          createdAt:Date.now(),
        },...(Array.isArray(history)?history:[])].slice(0,5);
        localStorage.setItem("pulse_selection_history",JSON.stringify(nextHistory));
      }catch{}
      navigate("/catalog?"+params.toString());
      return;
    }
    setStep(v=>Math.min(3,v+1));
  };

  return <div className={styles.page}>
    <PageHeader eyebrow="PULSE Select" title="Найдём ваш вариант" subtitle="Четыре коротких шага — без длинной анкеты и лишних полей."/>

    <div className={styles.progress} aria-label={"Шаг "+(step+1)+" из 4"}>
      {[0,1,2,3].map(i=><i key={i} className={i<=step?styles.progressActive:""}/>)}
    </div>

    <section className={styles.card}>
      {step===0&&<>
        <div className={styles.cardIcon}><Building2 size={20}/></div>
        <span className={styles.stepLabel}>Шаг 1 из 4</span>
        <h2>Где ищем квартиру?</h2>
        <p>Выберите город — остальные параметры настроим дальше.</p>
        <div className={styles.choiceGrid}>
          {["Владивосток","Уссурийск","Артём"].map(v=><button key={v} onClick={()=>setCity(v)} className={city===v?styles.active:""}>{v}</button>)}
        </div>
      </>}

      {step===1&&<>
        <div className={styles.cardIcon}><WalletCards size={20}/></div>
        <span className={styles.stepLabel}>Шаг 2 из 4</span>
        <h2>Комфортный бюджет</h2>
        <p>Диапазон автоматически построен по ценам квартир, которые сейчас загружены в PULSE.DV.</p>
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
        <p>Выберите вариант, который ближе всего к вашему сценарию.</p>
        <div className={styles.choiceGrid}>
          {["Студия","1","2","3+"].map(v=><button key={v} onClick={()=>setRooms(v)} className={rooms===v?styles.active:""}>{v}</button>)}
        </div>
      </>}

      {step===3&&<>
        <div className={styles.cardIcon}><CalendarDays size={20}/></div>
        <span className={styles.stepLabel}>Шаг 4 из 4</span>
        <h2>Последние детали</h2>
        <p>Срок сдачи и несколько предпочтений помогут точнее отобрать проекты.</p>
        <div className={styles.choiceGrid}>
          {["Любой","2026","2027"].map(v=><button onClick={()=>setDelivery(v)} key={v} className={delivery===v?styles.active:""}>{v}</button>)}
        </div>
        <div className={styles.switches}>
          <div className={styles.switchRow}><div><strong>Нужна ипотека</strong><span>Учтём это как параметр подбора</span></div><Switch checked={mortgage} onCheckedChange={setMortgage}/></div>
          <div className={styles.switchRow}><div><strong>Вид на море</strong><span>Добавим проекты с панорамами</span></div><Switch checked={sea} onCheckedChange={setSea}/></div>
        </div>
      </>}
    </section>

    <div className={styles.result}>
      <div><Sparkles size={18}/><span><strong>Подходит {count} {count===1?"проект":count>1&&count<5?"проекта":"проектов"}</strong><small>{city} · {rooms} комнаты</small></span></div>
      {sea?<Waves size={18}/>:<ChevronRight size={18}/>}
    </div>

    <div className={styles.actions}>
      {step>0&&<button className={styles.back} onClick={()=>setStep(v=>Math.max(0,v-1))}><ChevronLeft size={17}/>Назад</button>}
      <button className={styles.next} onClick={next}>{last?"Показать варианты":"Продолжить"}<ChevronRight size={18}/></button>
    </div>

    <div className={styles.note}><ShieldCheck size={15}/>Параметры можно изменить позже</div>
  </div>
}
