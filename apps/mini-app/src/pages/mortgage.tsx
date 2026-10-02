import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  BadgePercent,
  Calculator,
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
import styles from "./mortgage.module.css";

type ProgramId=MortgageProgramRule["id"];
type PropertyKind="newbuild"|"secondary"|"house";
type FamilyChildren=1|2|3|4|5;

const MONEY_STEP=100_000;
const PRICE_MIN=3_000_000;
const PRICE_MAX=45_000_000;
const DOMCLICK_MIN_DOWN=20.1;
const FAMILY_SUBSIDY_YEARS=15;
const FAMILY_COMBINED_MAX=15_000_000;
const IT_SUBSIDIZED_LIMIT=9_000_000;
const IT_COMBINED_MAX=18_000_000;
const RULES_UPDATED="02.10.2026";

const FAMILY_SCALE:Record<FamilyChildren,{rate:number;limit:number;label:string}>={
  1:{rate:10,limit:6_000_000,label:"1"},
  2:{rate:8,limit:8_000_000,label:"2"},
  3:{rate:6,limit:10_000_000,label:"3"},
  4:{rate:4,limit:10_000_000,label:"4"},
  5:{rate:2,limit:10_000_000,label:"5+"},
};

const MARKET_RATE:Record<PropertyKind,number>={
  newbuild:15.7,
  secondary:15.5,
  house:17.6,
};

const formatRub=(value:number)=>new Intl.NumberFormat("ru-RU").format(Math.round(value));
const formatRate=(value:number)=>String(Math.round(value*10)/10).replace(".",",")+"%";
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

const propertyLabels:Record<PropertyKind,string>={
  newbuild:"Новостройка",
  secondary:"Вторичка",
  house:"Дом / ИЖС",
};

export default function MortgagePage(){
  const [params]=useSearchParams();
  const requested=Number(params.get("price"));
  const initialPrice=Number.isFinite(requested)&&requested>0?clamp(requested,PRICE_MIN,PRICE_MAX):9_000_000;
  const control=usePulseControlState();
  const programs=control.mortgagePrograms;

  const [program,setProgram]=React.useState<ProgramId>("family");
  const [propertyKind,setPropertyKind]=React.useState<PropertyKind>("newbuild");
  const [price,setPrice]=React.useState(initialPrice);
  const [down,setDown]=React.useState(2_000_000);
  const [years,setYears]=React.useState(15);
  const [marketRate,setMarketRate]=React.useState(MARKET_RATE.newbuild);
  const [marketRateDraft,setMarketRateDraft]=React.useState(String(MARKET_RATE.newbuild).replace(".",","));
  const [childrenCount,setChildrenCount]=React.useState<FamilyChildren>(1);
  const [hasYoungChild,setHasYoungChild]=React.useState(true);
  const [disabledChild,setDisabledChild]=React.useState(false);
  const [largeArea,setLargeArea]=React.useState(false);
  const [priceDraft,setPriceDraft]=React.useState(formatRub(initialPrice));
  const [downDraft,setDownDraft]=React.useState(formatRub(2_000_000));
  const [interacted,setInteracted]=React.useState(false);
  const lastCalculation=React.useRef("");

  const rule=programs.find(item=>item.id===program)??programs[0];
  if(!rule)return null;

  const familyBase=FAMILY_SCALE[childrenCount];
  const downPercent=price?down/price*100:0;
  const familyRate=propertyKind==="house"
    ?6
    :(disabledChild||downPercent>=50?Math.min(6,familyBase.rate):familyBase.rate);

  const preferredRate=program==="family"
    ?familyRate
    :program==="farEast"
      ?2
      :program==="it"
        ?6
        :marketRate;

  const farEastLimit=propertyKind==="newbuild"&&largeArea
    ?9_000_000
    :propertyKind==="secondary"&&largeArea
      ?9_000_000
      :6_000_000;

  const subsidizedLimit=program==="family"
    ?familyBase.limit
    :program==="farEast"
      ?farEastLimit
      :program==="it"
        ?IT_SUBSIDIZED_LIMIT
        :100_000_000;

  const totalLimit=program==="family"
    ?FAMILY_COMBINED_MAX
    :program==="farEast"
      ?farEastLimit
      :program==="it"
        ?IT_COMBINED_MAX
        :100_000_000;

  const maxYears=program==="farEast"?20:30;
  const minDown=ceilStep(price*DOMCLICK_MIN_DOWN/100,MONEY_STEP);
  const maxDown=Math.max(minDown,price-MONEY_STEP);
  const loan=Math.max(price-down,0);
  const familyEligibilityBlocked=program==="family"&&!hasYoungChild&&!disabledChild;
  const objectBlocked=program==="it"&&propertyKind==="secondary";
  const hardLimitExceeded=program==="farEast"&&loan>farEastLimit;
  const totalLimitExceeded=program!=="standard"&&loan>totalLimit;
  const invalid=familyEligibilityBlocked||objectBlocked||hardLimitExceeded||totalLimitExceeded||down<minDown;

  const subsidizedPrincipal=program==="standard"?0:Math.min(loan,subsidizedLimit);
  const marketPrincipal=program==="standard"
    ?loan
    :(program==="family"||program==="it"?Math.max(0,loan-subsidizedLimit):0);

  const months=years*12;
  const preferredPayment=program==="standard"?0:annuity(subsidizedPrincipal,preferredRate,months);
  const marketPayment=annuity(marketPrincipal,marketRate,months);
  const payment=invalid?0:(program==="standard"?marketPayment:preferredPayment+marketPayment);
  const totalKnown=!(program==="family"&&years>FAMILY_SUBSIDY_YEARS);
  const total=totalKnown?payment*months:0;
  const overpayment=totalKnown?Math.max(total-loan,0):0;
  const income=payment/.45;
  const mixed=marketPrincipal>0&&program!=="standard";
  const requiredDown=ceilStep(Math.max(minDown,price-totalLimit),MONEY_STEP);

  const cardRate=(id:ProgramId)=>{
    if(id==="family")return program==="family"?formatRate(familyRate):"2–10%";
    if(id==="farEast")return "от 2%";
    if(id==="it")return "от 6%";
    return "от "+formatRate(MARKET_RATE[propertyKind]);
  };

  const ruleCards=program==="family"
    ?[
      {main:formatRate(familyRate),sub:"ставка сейчас"},
      {main:formatRub(familyBase.limit)+" ₽",sub:"льготный лимит"},
      {main:"15 лет",sub:"субсидирование"},
    ]
    :program==="farEast"
      ?[
        {main:"2%",sub:"льготная ставка"},
        {main:formatRub(farEastLimit)+" ₽",sub:"макс. кредит"},
        {main:"20 лет",sub:"макс. срок"},
      ]
      :program==="it"
        ?[
          {main:"6%",sub:"льготная ставка"},
          {main:"9 млн ₽",sub:"льготная часть"},
          {main:"18 млн ₽",sub:"с увеличением"},
        ]
        :[
          {main:formatRate(marketRate),sub:"ориентир ставки"},
          {main:"20,1%",sub:"взнос Домклик"},
          {main:"30 лет",sub:"макс. срок"},
        ];

  React.useEffect(()=>{
    if(years>maxYears)setYears(maxYears);
  },[maxYears,years]);

  React.useEffect(()=>{
    if(down<minDown){setDown(minDown);setDownDraft(formatRub(minDown))}
  },[minDown,down]);

  React.useEffect(()=>{
    const next=MARKET_RATE[propertyKind];
    setMarketRate(next);
    setMarketRateDraft(String(next).replace(".",","));
    setLargeArea(false);
  },[propertyKind]);

  React.useEffect(()=>{
    if(!interacted||invalid)return;
    const metadata={
      program,
      propertyKind,
      price,
      down,
      years,
      preferredRate,
      marketRate,
      payment:Math.round(payment),
      childrenCount:program==="family"?childrenCount:undefined,
      subsidizedLimit,
      marketPrincipal,
      rulesUpdated:RULES_UPDATED,
    };
    const key=JSON.stringify(metadata);
    if(lastCalculation.current===key)return;
    const timer=window.setTimeout(()=>{
      lastCalculation.current=key;
      recordPulseEvent({eventType:"mortgage_calculated",entityType:"mortgage",entityId:program,metadata});
    },800);
    return()=>window.clearTimeout(timer);
  },[
    interacted,invalid,program,propertyKind,price,down,years,preferredRate,marketRate,
    payment,childrenCount,subsidizedLimit,marketPrincipal,
  ]);

  const chooseProgram=(id:ProgramId)=>{
    setInteracted(true);
    setProgram(id);
    setYears(current=>Math.min(current,id==="farEast"?20:30));
    if(id!=="farEast")setLargeArea(false);
    recordPulseEvent({eventType:"mortgage_program",entityType:"mortgage_program",entityId:id});
  };

  const updatePrice=(value:number)=>{
    setInteracted(true);
    const next=clamp(snap(value,MONEY_STEP),PRICE_MIN,PRICE_MAX);
    const nextMin=ceilStep(next*DOMCLICK_MIN_DOWN/100,MONEY_STEP);
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
      return "С 1 октября 2026 ставка и лимит в Приморье зависят от количества детей.";
    }
    if(program==="farEast")return "В Приморском крае — до 6 млн ₽; до 9 млн ₽ для подходящего объекта увеличенной площади. Нужна льготная категория заёмщика.";
    if(program==="it")return "6% на льготную часть до 9 млн ₽. У Сбера увеличенный общий кредит — до 18 млн ₽; сверх 9 млн ₽ считается рыночная часть.";
    return "Рыночная ставка — ориентир Домклик. Финальная ставка зависит от банка, взноса, страхования и профиля заёмщика.";
  };

  return <div className={styles.page}>
    <PageHeader
      eyebrow="Финансовый сценарий"
      title="Ипотека"
      subtitle="Расчёт по действующим правилам для Приморского края."
      action={<div className={styles.headerIcon}><Calculator size={20}/></div>}
    />

    <div className={styles.freshness}><CircleCheck size={14}/><span>Правила проверены {RULES_UPDATED} · новые договоры</span></div>

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
          <span className={styles.liveRate}>{formatRate(familyRate)}</span>
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
          <span>При выполнении условия лимит кредита повышается до 9 млн ₽</span>
        </div>
        <Switch checked={largeArea} onCheckedChange={value=>{setInteracted(true);setLargeArea(value)}}/>
      </div>}

      <div className={styles.ruleStrip}>
        {ruleCards.map(item=><span key={item.sub}><b>{item.main}</b>{item.sub}</span>)}
      </div>
      <div className={styles.ruleHint}><Info size={14}/><span>{programHint()}</span></div>

      {propertyKind==="secondary"&&(program==="family"||program==="farEast")&&<div className={styles.contextWarning}>
        <Info size={15}/><span>
          Вторичка по этой программе доступна не везде. Перед подачей нужно проверить населённый пункт и сам объект по действующему перечню ДОМ.РФ / условиям банка.
        </span>
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
        <div className={styles.fieldMeta}>Минимум в калькуляторе Домклик / Сбер: 20,1% · {formatRub(minDown)} ₽</div>
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
        <div>
          <strong>Комбинированный расчёт</strong>
          <span>{formatRub(subsidizedPrincipal)} ₽ под {formatRate(preferredRate)} + {formatRub(marketPrincipal)} ₽ под {formatRate(marketRate)}</span>
        </div>
        <BadgePercent size={19}/>
      </div>}
    </section>

    {familyEligibilityBlocked&&<section className={styles.warning+" "+styles.warningStrong}>
      <AlertTriangle size={18}/>
      <div><strong>Не подтверждено базовое право на Семейную ипотеку</strong><span>Для обычного сценария нужен ребёнок младше 7 лет. Отдельное основание — ребёнок с инвалидностью до 18 лет.</span></div>
    </section>}

    {objectBlocked&&<section className={styles.warning+" "+styles.warningStrong}>
      <AlertTriangle size={18}/>
      <div><strong>Обычная вторичка не подходит под IT-ипотеку</strong><span>Программа рассчитана на первичное жильё от застройщика, дом от застройщика или строительство дома.</span></div>
    </section>}

    {(hardLimitExceeded||totalLimitExceeded)&&<section className={styles.warning+" "+styles.warningStrong}>
      <AlertTriangle size={18}/>
      <div>
        <strong>Сумма кредита выше доступного лимита</strong>
        <span>Увеличьте первоначальный взнос минимум до {formatRub(requiredDown)} ₽ или выберите другой сценарий.</span>
      </div>
    </section>}

    {program==="family"&&years>FAMILY_SUBSIDY_YEARS&&<section className={styles.warning}>
      <Info size={18}/>
      <div>
        <strong>Льготная ставка действует первые 15 лет</strong>
        <span>После этого ставка определяется правилами программы: минимум из «ставка по договору + 4 п.п.» и «ключевая ставка на момент окончания субсидии + 3 п.п.». Поэтому будущую переплату PULSE не выдумывает.</span>
      </div>
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

    <details className={styles.details} open={program==="family"}>
      <summary><span>Условия выбранной программы</span><ChevronRight size={16}/></summary>
      <div className={styles.detailsBody}>
        {program==="family"&&<>
          <p><b>Новые договоры с 1 октября 2026.</b> В Приморье: 1 ребёнок — 10% / до 6 млн ₽; 2 — 8% / до 8 млн ₽; 3 — 6% / до 10 млн ₽; 4 — 4% / до 10 млн ₽; 5+ — 2% / до 10 млн ₽.</p>
          <p>Хотя бы один ребёнок должен быть младше 7 лет. Для ребёнка с инвалидностью до 18 лет сохраняется ставка не выше 6%.</p>
          <p>При первоначальном взносе 50% и более ставка для подходящей семьи — не выше 6%. На строительство частного дома — 6% независимо от числа детей.</p>
          <p>Субсидирование — максимум 15 лет. Кредит может быть длиннее, но ставка после льготного периода меняется по правилам программы.</p>
          <p>С 1 февраля 2026 действует принцип «одна семья — одна льготная ипотека». Повторный льготный кредит возможен после полного погашения прежнего и рождения нового ребёнка.</p>
          <p>Для вторичного жилья действует отдельный перечень населённых пунктов и требования к дому — поэтому объект нужно проверять отдельно.</p>
        </>}

        {program==="farEast"&&<>
          <p><b>Дальневосточная ипотека — до 31.12.2030.</b> Ставка от 2%, взнос от 20,1%, срок до 20 лет.</p>
          <p>Лимит — 6 млн ₽; до 9 млн ₽ для строящейся квартиры площадью свыше 64 м². Для вторички повышенный лимит связан с площадью свыше 60 м² и допустимой территорией.</p>
          <p>Право имеют, в частности, молодые супруги до 36 лет, одинокий родитель до 36 лет, отдельные многодетные семьи, медики, педагоги, работники культуры и ОПК, участники СВО и отдельные члены их семей, участники «Дальневосточного гектара» и некоторые переехавшие по трудовым программам.</p>
          <p>Если на момент сделки нет регистрации в ДФО, после оформления собственности необходимо зарегистрироваться в приобретённом жилье в установленный программой срок.</p>
        </>}

        {program==="it"&&<>
          <p><b>IT-ипотека.</b> Ставка 6%, льготный лимит государства — 9 млн ₽; в Сбере общий кредит может достигать 18 млн ₽, при этом превышение считается по рыночной ставке.</p>
          <p>Взнос от 20,1%, срок до 30 лет. По текущим условиям Домклик возраст заёмщика — 18–50 лет; работодатель должен быть аккредитованной IT-компанией, соответствующей условиям программы.</p>
          <p>Требуемый доход зависит от места регистрации работодателя: для большинства городов — от 90 тыс. ₽, для крупных городов и отдельных регионов — от 150 тыс. ₽ до НДФЛ. Условия занятости в IT нужно сохранять в период кредита по правилам программы.</p>
          <p>Обычная вторичная квартира не является стандартным объектом IT-ипотеки.</p>
        </>}

        {program==="standard"&&<>
          <p><b>Рыночный сценарий.</b> Для расчёта подставляется текущий ориентир Домклик по типу недвижимости. Ставку можно изменить вручную.</p>
          <p>На момент проверки ориентир: новостройка — от 15,7%, вторичка — от 15,5%, строительство дома — от 17,6%. Реальная ставка определяется банком и может отличаться.</p>
        </>}
      </div>
    </details>

    <details className={styles.details}>
      <summary><span>Другие ипотечные сценарии</span><ChevronRight size={16}/></summary>
      <div className={styles.otherPrograms}>
        <div className={styles.otherProgram}>
          <div><Landmark size={16}/><strong>Военная ипотека</strong></div>
          <span className={styles.statusActive}>действует</span>
          <p>Для участников НИС. В Домклик сейчас — от 18,6%, взнос от 20,1%, срок до 25 лет. Государство участвует во взносе и платежах на время службы.</p>
        </div>
        <div className={styles.otherProgram}>
          <div><Landmark size={16}/><strong>Сельская ипотека</strong></div>
          <span className={styles.statusPaused}>приём закрыт</span>
          <p>Домклик сейчас указывает, что приём заявок завершён. Поэтому мы не показываем её как доступную программу в основном калькуляторе.</p>
        </div>
        <div className={styles.otherProgram}>
          <div><Landmark size={16}/><strong>Материнский капитал</strong></div>
          <span className={styles.statusInfo}>поддержка</span>
          <p>Это не отдельная процентная программа: средства можно учитывать в первоначальном взносе, если конкретная сделка и банк это допускают.</p>
        </div>
      </div>
    </details>

    <LeadSheet
      title="Проверить ипотечные программы"
      source="mortgage"
      propertyId={params.get("property")||undefined}
      context={{
        program,propertyKind,price,down,years,preferredRate,marketRate,payment,
        childrenCount:program==="family"?childrenCount:undefined,
        subsidizedLimit,marketPrincipal,rulesUpdated:RULES_UPDATED,
      }}
    >
      <button className={styles.cta}>Получить точный расчёт <ChevronRight size={18}/></button>
    </LeadSheet>

    <div className={styles.note}><ShieldCheck size={15}/>Расчёт предварительный. Финальные условия, право на льготу и объект подтверждает банк.</div>
  </div>;
}
