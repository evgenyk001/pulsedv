import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  BadgePercent,
  Calculator,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Info,
  Landmark,
  Percent,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { Slider } from "../components/Slider";
import { Switch } from "../components/Switch";
import { LeadSheet } from "../components/LeadSheet";
import { PageHeader } from "../components/PageHeader";
import { Input } from "../components/Input";
import { usePulseControlState } from "../helpers/usePulseControlState";
import { recordPulseEvent, type MortgageProgramRule } from "../../../../packages/pulse-data";
import {
  calculateMortgageScenario,
  defaultMarketRate,
  FAMILY_SUBSIDY_YEARS,
  MORTGAGE_POLICY_VERSION,
  MORTGAGE_SCENARIO_KEY,
  readMortgageScenario,
  type FamilyChildren,
  type MortgagePropertyKind,
  type MortgageScenarioSettings,
} from "../../../../packages/domain/mortgagePolicy";
import styles from "./mortgage.module.css";

type ProgramId=MortgageProgramRule["id"];
type PropertyKind=MortgagePropertyKind;

const MONEY_STEP=100_000;
const PRICE_MIN=3_000_000;
const PRICE_MAX=45_000_000;
const RULES_UPDATED="02.10.2026";

const formatRub=(value:number)=>new Intl.NumberFormat("ru-RU").format(Math.round(value));
const formatRate=(value:number)=>String(Math.round(value*10)/10).replace(".",",")+"%";
const parseNumber=(value:string)=>Number(value.replace(/[^0-9.,]/g,"").replace(",","."));
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
const snap=(value:number,step:number)=>Math.round(value/step)*step;
const ceilStep=(value:number,step:number)=>Math.ceil(value/step)*step;

const propertyLabels:Record<PropertyKind,string>={
  newbuild:"Новостройка",
  secondary:"Вторичка",
  house:"Дом / ИЖС",
};

export default function MortgagePage(){
  const navigate=useNavigate();
  const [params]=useSearchParams();
  const requested=Number(params.get("price"));
  const initialPrice=Number.isFinite(requested)&&requested>0?clamp(requested,PRICE_MIN,PRICE_MAX):9_000_000;
  const control=usePulseControlState();
  const programs=control.mortgagePrograms;
  const storedScenario=React.useMemo(()=>readMortgageScenario(typeof localStorage==="undefined"?null:localStorage),[]);
  const requestedProgram=params.get("program");
  const initialProgram:ProgramId=programs.some(item=>item.id===requestedProgram)
    ?requestedProgram as ProgramId
    :storedScenario?.programId??"family";
  const initialKind:PropertyKind=params.get("from")==="select"?"newbuild":storedScenario?.propertyKind??"newbuild";
  const initialMarketRate=storedScenario?.propertyKind===initialKind&&storedScenario.marketRate
    ?storedScenario.marketRate
    :defaultMarketRate(programs,initialKind);

  const [program,setProgram]=React.useState<ProgramId>(initialProgram);
  const [propertyKind,setPropertyKind]=React.useState<PropertyKind>(initialKind);
  const [price,setPrice]=React.useState(initialPrice);
  const [down,setDown]=React.useState(2_000_000);
  const [years,setYears]=React.useState(storedScenario?.years??15);
  const [marketRate,setMarketRate]=React.useState(initialMarketRate);
  const [marketRateDraft,setMarketRateDraft]=React.useState(String(initialMarketRate).replace(".",","));
  const [childrenCount,setChildrenCount]=React.useState<FamilyChildren>(storedScenario?.childrenCount??1);
  const [hasYoungChild,setHasYoungChild]=React.useState(storedScenario?.hasYoungChild??true);
  const [disabledChild,setDisabledChild]=React.useState(storedScenario?.disabledChild??false);
  const [largeArea,setLargeArea]=React.useState(storedScenario?.largeArea??false);
  const [priceDraft,setPriceDraft]=React.useState(formatRub(initialPrice));
  const [downDraft,setDownDraft]=React.useState(formatRub(2_000_000));
  const [interacted,setInteracted]=React.useState(false);
  const lastCalculation=React.useRef("");
  const propertyKindMounted=React.useRef(false);

  const rule=programs.find(item=>item.id===program)??programs[0];
  if(!rule)return null;

  const settings:MortgageScenarioSettings={
    programId:program,
    propertyKind,
    childrenCount:program==="family"?childrenCount:undefined,
    hasYoungChild:program==="family"?hasYoungChild:undefined,
    disabledChild:program==="family"?disabledChild:undefined,
    largeArea:program==="farEast"?largeArea:undefined,
    marketRate,
    years,
  };

  const calculation=calculateMortgageScenario({programs,settings,price,down,years});
  if(!calculation)return null;

  const downPercent=price?down/price*100:0;
  const familyBase=FAMILY_SCALE[childrenCount];
  const preferredRate=calculation.preferredRate;
  const subsidizedLimit=calculation.subsidizedLimit;
  const totalLimit=calculation.totalLimit;
  const maxYears=calculation.maxYears;
  const minDown=calculation.minDown;
  const maxDown=Math.max(minDown,price-MONEY_STEP);
  const loan=calculation.loan;
  const subsidizedPrincipal=calculation.subsidizedPrincipal;
  const marketPrincipal=calculation.marketPrincipal;
  const preferredPayment=calculation.preferredPayment;
  const marketPayment=calculation.marketPayment;
  const payment=calculation.payment;
  const totalKnown=calculation.totalKnown;
  const overpayment=calculation.overpayment;
  const mixed=calculation.mixed;
  const requiredDown=calculation.requiredDown;
  const invalid=calculation.invalid;
  const income=payment/.45;

  const familyEligibilityBlocked=program==="family"&&!hasYoungChild&&!disabledChild;
  const objectBlocked=program==="it"&&propertyKind==="secondary";
  const limitExceeded=calculation.blockReason==="Сумма кредита выше доступного лимита";

  const cardRate=(id:ProgramId)=>{
    const item=programs.find(value=>value.id===id);
    if(id==="family")return program==="family"?formatRate(preferredRate):"2–10%";
    if(id==="standard")return "от "+formatRate(defaultMarketRate(programs,propertyKind));
    return "от "+formatRate(item?.rate??0);
  };

  const ruleCards=program==="family"
    ?[
      {main:formatRate(preferredRate),sub:"ставка сейчас"},
      {main:formatRub(subsidizedLimit)+" ₽",sub:"льготный лимит"},
      {main:FAMILY_SUBSIDY_YEARS+" лет",sub:"субсидирование"},
    ]
    :program==="farEast"
      ?[
        {main:formatRate(preferredRate),sub:"льготная ставка"},
        {main:formatRub(subsidizedLimit)+" ₽",sub:"макс. кредит"},
        {main:maxYears+" лет",sub:"макс. срок"},
      ]
      :program==="it"
        ?[
          {main:formatRate(preferredRate),sub:"льготная ставка"},
          {main:formatRub(subsidizedLimit)+" ₽",sub:"льготная часть"},
          {main:formatRub(totalLimit)+" ₽",sub:"с увеличением"},
        ]
        :[
          {main:formatRate(marketRate),sub:"ориентир ставки"},
          {main:String(rule.minDownPct).replace(".",",")+"%",sub:"взнос от"},
          {main:maxYears+" лет",sub:"макс. срок"},
        ];

  React.useEffect(()=>{
    if(years>maxYears)setYears(maxYears);
  },[maxYears,years]);

  React.useEffect(()=>{
    if(down<minDown){setDown(minDown);setDownDraft(formatRub(minDown))}
  },[minDown,down]);

  React.useEffect(()=>{
    if(!propertyKindMounted.current){
      propertyKindMounted.current=true;
      return;
    }
    const next=defaultMarketRate(programs,propertyKind);
    setMarketRate(next);
    setMarketRateDraft(String(next).replace(".",","));
    setLargeArea(false);
  },[propertyKind,programs]);

  React.useEffect(()=>{
    const shared:MortgageScenarioSettings={
      ...settings,
      updatedAt:new Date().toISOString(),
    };
    try{localStorage.setItem(MORTGAGE_SCENARIO_KEY,JSON.stringify(shared));}catch{}
  },[program,propertyKind,childrenCount,hasYoungChild,disabledChild,largeArea,marketRate,years]);

  React.useEffect(()=>{
    if(!interacted||invalid)return;
    const metadata={
      program,
      price,
      down,
      years,
      rate:preferredRate,
      payment:Math.round(payment),
      source:"mortgage-policy-"+MORTGAGE_POLICY_VERSION,
    };
    const key=JSON.stringify(metadata);
    if(lastCalculation.current===key)return;
    const timer=window.setTimeout(()=>{
      lastCalculation.current=key;
      recordPulseEvent({eventType:"mortgage_calculated",entityType:"mortgage",entityId:program,metadata});
    },800);
    return()=>window.clearTimeout(timer);
  },[interacted,invalid,program,price,down,years,preferredRate,payment]);

  const chooseProgram=(id:ProgramId)=>{
    setInteracted(true);
    const next=programs.find(item=>item.id===id);
    if(!next)return;
    setProgram(id);
    setYears(current=>Math.min(current,next.maxYears));
    if(id!=="farEast")setLargeArea(false);
    recordPulseEvent({eventType:"mortgage_program",entityType:"mortgage_program",entityId:id});
  };

  const updatePrice=(value:number)=>{
    setInteracted(true);
    const next=clamp(snap(value,MONEY_STEP),PRICE_MIN,PRICE_MAX);
    const nextMin=ceilStep(next*rule.minDownPct/100,MONEY_STEP);
    const nextDown=clamp(down,nextMin,next-MONEY_STEP);
    setDown(nextDown);
    setDownDraft(formatRub(nextDown));
    setPrice(next);
    setPriceDraft(formatRub(next));
  };

  const updateDown=(value:number)=>{
    setInteracted(true);
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

  const commitMarketRate=()=>{
    setInteracted(true);
    const raw=parseNumber(marketRateDraft);
    const next=Number.isFinite(raw)?clamp(Math.round(raw*10)/10,.1,40):marketRate;
    setMarketRate(next);
    setMarketRateDraft(String(next).replace(".",","));
  };

  const programHint=()=>{
    if(program==="family"){
      if(propertyKind==="house")return "Для строительства или завершения частного дома ставка — 6% независимо от числа детей. Базовое право на программу сохраняется.";
      if(disabledChild)return "Для семьи с ребёнком-инвалидом ставка не выше 6%. Возраст ребёнка — до 18 лет.";
      if(downPercent>=50)return "Первоначальный взнос 50% и более: ставка не выше 6%, но право на Семейную ипотеку всё равно должно быть.";
      return mixed
        ?"С 1 октября 2026 ставка и льготный лимит в Приморье зависят от количества детей. Часть сверх льготного лимита показана как комбо-сценарий и требует подтверждения банка."
        :"С 1 октября 2026 ставка и лимит в Приморье зависят от количества детей.";
    }
    if(program==="farEast")return "В Приморском крае — базовый лимит и повышенный лимит для подходящего объекта берутся из PULSE Control. Нужна льготная категория заёмщика.";
    if(program==="it")return "Льготная и максимальная части берутся из PULSE Control. Превышение льготного лимита считается по рыночной ставке.";
    return "Рыночная ставка — ориентир. Финальная ставка зависит от банка, взноса, страхования и профиля заёмщика.";
  };

  return <div className={styles.page}>
    <PageHeader
      eyebrow="Финансовый сценарий"
      title="Ипотека"
      subtitle="Расчёт по действующим правилам для Приморского края."
      action={<div className={styles.headerIcon}><Calculator size={20}/></div>}
    />

    <div className={styles.freshness}><CircleCheck size={14}/><span>Правила проверены {RULES_UPDATED} · движок {MORTGAGE_POLICY_VERSION}</span></div>

    <section className={styles.programSection}>
      <div className={styles.sectionLabel}><span>Программа</span><small>Приморский край</small></div>
      <div className={styles.programs}>
        {programs.map(item=><button
          type="button"
          key={item.id}
          className={program===item.id?styles.programActive:""}
          onClick={()=>chooseProgram(item.id)}
        >
          <span>{item.label}</span><b>{cardRate(item.id)}</b>
        </button>)}
      </div>

      <div className={styles.objectSwitch} aria-label="Тип недвижимости">
        {(Object.keys(propertyLabels) as PropertyKind[]).map(kind=><button
          type="button"
          key={kind}
          className={propertyKind===kind?styles.objectActive:""}
          onClick={()=>{setInteracted(true);setPropertyKind(kind)}}
        >{propertyLabels[kind]}</button>)}
      </div>

      {program==="family"&&<div className={styles.scenario}>
        <div className={styles.scenarioHead}>
          <div><strong>Сколько детей в семье?</strong><span>Для Приморья ставка зависит от их количества</span></div>
          <span className={styles.liveRate}>{formatRate(preferredRate)}</span>
        </div>
        <div className={styles.childGrid}>
          {([1,2,3,4,5] as FamilyChildren[]).map(count=><button
            type="button"
            key={count}
            className={childrenCount===count?styles.chipActive:styles.chip}
            onClick={()=>{setInteracted(true);setChildrenCount(count)}}
          >{count===5?"5+":count}</button>)}
        </div>
        <div className={styles.toggleRows}>
          <div className={styles.toggleRow}>
            <div><strong>Есть ребёнок младше 7 лет</strong><span>Базовое условие для новых договоров</span></div>
            <Switch checked={hasYoungChild} onCheckedChange={value=>{setInteracted(true);setHasYoungChild(value)}}/>
          </div>
          <div className={styles.toggleRow}>
            <div><strong>Есть ребёнок с инвалидностью до 18 лет</strong><span>Ставка не выше 6%</span></div>
            <Switch checked={disabledChild} onCheckedChange={value=>{setInteracted(true);setDisabledChild(value)}}/>
          </div>
        </div>
      </div>}

      {program==="farEast"&&propertyKind!=="house"&&<div className={styles.optionRow}>
        <div>
          <strong>{propertyKind==="newbuild"?"Площадь квартиры свыше 64 м²":"Площадь свыше 60 м² и подходящий моногород"}</strong>
          <span>При выполнении условия используется повышенный лимит из PULSE Control</span>
        </div>
        <Switch checked={largeArea} onCheckedChange={value=>{setInteracted(true);setLargeArea(value)}}/>
      </div>}

      <div className={styles.ruleStrip}>
        {ruleCards.map(item=><span key={item.sub}><b>{item.main}</b>{item.sub}</span>)}
      </div>
      <div className={styles.ruleHint}><Info size={14}/><span>{programHint()}</span></div>

      {propertyKind==="secondary"&&(program==="family"||program==="farEast")&&<div className={styles.contextWarning}>
        <Info size={15}/><span>Вторичка по этой программе доступна не везде. Перед подачей нужно проверить населённый пункт и сам объект по действующему перечню и условиям банка.</span>
      </div>}
    </section>

    <section className={styles.calc}>
      <div className={styles.field}>
        <div className={styles.label}><span>Стоимость недвижимости</span><b>{formatRub(price)} ₽</b></div>
        <div className={styles.moneyInput}>
          <Input inputMode="numeric" value={priceDraft} onChange={e=>setPriceDraft(e.target.value.replace(/[^0-9 ]/g,""))} onBlur={()=>commitMoney("price")} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/>
          <span>₽</span>
        </div>
        <Slider min={PRICE_MIN} max={PRICE_MAX} step={MONEY_STEP} value={[price]} onValueChange={values=>updatePrice(values[0]??price)}/>
      </div>

      <div className={styles.field}>
        <div className={styles.label}><span>Первоначальный взнос</span><b>{downPercent.toFixed(1).replace(".",",")}% · {formatRub(down)} ₽</b></div>
        <div className={styles.moneyInput}>
          <Input inputMode="numeric" value={downDraft} onChange={e=>setDownDraft(e.target.value.replace(/[^0-9 ]/g,""))} onBlur={()=>commitMoney("down")} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/>
          <span>₽</span>
        </div>
        <Slider min={minDown} max={maxDown} step={MONEY_STEP} value={[clamp(down,minDown,maxDown)]} onValueChange={values=>updateDown(values[0]??down)}/>
        <div className={styles.fieldMeta}>Минимум по настройкам программы: {String(rule.minDownPct).replace(".",",")}% · {formatRub(minDown)} ₽</div>
        {program==="family"&&downPercent>=50&&<div className={styles.inlineSuccess}><CircleCheck size={13}/>Взнос 50%+: для подходящей семьи ставка не выше 6%</div>}
      </div>

      <div className={styles.twoFields}>
        <div className={styles.field}>
          <div className={styles.label}><span>Срок</span><b>{years} лет</b></div>
          <Slider min={5} max={maxYears} step={1} value={[years]} onValueChange={values=>{setInteracted(true);setYears(Math.min(values[0]??years,maxYears))}}/>
        </div>
        <div className={styles.rateField}>
          <label>{program==="standard"?"Рыночная ставка":"Рыночная часть"}</label>
          <div>
            <Input inputMode="decimal" value={marketRateDraft} onChange={e=>setMarketRateDraft(e.target.value)} onBlur={commitMarketRate} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/>
            <Percent size={15}/>
          </div>
        </div>
      </div>

      {mixed&&<div className={styles.mixedRate}>
        <div><strong>Комбинированный расчёт</strong><span>{formatRub(subsidizedPrincipal)} ₽ под {formatRate(preferredRate)} + {formatRub(marketPrincipal)} ₽ под {formatRate(marketRate)}</span></div>
        <BadgePercent size={19}/>
      </div>}
    </section>

    {familyEligibilityBlocked&&<section className={styles.warning+" "+styles.warningStrong}>
      <AlertTriangle size={18}/><div><strong>Не подтверждено базовое право на Семейную ипотеку</strong><span>Для обычного сценария нужен ребёнок младше 7 лет. Отдельное основание — ребёнок с инвалидностью до 18 лет.</span></div>
    </section>}

    {objectBlocked&&<section className={styles.warning+" "+styles.warningStrong}>
      <AlertTriangle size={18}/><div><strong>Обычная вторичка не подходит под IT-ипотеку</strong><span>Программа рассчитана на первичное жильё от застройщика, дом от застройщика или строительство дома.</span></div>
    </section>}

    {limitExceeded&&<section className={styles.warning+" "+styles.warningStrong}>
      <AlertTriangle size={18}/><div><strong>Сумма кредита выше доступного лимита</strong><span>Увеличьте первоначальный взнос минимум до {formatRub(requiredDown)} ₽ или выберите другой сценарий.</span></div>
    </section>}

    {program==="family"&&years>FAMILY_SUBSIDY_YEARS&&<section className={styles.warning}>
      <Info size={18}/><div><strong>Льготная ставка действует первые {FAMILY_SUBSIDY_YEARS} лет</strong><span>После этого ставка определяется правилами программы. Поэтому будущую переплату PULSE не выдумывает.</span></div>
    </section>}

    <section className={styles.result}>
      <div className={styles.resultTop}>
        <div className={styles.resultIcon}><WalletCards size={20}/></div>
        <div><span>Ориентировочный платёж</span><strong>{invalid?"—":formatRub(payment)+" ₽ / мес"}</strong></div>
        <BadgePercent size={20}/>
      </div>
      {mixed&&!invalid&&<div className={styles.splitResult}>
        <span>Льготная часть: {formatRub(preferredPayment)} ₽/мес</span>
        <span>Рыночная часть: {formatRub(marketPayment)} ₽/мес</span>
      </div>}
      <div className={styles.resultGrid}>
        <div><span>Сумма кредита</span><b>{formatRub(loan)} ₽</b></div>
        <div><span>Льготная часть</span><b>{program==="standard"?"—":formatRub(subsidizedPrincipal)+" ₽"}</b></div>
        <div><span>Переплата</span><b>{invalid||!totalKnown?"—":formatRub(overpayment)+" ₽"}</b></div>
        <div><span>Доход, ориентир</span><b>{invalid?"—":"от "+formatRub(income)+" ₽"}</b></div>
      </div>
      <div className={styles.incomeNote}>Ориентир дохода рассчитан при условной долговой нагрузке 45%. Банк считает платёжеспособность индивидуально.</div>
    </section>

    {params.get("from")==="select"&&<button type="button" className={styles.returnSelect} onClick={()=>navigate("/selection")}>
      <ChevronLeft size={17}/> Использовать этот сценарий в PULSE Select
    </button>}

    <details className={styles.details} open={program==="family"}>
      <summary><span>Условия выбранной программы</span><ChevronRight size={16}/></summary>
      <div className={styles.detailsBody}>
        {program==="family"&&<>
          <p><b>Новые договоры с 1 октября 2026.</b> В Приморье: 1 ребёнок — 10% / до 6 млн ₽; 2 — 8% / до 8 млн ₽; 3 — 6% / до 10 млн ₽; 4 — 4% / до 10 млн ₽; 5+ — 2% / до 10 млн ₽.</p>
          <p>Хотя бы один ребёнок должен быть младше 7 лет. Для ребёнка с инвалидностью до 18 лет сохраняется ставка не выше 6%.</p>
          <p>При первоначальном взносе 50% и более ставка для подходящей семьи — не выше 6%. На строительство частного дома — 6% независимо от числа детей.</p>
          <p>Субсидирование — максимум 15 лет. Кредит может быть длиннее, но ставка после льготного периода меняется по правилам программы.</p>
          <p>Если сумма кредита выше льготного лимита, PULSE показывает комбо-сценарий в пределах максимального лимита программы из PULSE Control. Доступность увеличенного лимита и его тариф подтверждает банк.</p>
          <p>Для вторичного жилья действует отдельный перечень населённых пунктов и требования к дому — поэтому объект нужно проверять отдельно.</p>
        </>}
        {program==="farEast"&&<>
          <p><b>Дальневосточная ипотека.</b> Ставка и лимиты приходят из PULSE Control; в Mini App дополнительно учитывается повышенный лимит подходящего объекта.</p>
          <p>Доступность зависит от категории заёмщика, территории и самого объекта. Банк подтверждает право на программу.</p>
        </>}
        {program==="it"&&<>
          <p><b>IT-ипотека.</b> Льготная ставка, льготный лимит и общий лимит приходят из PULSE Control. Часть сверх льготного лимита считается по рыночной ставке.</p>
          <p>Обычная вторичная квартира не является стандартным объектом IT-ипотеки.</p>
        </>}
        {program==="standard"&&<>
          <p><b>Рыночный сценарий.</b> Для расчёта подставляется текущий ориентир по типу недвижимости. Ставку можно изменить вручную.</p>
        </>}
      </div>
    </details>

    <details className={styles.details}>
      <summary><span>Другие ипотечные сценарии</span><ChevronRight size={16}/></summary>
      <div className={styles.otherPrograms}>
        <div className={styles.otherProgram}><div><Landmark size={16}/><strong>Военная ипотека</strong></div><span className={styles.statusActive}>действует</span><p>Для участников НИС. Финальные условия зависят от банка и статуса участника.</p></div>
        <div className={styles.otherProgram}><div><Landmark size={16}/><strong>Сельская ипотека</strong></div><span className={styles.statusPaused}>приём закрыт</span><p>Не показываем её как доступную программу в основном калькуляторе, пока приём заявок закрыт.</p></div>
        <div className={styles.otherProgram}><div><Landmark size={16}/><strong>Материнский капитал</strong></div><span className={styles.statusInfo}>поддержка</span><p>Это не отдельная процентная программа: средства можно учитывать в первоначальном взносе, если сделка и банк это допускают.</p></div>
      </div>
    </details>

    <LeadSheet
      title="Проверить ипотечные программы"
      source="mortgage"
      propertyId={params.get("property")||undefined}
      context={{program,propertyKind,price,down,years,preferredRate,marketRate,payment,subsidizedLimit,marketPrincipal,policyVersion:MORTGAGE_POLICY_VERSION}}
    >
      <button className={styles.cta}>Получить точный расчёт <ChevronRight size={18}/></button>
    </LeadSheet>

    <div className={styles.note}><ShieldCheck size={15}/>Расчёт предварительный. Финальные условия, право на льготу и объект подтверждает банк.</div>
  </div>;
}
