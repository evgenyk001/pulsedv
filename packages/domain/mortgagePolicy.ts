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
  marketRate?:number;
  years?:number;
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
  policyVersion:string;
};

export const MORTGAGE_POLICY_VERSION="2026-10-01";
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
  if(propertyKind==="newbuild"){
    const configured=programs.find(item=>item.id==="standard")?.rate;
    if(typeof configured==="number"&&Number.isFinite(configured)&&configured>0)return configured;
  }
  return DEFAULT_MARKET_RATES[propertyKind];
}

const MONEY_STEP=100_000;
const ceilStep=(value:number,step=MONEY_STEP)=>Math.ceil(value/step)*step;

export function annuityPayment(principal:number,annualRate:number,months:number){
  if(principal<=0||months<=0)return 0;
  const monthlyRate=annualRate/100/12;
  if(monthlyRate===0)return principal/months;
  const factor=(1+monthlyRate)**months;
  return principal*(monthlyRate*factor)/(factor-1);
}

export function mortgageProgram(programs:MortgageProgramRule[],id:MortgageProgramId){
  return programs.find(item=>item.id===id)??null;
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
  const years=Math.max(1,Math.min(input.years??input.settings.years??rule.maxYears,rule.maxYears));
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
    totalLimit=Math.max(subsidizedLimit,rule.totalLimit);
    familySubsidyYears=FAMILY_SUBSIDY_YEARS;
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
    if(propertyKind==="secondary"){
      status="blocked";
      blockReason="Обычная вторичка не подходит под IT-ипотеку";
    }else{
      status="needs_confirmation";
    }
  }else{
    preferredRate=marketRate;
    subsidizedLimit=100_000_000;
    totalLimit=100_000_000;
    status="eligible";
  }

  const minDownPct=rule.minDownPct;
  const minDown=ceilStep(input.price*minDownPct/100);
  const loan=Math.max(input.price-input.down,0);
  const exceedsHardLimit=rule.id!=="standard"&&loan>totalLimit;
  if(exceedsHardLimit){
    status="blocked";
    blockReason="Сумма кредита выше доступного лимита";
  }

  const invalid=status==="blocked"||input.down<minDown;
  const subsidizedPrincipal=rule.id==="standard"?0:Math.min(loan,subsidizedLimit);
  const marketPrincipal=rule.id==="standard"
    ?loan
    :(rule.blended?Math.max(0,loan-subsidizedLimit):0);

  const months=years*12;
  const preferredPayment=rule.id==="standard"?0:annuityPayment(subsidizedPrincipal,preferredRate,months);
  const marketPayment=annuityPayment(marketPrincipal,marketRate,months);
  const payment=invalid?0:(rule.id==="standard"?marketPayment:preferredPayment+marketPayment);
  const totalKnown=!(rule.id==="family"&&years>FAMILY_SUBSIDY_YEARS);
  const total=totalKnown?payment*months:0;
  const overpayment=totalKnown?Math.max(total-loan,0):0;
  const requiredDown=ceilStep(Math.max(minDown,input.price-totalLimit));

  return {
    status,
    invalid,
    blockReason,
    preferredRate,
    marketRate,
    subsidizedLimit,
    totalLimit,
    maxYears:rule.maxYears,
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
    policyVersion:MORTGAGE_POLICY_VERSION,
  };
}

export function readMortgageScenario(storage:Pick<Storage,"getItem">|null|undefined):MortgageScenarioSettings|null{
  if(!storage)return null;
  try{
    const raw=JSON.parse(storage.getItem(MORTGAGE_SCENARIO_KEY)||"null");
    if(!raw||typeof raw!=="object")return null;
    if(!["family","farEast","it","standard"].includes(raw.programId))return null;
    if(!["newbuild","secondary","house"].includes(raw.propertyKind))return null;
    return raw as MortgageScenarioSettings;
  }catch{return null;}
}
