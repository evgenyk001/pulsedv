import type { MortgageProgramRule } from "../pulse-data/model";

export type MortgageProgramId=MortgageProgramRule["id"];
export type MortgagePropertyKind="newbuild"|"secondary"|"house";
export type FamilyChildren=1|2|3|4|5;

export type MortgageScenarioSettings={
  programId:MortgageProgramId;
  propertyKind:MortgagePropertyKind;
  childrenCount?:FamilyChildren;
  hasYoungChild?:boolean;
  disabledChild?:boolean;
  largeArea?:boolean;
  // A bank offering a blended product is not the borrower choosing it.
  allowBlended?:boolean;
  marketRate?:number;
  futureRate?:number;
  years?:number;
  price?:number;
  down?:number;
  updatedAt?:string;
};

export type MortgagePolicyStatus="eligible"|"needs_confirmation"|"blocked";

export type MortgageCalculation={
  status:MortgagePolicyStatus;
  invalid:boolean;
  blockReason:string|null;
  preferredRate:number;
  marketRate:number;
  subsidizedLimit:number;
  totalLimit:number;
  maxYears:number;
  minDownPct:number;
  minDown:number;
  loan:number;
  subsidizedPrincipal:number;
  marketPrincipal:number;
  preferredPayment:number;
  marketPayment:number;
  payment:number;
  totalKnown:boolean;
  total:number;
  overpayment:number;
  mixed:boolean;
  requiredDown:number;
  familySubsidyYears:number|null;
  projection:{firstMonths:number;remainingMonths:number;remainingPreferred:number;remainingMarket:number;futureRate:number;futurePayment:number;total:number;overpayment:number}|null;
  policyVersion:string;
};

export const MORTGAGE_POLICY_VERSION="2026-10-26";
export const MORTGAGE_SCENARIO_KEY="pulse_mortgage_scenario_v1";
export const FAMILY_SUBSIDY_YEARS=15;

export const FAMILY_SCALE:Record<FamilyChildren,{rate:number;limit:number;label:string}>={
  1:{rate:10,limit:6_000_000,label:"1"},
  2:{rate:8,limit:8_000_000,label:"2"},
  3:{rate:6,limit:10_000_000,label:"3"},
  4:{rate:4,limit:10_000_000,label:"4"},
  5:{rate:2,limit:10_000_000,label:"5+"},
};

export const DEFAULT_MARKET_RATES:Record<MortgagePropertyKind,number>={
  newbuild:15.7,
  secondary:15.5,
  house:17.6,
};

export function defaultMarketRate(programs:MortgageProgramRule[],propertyKind:MortgagePropertyKind){
  const standard=programs.find(item=>item.id==="standard");
  const configuredByKind=standard?.marketRates?.[propertyKind];
  if(typeof configuredByKind==="number"&&Number.isFinite(configuredByKind)&&configuredByKind>0)return configuredByKind;
  if(propertyKind==="newbuild"){
    const legacy=standard?.rate;
    if(typeof legacy==="number"&&Number.isFinite(legacy)&&legacy>0)return legacy;
  }
  return DEFAULT_MARKET_RATES[propertyKind];
}

// The program minimum is a financial boundary, not a slider increment.
// Round only a fractional ruble, avoiding binary floating-point artifacts.
export function minimumMortgageDown(price:number,percent:number){
  return Math.ceil(Number((price*percent/100).toFixed(6)));
}

export function annuityPayment(principal:number,annualRate:number,months:number){
  if(principal<=0||months<=0)return 0;
  const monthlyRate=annualRate/100/12;
  if(monthlyRate===0)return principal/months;
  const factor=(1+monthlyRate)**months;
  return principal*(monthlyRate*factor)/(factor-1);
}

export function remainingMortgagePrincipal(principal:number,annualRate:number,months:number,paidMonths:number){
  if(principal<=0||paidMonths>=months)return 0;
  const remaining=Math.max(0,months-paidMonths);
  // Present value of the remaining annuity avoids subtracting two large balances.
  const rate=annualRate/1200;
  const payment=annuityPayment(principal,annualRate,months);
  return rate===0?payment*remaining:payment*(-Math.expm1(-remaining*Math.log1p(rate)))/rate;
}

export function mortgageProgram(programs:MortgageProgramRule[],id:MortgageProgramId){
  return programs.find(item=>item.id===id)??null;
}

export function newbuildHasIncreasedLimit(plan:{areaFrom:number|null}|null|undefined){
  return typeof plan?.areaFrom==="number"&&plan.areaFrom>64;
}

export function calculateMortgageScenario(input:{
  programs:MortgageProgramRule[];
  settings:MortgageScenarioSettings;
  price:number;
  down:number;
  years?:number;
}):MortgageCalculation|null{
  const rule=mortgageProgram(input.programs,input.settings.programId);
  if(!rule)return null;

  const propertyKind=input.settings.propertyKind;
  const maxYears=Math.max(1,Math.min(Math.trunc(rule.maxYears),rule.id==="farEast"?20:30));
  const years=Math.max(1,Math.min(input.years??input.settings.years??maxYears,maxYears));
  const allowBlended=rule.blended&&input.settings.allowBlended===true&&(rule.id==="family"||rule.id==="it");
  const marketRate=input.settings.marketRate??defaultMarketRate(input.programs,propertyKind);
  const downPercent=input.price>0?input.down/input.price*100:0;
  const familyChildren=input.settings.childrenCount??1;
  const family=FAMILY_SCALE[familyChildren];

  let preferredRate=rule.rate;
  let subsidizedLimit=rule.subsidizedLimit;
  let totalLimit=rule.totalLimit;
  let status:MortgagePolicyStatus="needs_confirmation";
  let blockReason:string|null=null;
  let familySubsidyYears:number|null=null;

  if(rule.id==="family"){
    preferredRate=propertyKind==="house"
      ?6
      :(input.settings.disabledChild===true||downPercent>=50?Math.min(6,family.rate):family.rate);
    subsidizedLimit=family.limit;
    totalLimit=allowBlended?Math.max(subsidizedLimit,rule.totalLimit):subsidizedLimit;
    familySubsidyYears=propertyKind==="house"?null:FAMILY_SUBSIDY_YEARS;
    if(input.settings.hasYoungChild===false&&input.settings.disabledChild!==true){
      status="blocked";
      blockReason="Не подтверждено базовое право на Семейную ипотеку";
    }else{
      status=input.settings.hasYoungChild===true||input.settings.disabledChild===true?"eligible":"needs_confirmation";
    }
  }else if(rule.id==="farEast"){
    subsidizedLimit=input.settings.largeArea?Math.max(rule.subsidizedLimit,rule.totalLimit):rule.subsidizedLimit;
    totalLimit=subsidizedLimit;
    status="needs_confirmation";
  }else if(rule.id==="it"){
    totalLimit=allowBlended?Math.max(subsidizedLimit,rule.totalLimit):subsidizedLimit;
    if(propertyKind==="secondary"){
      status="blocked";
      blockReason="Обычная вторичка не подходит под IT-ипотеку";
    }else{
      status="needs_confirmation";
    }
  }else{
    preferredRate=marketRate;
    subsidizedLimit=rule.totalLimit;
    totalLimit=rule.totalLimit;
    status="eligible";
  }

  const minDownPct=Math.max(20.1,rule.minDownPct);
  const minDown=minimumMortgageDown(input.price,minDownPct);
  const loan=Math.max(input.price-input.down,0);
  const exceedsHardLimit=loan>totalLimit;
  if(exceedsHardLimit){
    status="blocked";
    blockReason="Сумма кредита выше доступного лимита";
  }

  const invalid=status==="blocked"||input.down<minDown;
  const subsidizedPrincipal=rule.id==="standard"?0:Math.min(loan,subsidizedLimit);
  const marketPrincipal=rule.id==="standard"
    ?loan
    :(allowBlended?Math.max(0,loan-subsidizedLimit):0);

  const months=years*12;
  const preferredPayment=rule.id==="standard"?0:annuityPayment(subsidizedPrincipal,preferredRate,months);
  const marketPayment=annuityPayment(marketPrincipal,marketRate,months);
  const payment=invalid?0:(rule.id==="standard"?marketPayment:preferredPayment+marketPayment);
  const totalKnown=familySubsidyYears===null||years<=familySubsidyYears;
  const total=totalKnown?payment*months:0;
  const overpayment=totalKnown?Math.max(total-loan,0):0;
  const requiredDown=Math.ceil(Math.max(minDown,input.price-totalLimit));
  const futureRate=input.settings.futureRate;
  const firstMonths=FAMILY_SUBSIDY_YEARS*12;
  const remainingMonths=months-firstMonths;
  let projection:MortgageCalculation['projection']=null;
  if(!invalid&&!totalKnown&&typeof futureRate==='number'&&Number.isFinite(futureRate)&&futureRate>=0&&futureRate<=40){
    const remainingPreferred=remainingMortgagePrincipal(subsidizedPrincipal,preferredRate,months,firstMonths);
    const remainingMarket=remainingMortgagePrincipal(marketPrincipal,marketRate,months,firstMonths);
    const futurePayment=annuityPayment(remainingPreferred,futureRate,remainingMonths)+marketPayment;
    const projectedTotal=payment*firstMonths+futurePayment*remainingMonths;
    projection={firstMonths,remainingMonths,remainingPreferred,remainingMarket,futureRate,futurePayment,total:projectedTotal,overpayment:Math.max(projectedTotal-loan,0)};
  }

  return {
    status,
    invalid,
    blockReason,
    preferredRate,
    marketRate,
    subsidizedLimit,
    totalLimit,
    maxYears,
    minDownPct,
    minDown,
    loan,
    subsidizedPrincipal,
    marketPrincipal,
    preferredPayment,
    marketPayment,
    payment,
    totalKnown,
    total,
    overpayment,
    mixed:marketPrincipal>0&&rule.id!=="standard",
    requiredDown,
    familySubsidyYears,
    projection,
    policyVersion:MORTGAGE_POLICY_VERSION,
  };
}

export function readMortgageScenario(storage:Pick<Storage,"getItem">|null|undefined,key=MORTGAGE_SCENARIO_KEY):MortgageScenarioSettings|null{
  if(!storage)return null;
  try{
    const raw=JSON.parse(storage.getItem(key)||"null");
    if(!raw||typeof raw!=="object")return null;
    if(!["family","farEast","it","standard"].includes(raw.programId))return null;
    if(!["newbuild","secondary","house"].includes(raw.propertyKind))return null;
    const finite=(value:unknown,min:number,max:number)=>typeof value==="number"&&Number.isFinite(value)&&value>=min&&value<=max?value:undefined;
    const children=finite(raw.childrenCount,1,5);
    return {
      programId:raw.programId,
      propertyKind:raw.propertyKind,
      childrenCount:children&&Number.isInteger(children)?children as FamilyChildren:undefined,
      hasYoungChild:typeof raw.hasYoungChild==="boolean"?raw.hasYoungChild:undefined,
      disabledChild:typeof raw.disabledChild==="boolean"?raw.disabledChild:undefined,
      largeArea:typeof raw.largeArea==="boolean"?raw.largeArea:undefined,
      allowBlended:raw.allowBlended===true,
      marketRate:finite(raw.marketRate,.1,40),
      futureRate:finite(raw.futureRate,0,40),
      years:finite(raw.years,1,30),
      price:finite(raw.price,key===MORTGAGE_SCENARIO_KEY?3_000_000:2,key===MORTGAGE_SCENARIO_KEY?45_000_000:10_000_000_000),
      down:finite(raw.down,0,10_000_000_000),
      updatedAt:typeof raw.updatedAt==="string"?raw.updatedAt:undefined,
    };
  }catch{return null;}
}
