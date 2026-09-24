import React from "react";
import { Calculator, ChevronRight, Percent, ShieldCheck, WalletCards, BadgePercent } from "lucide-react";
import { Slider } from "../components/Slider";
import { LeadSheet } from "../components/LeadSheet";
import { PageHeader } from "../components/PageHeader";
import { Input } from "../components/Input";
import styles from "./mortgage.module.css";

type ProgramId="family"|"farEast"|"it"|"standard";
const PROGRAMS:{id:ProgramId;label:string;rate:number}[]=[
  {id:"family",label:"Семейная",rate:6},
  {id:"farEast",label:"Дальневосточная",rate:2},
  {id:"it",label:"IT",rate:6},
  {id:"standard",label:"Базовая",rate:18},
];

const MONEY_STEP=100_000;
const PRICE_MIN=3_000_000;
const PRICE_MAX=30_000_000;
const formatRub=(value:number)=>new Intl.NumberFormat("ru-RU").format(Math.round(value));
const parseNumber=(value:string)=>Number(value.replace(/[^0-9.,]/g,"").replace(",","."));
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
const snap=(value:number,step:number)=>Math.round(value/step)*step;

export default function MortgagePage(){
  const [program,setProgram]=React.useState<ProgramId>("family");
  const [price,setPrice]=React.useState(9_000_000);
  const [down,setDown]=React.useState(2_000_000);
  const [years,setYears]=React.useState(25);
  const [rate,setRate]=React.useState(6);
  const [priceDraft,setPriceDraft]=React.useState(formatRub(9_000_000));
  const [downDraft,setDownDraft]=React.useState(formatRub(2_000_000));
  const [rateDraft,setRateDraft]=React.useState("6");

  const loan=Math.max(price-down,0);
  const months=years*12;
  const monthlyRate=rate/100/12;
  const payment=loan<=0?0:monthlyRate===0?loan/months:loan*(monthlyRate*Math.pow(1+monthlyRate,months))/(Math.pow(1+monthlyRate,months)-1);
  const total=payment*months;
  const overpayment=Math.max(total-loan,0);
  const income=payment/.45;
  const downPercent=price?Math.round(down/price*100):0;

  const chooseProgram=(id:ProgramId)=>{
    const next=PROGRAMS.find(item=>item.id===id)!;
    setProgram(id);
    setRate(next.rate);
    setRateDraft(String(next.rate).replace(".",","));
  };

  const updatePrice=(value:number)=>{
    const next=clamp(snap(value,MONEY_STEP),PRICE_MIN,PRICE_MAX);
    setPrice(next);
    setPriceDraft(formatRub(next));
    if(down>=next){
      const nextDown=Math.max(MONEY_STEP,next-MONEY_STEP);
      setDown(nextDown);
      setDownDraft(formatRub(nextDown));
    }
  };

  const updateDown=(value:number)=>{
    const next=clamp(snap(value,MONEY_STEP),MONEY_STEP,Math.max(MONEY_STEP,price-MONEY_STEP));
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

  const commitRate=()=>{
    const raw=parseNumber(rateDraft);
    const next=Number.isFinite(raw)?clamp(Math.round(raw*10)/10,0.1,40):rate;
    setRate(next);
    setRateDraft(String(next).replace(".",","));
  };

  return <div className={styles.page}>
    <PageHeader eyebrow="Финансовый сценарий" title="Ипотека" subtitle="Соберите предварительный сценарий покупки и сразу увидьте ориентировочную нагрузку." action={<div className={styles.headerIcon}><Calculator size={20}/></div>}/>

    <section className={styles.programSection}>
      <div className={styles.sectionLabel}><span>Программа</span><small>Ставку можно изменить вручную</small></div>
      <div className={styles.programs}>
        {PROGRAMS.map(item=><button key={item.id} className={program===item.id?styles.programActive:""} onClick={()=>chooseProgram(item.id)}>
          <span>{item.label}</span><b>{item.rate}%</b>
        </button>)}
      </div>
    </section>

    <section className={styles.calc}>
      <div className={styles.field}>
        <div className={styles.label}><span>Стоимость квартиры</span><b>{formatRub(price)} ₽</b></div>
        <div className={styles.moneyInput}><Input inputMode="numeric" value={priceDraft} onChange={e=>setPriceDraft(e.target.value.replace(/[^0-9 ]/g,""))} onBlur={()=>commitMoney("price")} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/><span>₽</span></div>
        <Slider min={PRICE_MIN} max={PRICE_MAX} step={MONEY_STEP} value={[price]} onValueChange={values=>updatePrice(values[0]??price)}/>
      </div>

      <div className={styles.field}>
        <div className={styles.label}><span>Первоначальный взнос</span><b>{downPercent}% · {formatRub(down)} ₽</b></div>
        <div className={styles.moneyInput}><Input inputMode="numeric" value={downDraft} onChange={e=>setDownDraft(e.target.value.replace(/[^0-9 ]/g,""))} onBlur={()=>commitMoney("down")} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/><span>₽</span></div>
        <Slider min={MONEY_STEP} max={Math.max(MONEY_STEP,price-MONEY_STEP)} step={MONEY_STEP} value={[Math.min(down,Math.max(MONEY_STEP,price-MONEY_STEP))]} onValueChange={values=>updateDown(values[0]??down)}/>
      </div>

      <div className={styles.twoFields}>
        <div className={styles.field}>
          <div className={styles.label}><span>Срок</span><b>{years} лет</b></div>
          <Slider min={5} max={30} step={1} value={[years]} onValueChange={values=>setYears(values[0]??years)}/>
        </div>
        <div className={styles.rateField}>
          <label>Ставка для расчёта</label>
          <div><Input inputMode="decimal" value={rateDraft} onChange={e=>setRateDraft(e.target.value)} onBlur={commitRate} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/><Percent size={15}/></div>
        </div>
      </div>
    </section>

    <section className={styles.result}>
      <div className={styles.resultTop}>
        <div className={styles.resultIcon}><WalletCards size={20}/></div>
        <div><span>Примерный платёж</span><strong>{formatRub(payment)} ₽ / мес</strong></div>
        <BadgePercent size={20}/>
      </div>
      <div className={styles.resultGrid}>
        <div><span>Сумма кредита</span><b>{formatRub(loan)} ₽</b></div>
        <div><span>Переплата</span><b>{formatRub(overpayment)} ₽</b></div>
        <div><span>Всего выплат</span><b>{formatRub(total)} ₽</b></div>
        <div><span>Доход, ориентир</span><b>от {formatRub(income)} ₽</b></div>
      </div>
    </section>

    <LeadSheet title="Проверить ипотечные программы" source="mortgage">
      <button className={styles.cta}>Получить точный расчёт <ChevronRight size={18}/></button>
    </LeadSheet>
    <div className={styles.note}><ShieldCheck size={15}/>Расчёт предварительный. Лимиты и актуальные условия программы проверим перед сделкой.</div>
  </div>
}