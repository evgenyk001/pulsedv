import React from "react";
import { AlertTriangle, BadgePercent, Calculator, ChevronRight, Info, Percent, ShieldCheck, WalletCards } from "lucide-react";
import { Slider } from "../components/Slider";
import { LeadSheet } from "../components/LeadSheet";
import { PageHeader } from "../components/PageHeader";
import { Input } from "../components/Input";
import styles from "./mortgage.module.css";

type ProgramId="family"|"farEast"|"it"|"standard";
type ProgramRule={
  id:ProgramId;
  label:string;
  rate:number;
  maxYears:number;
  minDownPct:number;
  loanLimit:number|null;
  hint:string;
};

const PROGRAMS:ProgramRule[]=[
  {id:"family",label:"Семейная",rate:6,maxYears:30,minDownPct:20.1,loanLimit:6_000_000,hint:"Базовый льготный лимит кредита — 6 млн ₽. Увеличенные лимиты банк проверяет отдельно."},
  {id:"farEast",label:"Дальневосточная",rate:2,maxYears:20,minDownPct:20.1,loanLimit:6_000_000,hint:"Базовый лимит — 6 млн ₽. До 9 млн ₽ возможно при выполнении условий программы, в том числе по площади объекта."},
  {id:"it",label:"IT",rate:6,maxYears:30,minDownPct:20.1,loanLimit:9_000_000,hint:"Предварительный сценарий. Соответствие требованиям IT-программы проверяется отдельно."},
  {id:"standard",label:"Базовая",rate:18,maxYears:30,minDownPct:20.1,loanLimit:null,hint:"Рыночный сценарий: ставку можно изменить вручную под предложение банка."},
];

const MONEY_STEP=100_000;
const PRICE_MIN=3_000_000;
const PRICE_MAX=40_000_000;
const formatRub=(value:number)=>new Intl.NumberFormat("ru-RU").format(Math.round(value));
const parseNumber=(value:string)=>Number(value.replace(/[^0-9.,]/g,"").replace(",","."));
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
const snap=(value:number,step:number)=>Math.round(value/step)*step;
const ceilStep=(value:number,step:number)=>Math.ceil(value/step)*step;

const annuity=(principal:number,annualRate:number,months:number)=>{
  if(principal<=0||months<=0)return 0;
  const monthlyRate=annualRate/100/12;
  if(monthlyRate===0)return principal/months;
  const factor=Math.pow(1+monthlyRate,months);
  return principal*(monthlyRate*factor)/(factor-1);
};

export default function MortgagePage(){
  const [program,setProgram]=React.useState<ProgramId>("family");
  const rule=PROGRAMS.find(item=>item.id===program)!;
  const [price,setPrice]=React.useState(9_000_000);
  const [down,setDown]=React.useState(3_000_000);
  const [years,setYears]=React.useState(25);
  const [rate,setRate]=React.useState(6);
  const [priceDraft,setPriceDraft]=React.useState(formatRub(9_000_000));
  const [downDraft,setDownDraft]=React.useState(formatRub(3_000_000));
  const [rateDraft,setRateDraft]=React.useState("6");

  const minDown=React.useMemo(()=>ceilStep(price*rule.minDownPct/100,MONEY_STEP),[price,rule.minDownPct]);
  const maxDown=Math.max(minDown,price-MONEY_STEP);
  const loan=Math.max(price-down,0);
  const withinProgram=rule.loanLimit===null||loan<=rule.loanLimit;
  const requiredDown=rule.loanLimit===null?minDown:Math.max(minDown,ceilStep(price-rule.loanLimit,MONEY_STEP));
  const months=years*12;
  const payment=withinProgram?annuity(loan,rate,months):0;
  const total=payment*months;
  const overpayment=Math.max(total-loan,0);
  const income=payment/.45;
  const downPercent=price?down/price*100:0;

  React.useEffect(()=>{
    if(years>rule.maxYears)setYears(rule.maxYears);
    if(down<minDown){
      setDown(minDown);
      setDownDraft(formatRub(minDown));
    }
  },[rule.maxYears,minDown,down,years]);

  const chooseProgram=(id:ProgramId)=>{
    const next=PROGRAMS.find(item=>item.id===id)!;
    setProgram(id);
    setRate(next.rate);
    setRateDraft(String(next.rate).replace(".",","));
    setYears(current=>Math.min(current,next.maxYears));
  };

  const updatePrice=(value:number)=>{
    const next=clamp(snap(value,MONEY_STEP),PRICE_MIN,PRICE_MAX);
    setPrice(next);
    setPriceDraft(formatRub(next));
  };

  const updateDown=(value:number)=>{
    const next=clamp(snap(value,MONEY_STEP),minDown,maxDown);
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
    const next=Number.isFinite(raw)?clamp(Math.round(raw*10)/10,.1,40):rate;
    setRate(next);
    setRateDraft(String(next).replace(".",","));
  };

  return <div className={styles.page}>
    <PageHeader eyebrow="Финансовый сценарий" title="Ипотека" subtitle="Понятный предварительный расчёт по правилам выбранной программы — без смешанных ставок." action={<div className={styles.headerIcon}><Calculator size={20}/></div>}/>

    <section className={styles.programSection}>
      <div className={styles.sectionLabel}><span>Программа</span><small>Срок и минимальный ПВ настроятся сами</small></div>
      <div className={styles.programs}>
        {PROGRAMS.map(item=><button key={item.id} className={program===item.id?styles.programActive:""} onClick={()=>chooseProgram(item.id)}>
          <span>{item.label}</span><b>от {item.rate}%</b>
        </button>)}
      </div>
      <div className={styles.ruleStrip}>
        <div><b>{rule.maxYears}</b><span>лет максимум</span></div>
        <div><b>{String(rule.minDownPct).replace(".",",")}%</b><span>ПВ от</span></div>
        <div><b>{rule.loanLimit?formatRub(rule.loanLimit)+" ₽":"—"}</b><span>{rule.loanLimit?"лимит кредита":"рыночная"}</span></div>
      </div>
      <div className={styles.ruleHint}><Info size={14}/><span>{rule.hint}</span></div>
    </section>

    <section className={styles.calc}>
      <div className={styles.field}>
        <div className={styles.label}><span>Стоимость квартиры</span><b>{formatRub(price)} ₽</b></div>
        <div className={styles.moneyInput}><Input inputMode="numeric" value={priceDraft} onChange={e=>setPriceDraft(e.target.value.replace(/[^0-9 ]/g,""))} onBlur={()=>commitMoney("price")} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/><span>₽</span></div>
        <Slider min={PRICE_MIN} max={PRICE_MAX} step={MONEY_STEP} value={[price]} onValueChange={values=>updatePrice(values[0]??price)}/>
      </div>

      <div className={styles.field}>
        <div className={styles.label}><span>Первоначальный взнос</span><b>{downPercent.toFixed(1).replace(".",",")}% · {formatRub(down)} ₽</b></div>
        <div className={styles.moneyInput}><Input inputMode="numeric" value={downDraft} onChange={e=>setDownDraft(e.target.value.replace(/[^0-9 ]/g,""))} onBlur={()=>commitMoney("down")} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/><span>₽</span></div>
        <Slider min={minDown} max={maxDown} step={MONEY_STEP} value={[clamp(down,minDown,maxDown)]} onValueChange={values=>updateDown(values[0]??down)}/>
        <div className={styles.fieldMeta}>Минимум по программе: {formatRub(minDown)} ₽</div>
      </div>

      <div className={styles.twoFields}>
        <div className={styles.field}>
          <div className={styles.label}><span>Срок</span><b>{years} лет</b></div>
          <Slider min={5} max={rule.maxYears} step={1} value={[years]} onValueChange={values=>setYears(Math.min(values[0]??years,rule.maxYears))}/>
        </div>
        <div className={styles.rateField}>
          <label>Ставка для расчёта</label>
          <div><Input inputMode="decimal" value={rateDraft} onChange={e=>setRateDraft(e.target.value)} onBlur={commitRate} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/><Percent size={15}/></div>
        </div>
      </div>
    </section>

    {!withinProgram&&<section className={styles.warning}>
      <AlertTriangle size={18}/>
      <div><strong>Для этой программы нужен больший первоначальный взнос</strong><span>Чтобы сумма кредита укладывалась в базовый лимит, увеличьте ПВ минимум до {formatRub(requiredDown)} ₽.</span></div>
    </section>}

    {withinProgram&&<section className={styles.result}>
      <div className={styles.resultTop}>
        <div className={styles.resultIcon}><WalletCards size={20}/></div>
        <div><span>Ориентировочный платёж</span><strong>{formatRub(payment)} ₽ / мес</strong></div>
        <BadgePercent size={20}/>
      </div>
      <div className={styles.resultGrid}>
        <div><span>Сумма кредита</span><b>{formatRub(loan)} ₽</b></div>
        <div><span>Переплата</span><b>{formatRub(overpayment)} ₽</b></div>
        <div><span>Всего выплат</span><b>{formatRub(total)} ₽</b></div>
        <div><span>Доход, ориентир</span><b>от {formatRub(income)} ₽</b></div>
      </div>
    </section>}

    <LeadSheet title="Проверить ипотечные программы" source="mortgage">
      <button className={styles.cta}>Получить точный расчёт <ChevronRight size={18}/></button>
    </LeadSheet>
    <div className={styles.note}><ShieldCheck size={15}/>Расчёт предварительный. Банк отдельно проверяет соответствие программе, объект, страховку и персональную ставку.</div>
  </div>
}