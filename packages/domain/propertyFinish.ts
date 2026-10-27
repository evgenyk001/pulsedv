import type {ApartmentFinish} from '../pulse-data/model';

/** Unknown is represented as null or a missing field, never as an invented finish. */
export const APARTMENT_FINISHES:[ApartmentFinish,string][]=[
 ['rough','Черновая'],
 ['white_box','White Box'],
 ['finished','Готовый ремонт'],
];
export const canonicalApartmentFinish=(value:ApartmentFinish|null|undefined)=>value==='unfinished'?'rough':value;
export const apartmentFinishLabel=(value:ApartmentFinish|null|undefined)=>APARTMENT_FINISHES.find(item=>item[0]===canonicalApartmentFinish(value))?.[1]??'Отделка уточняется';
export const apartmentFinishesLabel=(values:ApartmentFinish[])=>[...new Set(values.map(apartmentFinishLabel))].join(' · ');

export type FinishablePlan={priceFrom:number|null;priceTo?:number|null;isExact?:boolean;finishType?:ApartmentFinish|null;finishOptions?:{finishType:ApartmentFinish;priceFrom:number|null;priceTo?:number|null}[]};
/** Explicit offers trump a generic starting price. Unknown prices stay unknown. */
export function planFinishOffers(plan:FinishablePlan){
 if(plan.finishOptions?.length)return plan.finishOptions;
 return plan.finishType?[{finishType:plan.finishType,priceFrom:plan.priceFrom,...(plan.priceTo!==undefined?{priceTo:plan.priceTo}:{})}]:[];
}
export function planStartingPrice(plan:FinishablePlan):number|null{
 const offers=planFinishOffers(plan);
 const prices=offers.length?offers.map(offer=>offer.priceFrom).filter((price):price is number=>price!==null&&price>0):[plan.priceFrom].filter((price):price is number=>price!==null&&price>0);
 return prices.length?Math.min(...prices):null;
}
export function planPriceForFinish(plan:FinishablePlan,finish:ApartmentFinish|null):number|null{
 if(!finish)return planStartingPrice(plan);
 const offers=planFinishOffers(plan);
 return (offers.find(offer=>offer.finishType===finish)??offers.find(offer=>canonicalApartmentFinish(offer.finishType)===canonicalApartmentFinish(finish)))?.priceFrom??null;
}

/** An unknown upper bound stays unknown; an exact price has equal explicit bounds. */
export function planPriceRange(plan:FinishablePlan,finish?:ApartmentFinish|null):{from:number|null;to:number|null}{
 const offers=planFinishOffers(plan);
 if(finish){const offer=offers.find(o=>o.finishType===finish)??offers.find(o=>canonicalApartmentFinish(o.finishType)===canonicalApartmentFinish(finish));return {from:offer?.priceFrom??null,to:offer?.priceTo??null}}
 if(!offers.length)return {from:plan.priceFrom,to:plan.priceTo??null};
 return {from:planStartingPrice(plan),to:offers.every(o=>o.priceFrom!=null&&o.priceTo!=null)?Math.max(...offers.map(o=>o.priceTo!)):null};
}
