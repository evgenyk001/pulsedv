import type { ApartmentFinish, MortgageProgramRule, PulseProperty, PulseSelectConfig } from '../pulse-data/model';
import { calculateMortgageScenario, newbuildHasIncreasedLimit, type MortgageScenarioSettings } from './mortgagePolicy';
import {housingClassMatches} from './housingClass';
import {canonicalApartmentFinish,planFinishOffers,planStartingPrice,planPriceForFinish,planPriceRange,apartmentFinishLabel} from './propertyFinish';

export type Criteria={city:string;rooms:string;min:number;max:number;delivery:string;sea:boolean};
export type PurchaseMode='cash'|'mortgage';
export type PreferenceId='sea'|'family'|'parking'|'center'|'courtyard'|'finish';

export type SelectionCriteria={
  district?:string|null;
  districtRequired?:boolean;
  /** Explicit list; absent means every selected preference is required. */
  requiredPreferences?:PreferenceId[];
  housingClasses?:string[];
  areaFrom?:number|null;
  areaTo?:number|null;
  finishType?:ApartmentFinish|null;
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

export const districtKey=(value:string)=>{const key=value.trim().toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ');return ['центр','центр города','центральный','центральный район'].includes(key)?'центр':key;};
export function districtMatches(value:string,selected:string|null|undefined){return !selected||districtKey(value)===districtKey(selected);}

export function preferenceLabel(id:PreferenceId){return preferenceLabels[id];}

export function roomMatches(label:string,rooms:string){
  const normalized=label.toLowerCase();
  if(rooms==='Все'||rooms==='Не важно')return true;
  if(rooms==='Студия')return normalized.includes('студ');
  const count=Number(normalized.match(/\d+/)?.[0]||0);
  return /^\d+\+$/.test(rooms)?count>=parseInt(rooms):count===Number(rooms);
}

export function matchingPlans(property:PulseProperty,c:Pick<Criteria,'rooms'|'min'|'max'>){
  return property.floorplans.filter(p=>roomMatches(p.roomLabel,c.rooms)&&p.priceFrom!==null&&(p.priceTo??p.priceFrom)*1_000_000>=c.min&&p.priceFrom*1_000_000<=c.max);
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
  if((rooms==='Все'||rooms==='Не важно')&&property.priceFrom>0)return property.priceFrom*1_000_000;
  return null;
}

function propertyText(property:PulseProperty){
  return [
    property.name,property.city,property.district,property.description,
    ...property.tags,...property.features.map(item=>item.label),
  ].join(' ').toLowerCase();
}

export function hasSea(property:PulseProperty){
  if(property.city!=='Владивосток')return false;
  return [...property.tags,...property.features.map(item=>item.label),property.description].flatMap(text=>text.toLowerCase().split(/[.!?;\n]/)).some(clause=>
    /(?:вид[а-я]*|панорам[а-я]*).{0,24}(?:мор[еяю]|залив)/.test(clause)&&
    !/(?:без|нет|не предусмотрен[а-я]*).{0,20}(?:вид|панорам)|(?:вид|панорам).{0,32}(?:нет|отсутств|не предусмотрен)/.test(clause));
}

export function matchesPreference(property:PulseProperty,id:PreferenceId){
  const text=propertyText(property);
  if(id==='sea')return hasSea(property);
  const mentioned=(pattern:RegExp)=>text.split(/[.!?;\n]/).some(clause=>pattern.test(clause)&&
    !new RegExp('(?:без|нет|не предусмотрен[а-я]*|отсутств[а-я]*).{0,32}(?:'+pattern.source+')|(?:'+pattern.source+').{0,24}(?:нет|не предусмотрен|отсутств)').test(clause));
  if(id==='family')return mentioned(/для\s+сем|семейн[а-я]*\s+(?:двор|простран|жизн)|детск|школ|садик/);
  if(id==='parking')return property.projectDetails?.parkingSpaces!=null?property.projectDetails.parkingSpaces>0:mentioned(/парков|паркинг|машино-мест/);
  if(id==='center')return ['центр','центральный','центральный район'].includes(districtKey(property.district));
  if(id==='courtyard')return mentioned(/двор|благоустрой|зел[её]н|прогулоч/);
  const finishes=[...(property.projectDetails?.finishes??[]),...property.floorplans.flatMap(p=>planFinishOffers(p).map(o=>o.finishType))];
  if(finishes.length)return finishes.some(f=>['white_box','finished'].includes(canonicalApartmentFinish(f)!));
  return mentioned(/white\s*box|вайт\s*бокс|предчистов|чистов[а-я]*\s+отделк|готов[а-я]*\s+ремонт|с\s+отделк/);
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
  if(delivery==='Сдан')return [property.delivery,...property.tags].some(text=>/сдан|готов|введ[её]н/i.test(text)&&! /не\s+(?:сдан|готов|введ)/i.test(text));
  return property.delivery.includes(delivery);
}

export function selectionMatch(
  property:PulseProperty,
  criteria:SelectionCriteria,
  programs:MortgageProgramRule[],
  weights:PulseSelectConfig['weights'],
):SelectionMatch{
  const cityOk=criteria.city==='Все'||criteria.city==='Не важно'||property.city===criteria.city;
  const districtOk=districtMatches(property.district,criteria.district);
  const districtRequired=criteria.districtRequired!==false;
  const classOk=housingClassMatches(property.className,criteria.housingClasses);
  const areaSelected=(criteria.areaFrom??0)>0||(criteria.areaTo??0)>0;
  const overlaps=(plan:{areaFrom:number|null;areaTo:number|null})=>!areaSelected||
    (plan.areaFrom!=null&&plan.areaTo!=null&&plan.areaFrom>=(criteria.areaFrom??0)&&plan.areaTo<=(criteria.areaTo??Infinity));
  const finishRequired=!criteria.finishType&&(criteria.requiredPreferences??criteria.preferences).includes('finish');
  const isReadyFinish=(finish:ApartmentFinish)=>['white_box','finished'].includes(canonicalApartmentFinish(finish)!);
  const hasFinish=(plan:PulseProperty['floorplans'][number])=>criteria.finishType?planFinishOffers(plan).some(o=>canonicalApartmentFinish(o.finishType)===canonicalApartmentFinish(criteria.finishType)):!finishRequired||planFinishOffers(plan).some(o=>isReadyFinish(o.finishType));
  const candidates=property.floorplans.filter(plan=>roomMatches(plan.roomLabel,criteria.rooms)&&overlaps(plan)&&hasFinish(plan));
  const areaOk=!areaSelected||candidates.length>0;
  const finishOk=!criteria.finishType||candidates.length>0;
  const offers:Array<{plan?:PulseProperty['floorplans'][number];from:number;to:number}>=candidates.flatMap(plan=>{
    const pricedPlan=finishRequired?{...plan,finishOptions:planFinishOffers(plan).filter(o=>isReadyFinish(o.finishType))}:plan;
    const range=planPriceRange(pricedPlan,criteria.finishType);
    const from=criteria.finishType?planPriceForFinish(pricedPlan,criteria.finishType):planStartingPrice(pricedPlan);
    return from!=null&&from>0?[{plan,from:from*1_000_000,to:(range.to??from)*1_000_000}]:[];
  });
  if(!property.floorplans.length&&!areaSelected&&!criteria.finishType&&!finishRequired&&(criteria.rooms==='Все'||criteria.rooms==='Не важно')&&property.priceFrom>0){
    offers.push({plan:undefined,from:property.priceFrom*1_000_000,to:property.priceFrom*1_000_000});
  }
  const roomsOk=offers.length>0;
  let price:number|null=null;
  let financeOk=false;
  let mortgagePayment:number|null=null;
  let mortgageProgram:string|null=null;
  if(criteria.purchaseMode==='cash'){
    const fitting=offers.filter(offer=>offer.from<=criteria.max&&offer.to>=criteria.min).sort((a,b)=>a.from-b.from);
    const chosen=fitting[0]??[...offers].sort((a,b)=>a.from-b.from)[0];
    price=chosen?(fitting.length?Math.max(chosen.from,criteria.min):chosen.from):null;
    financeOk=fitting.length>0;
  }else{
    // Evaluate each applicable plan: a larger apartment can have a different
    // subsidised-loan limit and fit even when the cheapest plan does not.
    const fits=offers.map(offer=>{
      const scenario={...criteria.mortgageScenario,programId:criteria.mortgageProgram??'standard',propertyKind:'newbuild' as const,largeArea:newbuildHasIncreasedLimit(offer.plan)};
      return {offer,fit:bestMortgageFit(offer.from,criteria.downPayment,criteria.monthlyPayment,programs,criteria.mortgageProgram,scenario)};
    }).sort((a,b)=>Number(b.fit.fits)-Number(a.fit.fits)||(a.fit.payment??Infinity)-(b.fit.payment??Infinity)||a.offer.from-b.offer.from);
    const chosen=fits[0];
    price=chosen?.offer.from??null;
    financeOk=chosen?.fit.fits??false;
    mortgagePayment=chosen?.fit.payment??null;
    mortgageProgram=chosen?.fit.program??null;
  }

  const deliveryOk=deliveryMatches(property,criteria.delivery);
  const selected=criteria.preferences;
  const matchedPreferences=selected.filter(id=>matchesPreference(property,id));
  const required=(criteria.requiredPreferences??selected).filter(id=>selected.includes(id));
  const preferencesOk=required.every(id=>selected.includes(id)&&matchedPreferences.includes(id));
  const preferenceCount=selected.length+(criteria.district&&!districtRequired?1:0);
  const preferenceRatio=preferenceCount?(matchedPreferences.length+(criteria.district&&!districtRequired&&districtOk?1:0))/preferenceCount:1;

  const possible=Object.values(weights).reduce((sum,value)=>sum+value,0);
  const score=possible>0?Math.round(100*(
    (cityOk?weights.city:0)+(roomsOk?weights.rooms:0)+(financeOk?weights.budget:0)+
    (deliveryOk?weights.delivery:0)+weights.preferences*preferenceRatio
  )/possible):0;

  const reasons:string[]=[];
  if(cityOk&&criteria.city!=='Все'&&criteria.city!=='Не важно')reasons.push(criteria.city);
  if(criteria.district&&districtOk)reasons.push('Район: '+property.district);
  if(roomsOk&&criteria.rooms!=='Все'&&criteria.rooms!=='Не важно')reasons.push(criteria.rooms==='Студия'?'Студия':criteria.rooms+' комн.');
  if(financeOk&&criteria.purchaseMode==='cash')reasons.push('Укладывается в бюджет');
  if(financeOk&&criteria.purchaseMode==='mortgage')reasons.push('Может уложиться в ваш платёж');
  if(deliveryOk&&criteria.delivery!=='Любой'&&criteria.delivery!=='Не важно')reasons.push(criteria.delivery==='Сдан'?'Дом уже сдан':'Сдача '+criteria.delivery);
  if(classOk&&criteria.housingClasses?.length)reasons.push(property.className);
  if(areaSelected&&areaOk)reasons.push('Есть нужная площадь');
  if(criteria.finishType&&finishOk)reasons.push(apartmentFinishLabel(criteria.finishType));
  for(const id of matchedPreferences)reasons.push(preferenceLabel(id));

  const tradeoffs:string[]=[];
  if(!cityOk)tradeoffs.push('Другой город: '+property.city);
  if(!roomsOk)tradeoffs.push(property.floorplans.length?'Нет цены для выбранной комнатности':'Комнатность и цену нужно уточнить');
  if(!districtOk&&criteria.district)tradeoffs.push('Другой район: '+(property.district||'уточняется'));
  if(!classOk)tradeoffs.push('Другой класс жилья: '+(property.className||'уточняется'));
  if(!areaOk)tradeoffs.push('Нет подтверждённой планировки нужной площади');
  if(!finishOk)tradeoffs.push('Нет подтверждённой планировки с выбранной отделкой');
  if(!financeOk)tradeoffs.push(criteria.purchaseMode==='mortgage'?'Не укладывается в ваш взнос или платёж':'Цена выше выбранного бюджета');
  if(!deliveryOk&&criteria.delivery!=='Любой'&&criteria.delivery!=='Не важно')tradeoffs.push('Другой срок сдачи');
  for(const id of selected.filter(id=>!matchedPreferences.includes(id)))tradeoffs.push((required.includes(id)?'Не подтверждено условие «':'Нет пожелания «')+preferenceLabel(id)+'»');

  return {
    score,
    eligible:property.status==='published'&&cityOk&&roomsOk&&financeOk&&classOk&&areaOk&&finishOk&&deliveryOk&&(!districtRequired||districtOk)&&preferencesOk,
    price,
    reasons,
    tradeoffs:tradeoffs.slice(0,4),
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
