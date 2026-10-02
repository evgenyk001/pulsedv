import type { MortgageProgramRule, PulseProperty, PulseSelectConfig } from '../pulse-data/model';
import { calculateMortgageScenario, type MortgageScenarioSettings } from './mortgagePolicy';

export type Criteria={city:string;rooms:string;min:number;max:number;delivery:string;sea:boolean};
export type PurchaseMode='cash'|'mortgage';
export type PreferenceId='sea'|'family'|'parking'|'center'|'courtyard'|'finish';

export type SelectionCriteria={
  city:string;
  rooms:string;
  delivery:string;
  purchaseMode:PurchaseMode;
  min:number;
  max:number;
  downPayment:number;
  monthlyPayment:number;
  preferences:PreferenceId[];
  mortgageProgram?:MortgageProgramRule["id"];
  mortgageScenario?:MortgageScenarioSettings|null;
};

export type SelectionMatch={
  score:number;
  eligible:boolean;
  price:number|null;
  reasons:string[];
  tradeoffs:string[];
  mortgagePayment:number|null;
  mortgageProgram:string|null;
};

const preferenceLabels:Record<PreferenceId,string>={
  sea:'Вид на море',
  family:'Для семьи',
  parking:'Парковка',
  center:'Ближе к центру',
  courtyard:'Благоустроенный двор',
  finish:'С отделкой',
};

export function preferenceLabel(id:PreferenceId){return preferenceLabels[id];}

export function roomMatches(label:string,rooms:string){
  const normalized=label.toLowerCase();
  if(rooms==='Все'||rooms==='Не важно')return true;
  if(rooms==='Студия')return normalized.includes('студ');
  const count=Number(normalized.match(/\d+/)?.[0]||0);
  return rooms==='3+'?count>=3:count===Number(rooms);
}

export function matchingPlans(property:PulseProperty,c:Pick<Criteria,'rooms'|'min'|'max'>){
  return property.floorplans.filter(p=>roomMatches(p.roomLabel,c.rooms)&&p.priceFrom!==null&&p.priceFrom*1_000_000>=c.min&&p.priceFrom*1_000_000<=c.max);
}

export function matchesBudgetAndRooms(property:PulseProperty,c:Pick<Criteria,'rooms'|'min'|'max'>){
  if(property.floorplans.length)return matchingPlans(property,c).length>0;
  return (c.rooms==='Все'||c.rooms==='Не важно')&&property.priceFrom*1_000_000>=c.min&&property.priceFrom*1_000_000<=c.max;
}

function roomPlans(property:PulseProperty,rooms:string){
  return property.floorplans.filter(plan=>roomMatches(plan.roomLabel,rooms)&&plan.priceFrom!==null);
}

export function representativePrice(property:PulseProperty,rooms:string){
  const prices=roomPlans(property,rooms).map(plan=>(plan.priceFrom||0)*1_000_000).filter(Boolean);
  if(prices.length)return Math.min(...prices);
  if(rooms==='Все'||rooms==='Не важно')return property.priceFrom*1_000_000;
  return null;
}

function propertyText(property:PulseProperty){
  return [
    property.name,property.city,property.district,property.description,
    ...property.tags,...property.features.map(item=>item.label),
  ].join(' ').toLowerCase();
}

export function hasSea(property:PulseProperty){
  return property.city==='Владивосток'&&/мор[еяю]|морской/.test(propertyText(property));
}

export function matchesPreference(property:PulseProperty,id:PreferenceId){
  const text=propertyText(property);
  if(id==='sea')return hasSea(property);
  if(id==='family')return /семейн|детск|школ|садик/.test(text);
  if(id==='parking')return /парков|паркинг/.test(text);
  if(id==='center')return /центр|центральн/.test(text);
  if(id==='courtyard')return /двор|благоустрой|зел[её]н|прогулоч/.test(text);
  return /отделк|ремонт|white box|чистова/.test(text);
}

export function monthlyMortgagePayment(principal:number,annualRate:number,years:number){
  if(principal<=0)return 0;
  const months=Math.max(1,Math.round(years*12));
  const monthlyRate=annualRate/100/12;
  if(monthlyRate<=0)return principal/months;
  const factor=(1+monthlyRate)**months;
  return principal*monthlyRate*factor/(factor-1);
}

export function bestMortgageFit(
  price:number,
  downPayment:number,
  target:number,
  programs:MortgageProgramRule[],
  selectedProgram:MortgageProgramRule["id"]="standard",
  scenario?:MortgageScenarioSettings|null,
){
  const principal=Math.max(0,price-Math.max(0,downPayment));
  if(principal===0)return {payment:0,program:'Без кредита',fits:true,status:'eligible' as const};
  const rule=programs.find(program=>program.id===selectedProgram);
  if(!rule)return {payment:null,program:null,fits:false,status:'blocked' as const};
  const settings:MortgageScenarioSettings={
    programId:selectedProgram,
    propertyKind:'newbuild',
    ...(scenario&&scenario.programId===selectedProgram?scenario:{}),
  };
  const calculation=calculateMortgageScenario({
    programs,
    settings,
    price,
    down:downPayment,
    years:settings.years??rule.maxYears,
  });
  if(!calculation||calculation.invalid)return {
    payment:null,
    program:rule.label,
    fits:false,
    status:(calculation?.status??'blocked'),
  };
  return {
    payment:calculation.payment,
    program:rule.label,
    fits:target>0&&calculation.payment<=target,
    status:calculation.status,
  };
}

export function deliveryMatches(property:PulseProperty,delivery:string){
  if(delivery==='Любой'||delivery==='Не важно')return true;
  if(delivery==='Сдан')return /сдан|готов|введ[её]н/i.test(property.delivery);
  return property.delivery.includes(delivery);
}

export function selectionMatch(
  property:PulseProperty,
  criteria:SelectionCriteria,
  programs:MortgageProgramRule[],
  weights:PulseSelectConfig['weights'],
):SelectionMatch{
  const cityOk=criteria.city==='Все'||criteria.city==='Не важно'||property.city===criteria.city;
  const inBudget=criteria.purchaseMode==='cash'?matchingPlans(property,{rooms:criteria.rooms,min:criteria.min,max:criteria.max}):[];
  const price=inBudget.length?Math.min(...inBudget.map(p=>p.priceFrom!*1_000_000)):representativePrice(property,criteria.rooms);
  const roomsOk=price!==null;

  let financeOk=false;
  let mortgagePayment:number|null=null;
  let mortgageProgram:string|null=null;
  if(price!==null&&criteria.purchaseMode==='cash'){
    financeOk=price>=criteria.min&&price<=criteria.max;
  }else if(price!==null){
    const fit=bestMortgageFit(price,criteria.downPayment,criteria.monthlyPayment,programs,criteria.mortgageProgram,criteria.mortgageScenario);
    financeOk=fit.fits;
    mortgagePayment=fit.payment;
    mortgageProgram=fit.program;
  }

  const deliveryOk=deliveryMatches(property,criteria.delivery);
  const selected=criteria.preferences;
  const matchedPreferences=selected.filter(id=>matchesPreference(property,id));
  const preferenceRatio=selected.length?matchedPreferences.length/selected.length:1;

  const possible=Object.values(weights).reduce((sum,value)=>sum+value,0);
  const score=possible>0?Math.round(100*(
    (cityOk?weights.city:0)+(roomsOk?weights.rooms:0)+(financeOk?weights.budget:0)+
    (deliveryOk?weights.delivery:0)+weights.preferences*preferenceRatio
  )/possible):0;

  const reasons:string[]=[];
  if(cityOk&&criteria.city!=='Все'&&criteria.city!=='Не важно')reasons.push(criteria.city);
  if(roomsOk&&criteria.rooms!=='Все'&&criteria.rooms!=='Не важно')reasons.push(criteria.rooms==='Студия'?'Студия':criteria.rooms+' комн.');
  if(financeOk&&criteria.purchaseMode==='cash')reasons.push('Укладывается в бюджет');
  if(financeOk&&criteria.purchaseMode==='mortgage')reasons.push('Может уложиться в ваш платёж');
  if(deliveryOk&&criteria.delivery!=='Любой'&&criteria.delivery!=='Не важно')reasons.push(criteria.delivery==='Сдан'?'Дом уже сдан':'Сдача '+criteria.delivery);
  for(const id of matchedPreferences)reasons.push(preferenceLabel(id));

  const tradeoffs:string[]=[];
  if(!deliveryOk&&criteria.delivery!=='Любой'&&criteria.delivery!=='Не важно')tradeoffs.push('Другой срок сдачи');
  for(const id of selected.filter(id=>!matchedPreferences.includes(id)))tradeoffs.push('Нет приоритета «'+preferenceLabel(id)+'»');

  return {
    score,
    eligible:cityOk&&roomsOk&&financeOk,
    price,
    reasons:reasons.slice(0,4),
    tradeoffs:tradeoffs.slice(0,2),
    mortgagePayment,
    mortgageProgram,
  };
}

export function matchScore(property:PulseProperty,c:Criteria,weights:PulseSelectConfig['weights']){
  let score=0;
  const possible=Object.values(weights).reduce((a,b)=>a+b,0);
  if(c.city==='Все'||property.city===c.city)score+=weights.city;
  if(matchesBudgetAndRooms(property,c))score+=weights.budget+weights.rooms;
  if(c.delivery==='Любой'||property.delivery.includes(c.delivery))score+=weights.delivery;
  if(!c.sea||hasSea(property))score+=weights.preferences;
  return Math.round(score/Math.max(1,possible)*100);
}

export function priceBounds(properties:PulseProperty[]){
  const prices=properties
    .filter(p=>p.status==='published')
    .flatMap(p=>p.floorplans.length?p.floorplans.map(x=>x.priceFrom):[p.priceFrom])
    .filter((x):x is number=>x!==null&&x>0)
    .map(x=>x*1_000_000);
  return {
    minPriceRub:prices.length?Math.min(...prices):4_000_000,
    maxPriceRub:prices.length?Math.max(...prices):25_000_000,
    stepRub:100_000,
  };
}
