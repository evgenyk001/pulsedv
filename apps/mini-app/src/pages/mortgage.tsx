import React from "react";
import { AlertTriangle, BadgePercent, Calculator, ChevronRight, Info, Percent, ShieldCheck, WalletCards } from "lucide-react";
import { Slider } from "../components/Slider";
import { Switch } from "../components/Switch";
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
  subsidizedLimit:number;
  totalLimit:number;
  blended:boolean;
  hint:string;
};

const PROGRAMS:ProgramRule[]=[
  {id:"family",label:"Семейная",rate:6,maxYears:30,minDownPct:20.1,subsidizedLimit:6_000_000,totalLimit:15_000_000,blended:true,hint:"Льготная часть — до 6 млн ₽. Увеличенный лимит может включать часть по рыночной ставке."},
  {id:"farEast",label:"Дальневосточная",rate:2,maxYears:20,minDownPct:20.1,subsidizedLimit:6_000_000,totalLimit:9_000_000,blended:false,hint:"До 6 млн ₽; до 9 млн ₽ — при выполнении условия по площади новостройки."},
  {id:"it",label:"IT",rate:6,maxYears:30,minDownPct:20.1,subsidizedLimit:9_000_000,totalLimit:18_000_000,blended:true,hint:"Базовый льготный лимит — 9 млн ₽, увеличенный — до 18 млн ₽."},
  {id:"standard",label:"Базовая",rate:18,maxYears:30,minDownPct:20.1,subsidizedLimit:100_000_000,totalLimit:100_000_000,blended:false,hint:"Рыночная программа. Ставка в расчёте редактируется вручную."},
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
  const [down,setDown]=React.useState(2_000_000);
  const [years,setYears]=React.useState(25);
  const [rate,setRate]=React.useState(6);
  const [marketRate,setMarketRate]=React.useState(18);
  const [largeArea,setLargeArea]=React.useState(false);
  const [priceDraft,setPriceDraft]=React.useState(formatRub(9_000_000));
  const [downDraft,setDownDraft]=React.useState(formatRub(2_000_000));
  const [rateDraft,setRateDraft]=React.useState("6");
  const [marketRateDraft,setMarketRateDraft]=React.useState("18");

  const minDown=React.useMemo(()=>ceilStep(price*rule.minDownPct/100,MONEY_STEP),[price,rule.minDownPct]);
  const maxDown=Math.max(minDown,price-MONEY_STEP);
  const effectiveSubsidizedLimit=program==="farEast"&&largeArea?9_000_000:rule.subsidizedLimit;
  const loan=Math.max(price-down,0);
  const months=years*12;
  const subsidizedPart=Math.min(loan,effectiveSubsidizedLimit);
  const excessPart=Math.max(loan-effectiveSubsidizedLimit,0);
  const subsidizedPayment=annuity(subsidizedPart,rate,months);
  const excessPayment=annuity(excessPart,marketRate,months);
  const payment=program==="standard"?annuity(loan,rate,months):subsidizedPayment+excessPayment;
  const total=payment*months;
  const overpayment=Math.max(total-loan,0);
  const income=payment/.45;
  const downPercent=price?down/price*100:0;
  const overProgramLimit=loan>rule.totalLimit;
  const belowMinDown=down<minDown;
  const hasMixedPart=program!=="standard"&&excessPart>0;

  React.useEffect(()=>{
    if(years>rule.maxYears)setYears(rule.maxYears);
    if(down<minDown){
      setDown(minDown);
      setDownDraft(formatRub(minDown));
    }
  },[rule.maxYears,minDown]);

  const chooseProgram=(id:ProgramId)=>{
    const next=PROGRAMS.find(item=>item.id===id)!;
    setProgram(id);
    setRate(next.rate);
    setRateDraft(String(next.rate).replace(".",","));
    setYears(current=>Math.min(current,next.maxYears));
    if(id!=="farEast")setLargeArea(false);
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

  const commitRate=(kind:"program"|"market")=>{
    const draft=kind==="program"?rateDraft:marketRateDraft;
    const current=kind==="program"?rate:marketRate;
    const raw=parseNumber(draft);
    const next=Number.isFinite(raw)?clamp(Math.round(raw*10)/10,.1,40):current;
    if(kind==="program"){
      setRate(next);
      setRateDraft(String(next).replace(".",","));
    }else{
      setMarketRate(next);
      setMarketRateDraft(String(next).replace(".",","));
    }
  };

  return <div className={styles.page}>
    <PageHeader eyebrow="Финансовый сценарий" title="Ипотека" subtitle="Предварительный расчёт с учётом срока, минимального взноса и лимита выбранной программы." action={<div className={styles.headerIcon}><Calculator size={20}/></div>}/>

    <section className={styles.programSection}>
      <div className={styles.sectionLabel}><span>Программа</span><small>Условия задаются автоматически</small></div>
      <div className={styles.programs}>
        {PROGRAMS.map(item=><button key={item.id} className={program===item.id?styles.programActive:""} onClick={()=>chooseProgram(item.id)}>
          <span>{item.label}</span><b>от {item.rate}%</b>
        </button>)}
      </div>
      <div className={styles.ruleStrip}>
        <span><b>{rule.maxYears}</b> лет максимум</span>
        <span><b>{rule.minDownPct}%</b> ПВ от</span>
        <span><b>{formatRub(effectiveSubsidizedLimit)}</b> ₽ льготный лимит</span>
      </div>
      <div className={styles.ruleHint}><Info size={14}/><span>{rule.hint}</span></div>
      {program==="farEast"&&<div className={styles.optionRow}>
        <div><strong>Площадь новостройки свыше 64 м²</strong><span>Тогда лимит кредита для расчёта повышается до 9 млн ₽</span></div>
        <Switch checked={largeArea} onCheckedChange={setLargeArea}/>
      </div>}
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
        <div className={styles.fieldMeta}>Минимум по выбранной программе: {formatRub(minDown)} ₽</div>
      </div>

      <div className={styles.twoFields}>
        <div className={styles.field}>
          <div className={styles.label}><span>Срок</span><b>{years} лет</b></div>
          <Slider min={5} max={rule.maxYears} step={1} value={[years]} onValueChange={values=>setYears(Math.min(values[0]??years,rule.maxYears))}/>
        </div>
        <div className={styles.rateField}>
          <label>Ставка программы</label>
          <div><Input inputMode="decimal" value={rateDraft} onChange={e=>setRateDraft(e.target.value)} onBlur={()=>commitRate("program")} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/><Percent size={15}/></div>
        </div>
      </div>

      {hasMixedPart&&<div className={styles.mixedRate}>
        <div><strong>Часть сверх льготного лимита</strong><span>{formatRub(excessPart)} ₽ считаем отдельно по ориентировочной рыночной ставке.</span></div>
        <div className={styles.rateField}><label>Ставка сверх лимита</label><div><Input inputMode="decimal" value={marketRateDraft} onChange={e=>setMarketRateDraft(e.target.value)} onBlur={()=>commitRate("market")} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/><Percent size={15}/></div></div>
      </div>}
    </section>

    {(overProgramLimit||belowMinDown||hasMixedPart)&&<section className={styles.warning+" "+(overProgramLimit?styles.warningStrong:"")}>
      <AlertTriangle size={18}/>
      <div>
        <strong>{overProgramLimit?"Сумма выходит за максимальный лимит программы":hasMixedPart?"Есть часть сверх льготного лимита":"Проверьте первоначальный взнос"}</strong>
        <span>{overProgramLimit
          ?("Кредит "+formatRub(loan)+" ₽ превышает ориентир "+formatRub(rule.totalLimit)+" ₽ для выбранной программы.")
          :hasMixedPart
            ?"Это смешанный ориентировочный расчёт, а не обещание банка выдать комбинированный кредит."
            :"Первоначальный взнос ниже минимального требования."}</span>
      </div>
    </section>}

    <section className={styles.result}>
      <div className={styles.resultTop}>
        <div className={styles.resultIcon}><WalletCards size={20}/></div>
        <div><span>Ориентировочный платёж</span><strong>{formatRub(payment)} ₽ / мес</strong></div>
        <BadgePercent size={20}/>
      </div>
      {hasMixedPart&&<div className={styles.splitResult}>
        <span>Льготная часть: {formatRub(subsidizedPart)} ₽ → {formatRub(subsidizedPayment)} ₽/мес</span>
        <span>Сверх лимита: {formatRub(excessPart)} ₽ → {formatRub(excessPayment)} ₽/мес</span>
      </div>}
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
    <div className={styles.note}><ShieldCheck size={15}/>Расчёт предварительный. Банк проверяет eligibility, объект, лимиты, страховки и персональную ставку отдельно.</div>
  </div>
}