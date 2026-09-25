import React from "react";
import { AlertTriangle, BadgePercent, Calculator, ChevronRight, Info, Percent, ShieldCheck, WalletCards } from "lucide-react";
import { Slider } from "../components/Slider";
import { Switch } from "../components/Switch";
import { LeadSheet } from "../components/LeadSheet";
import { PageHeader } from "../components/PageHeader";
import { Input } from "../components/Input";
import { usePulseControlState } from "../helpers/usePulseControlState";
import { recordPulseEvent, type MortgageProgramRule } from "../../../../packages/pulse-data";
import styles from "./mortgage.module.css";

type ProgramId=MortgageProgramRule["id"];
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
  const control=usePulseControlState();
  const programs=control.mortgagePrograms;
  const [program,setProgram]=React.useState<ProgramId>("family");
  const rule=programs.find(item=>item.id===program)??programs[0];
  const [price,setPrice]=React.useState(9_000_000);
  const [down,setDown]=React.useState(2_000_000);
  const [years,setYears]=React.useState(25);
  const [rate,setRate]=React.useState(rule?.rate??6);
  const [largeArea,setLargeArea]=React.useState(false);
  const [priceDraft,setPriceDraft]=React.useState(formatRub(9_000_000));
  const [downDraft,setDownDraft]=React.useState(formatRub(2_000_000));
  const [rateDraft,setRateDraft]=React.useState(String(rule?.rate??6).replace(".",","));

  if(!rule)return null;

  const minDown=ceilStep(price*rule.minDownPct/100,MONEY_STEP);
  const maxDown=Math.max(minDown,price-MONEY_STEP);
  const loan=Math.max(price-down,0);
  const effectiveLoanLimit=program==="farEast"&&largeArea?Math.max(rule.subsidizedLimit,9_000_000):rule.subsidizedLimit;
  const overProgramLimit=program!=="standard"&&loan>effectiveLoanLimit;
  const months=years*12;
  const payment=overProgramLimit?0:annuity(loan,rate,months);
  const total=payment*months;
  const overpayment=Math.max(total-loan,0);
  const income=payment/.45;
  const downPercent=price?down/price*100:0;
  const requiredDown=overProgramLimit?ceilStep(Math.max(minDown,price-effectiveLoanLimit),MONEY_STEP):minDown;

  React.useEffect(()=>{
    if(years>rule.maxYears)setYears(rule.maxYears);
    if(down<minDown){setDown(minDown);setDownDraft(formatRub(minDown))}
  },[rule.maxYears,minDown]);

  React.useEffect(()=>{
    setRate(rule.rate);
    setRateDraft(String(rule.rate).replace(".",","));
  },[rule.rate,rule.id]);

  const chooseProgram=(id:ProgramId)=>{
    const next=programs.find(item=>item.id===id);
    if(!next)return;
    setProgram(id);
    setRate(next.rate);
    setRateDraft(String(next.rate).replace(".",","));
    setYears(current=>Math.min(current,next.maxYears));
    if(id!=="farEast")setLargeArea(false);
    recordPulseEvent({eventType:"mortgage_program",entityType:"mortgage_program",entityId:id});
  };

  const updatePrice=(value:number)=>{
    const next=clamp(snap(value,MONEY_STEP),PRICE_MIN,PRICE_MAX);
    setPrice(next);setPriceDraft(formatRub(next));
  };
  const updateDown=(value:number)=>{
    const next=clamp(snap(value,MONEY_STEP),minDown,maxDown);
    setDown(next);setDownDraft(formatRub(next));
  };
  const commitMoney=(kind:"price"|"down")=>{
    const draft=kind==="price"?priceDraft:downDraft;
    const raw=parseNumber(draft);
    if(!Number.isFinite(raw)||raw<=0){kind==="price"?setPriceDraft(formatRub(price)):setDownDraft(formatRub(down));return}
    kind==="price"?updatePrice(raw):updateDown(raw);
  };
  const commitRate=()=>{
    const raw=parseNumber(rateDraft);
    const next=Number.isFinite(raw)?clamp(Math.round(raw*10)/10,.1,40):rate;
    setRate(next);setRateDraft(String(next).replace(".",","));
  };

  return <div className={styles.page}>
    <PageHeader eyebrow="Финансовый сценарий" title="Ипотека" subtitle="Предварительный расчёт по правилам, которыми управляет PULSE Control." action={<div className={styles.headerIcon}><Calculator size={20}/></div>}/>

    <section className={styles.programSection}>
      <div className={styles.sectionLabel}><span>Программа</span><small>Настройки приходят из PULSE Control</small></div>
      <div className={styles.programs}>
        {programs.map(item=><button type="button" key={item.id} className={program===item.id?styles.programActive:""} onClick={()=>chooseProgram(item.id)}>
          <span>{item.label}</span><b>от {item.rate}%</b>
        </button>)}
      </div>
      <div className={styles.ruleStrip}>
        <span><b>{rule.maxYears}</b> лет максимум</span>
        <span><b>{rule.minDownPct}%</b> ПВ от</span>
        <span><b>{formatRub(effectiveLoanLimit)}</b> ₽ лимит</span>
      </div>
      <div className={styles.ruleHint}><Info size={14}/><span>{rule.hint}</span></div>
      {program==="farEast"&&<div className={styles.optionRow}>
        <div><strong>Площадь новостройки свыше 64 м²</strong><span>Использовать повышенный лимит до 9 млн ₽</span></div>
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
          <div><Input inputMode="decimal" value={rateDraft} onChange={e=>setRateDraft(e.target.value)} onBlur={commitRate} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/><Percent size={15}/></div>
        </div>
      </div>
    </section>

    {overProgramLimit&&<section className={styles.warning+" "+styles.warningStrong}>
      <AlertTriangle size={18}/>
      <div><strong>Сумма кредита выше лимита программы</strong><span>Увеличьте первоначальный взнос минимум до {formatRub(requiredDown)} ₽ или выберите другой сценарий.</span></div>
    </section>}

    <section className={styles.result}>
      <div className={styles.resultTop}>
        <div className={styles.resultIcon}><WalletCards size={20}/></div>
        <div><span>Ориентировочный платёж</span><strong>{overProgramLimit?"—":formatRub(payment)+" ₽ / мес"}</strong></div>
        <BadgePercent size={20}/>
      </div>
      <div className={styles.resultGrid}>
        <div><span>Сумма кредита</span><b>{formatRub(loan)} ₽</b></div>
        <div><span>Переплата</span><b>{overProgramLimit?"—":formatRub(overpayment)+" ₽"}</b></div>
        <div><span>Всего выплат</span><b>{overProgramLimit?"—":formatRub(total)+" ₽"}</b></div>
        <div><span>Доход, ориентир</span><b>{overProgramLimit?"—":"от "+formatRub(income)+" ₽"}</b></div>
      </div>
    </section>

    <LeadSheet title="Проверить ипотечные программы" source="mortgage">
      <button className={styles.cta}>Получить точный расчёт <ChevronRight size={18}/></button>
    </LeadSheet>
    <div className={styles.note}><ShieldCheck size={15}/>Расчёт предварительный. Финальные условия подтверждает банк.</div>
  </div>;
}
