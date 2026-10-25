import type {ApartmentFinish} from '../pulse-data/model';

/** Unknown is represented as null or a missing field, never as an invented finish. */
export const APARTMENT_FINISHES:[ApartmentFinish,string][]=[
 ['rough','Черновая'],
 ['white_box','White Box'],
 ['finished','Готовый ремонт'],
 ['unfinished','Без отделки'],
];
export const apartmentFinishLabel=(value:ApartmentFinish|null|undefined)=>APARTMENT_FINISHES.find(item=>item[0]===value)?.[1]??'Отделка уточняется';
export const apartmentFinishesLabel=(values:ApartmentFinish[])=>values.map(apartmentFinishLabel).join(' · ');

export type FinishablePlan={priceFrom:number|null;finishType?:ApartmentFinish|null;finishOptions?:{finishType:ApartmentFinish;priceFrom:number|null}[]};
/** Explicit offers trump a generic starting price. Unknown prices stay unknown. */
export function planFinishOffers(plan:FinishablePlan){
 if(plan.finishOptions?.length)return plan.finishOptions;
 return plan.finishType?[{finishType:plan.finishType,priceFrom:plan.priceFrom}]:[];
}
export function planStartingPrice(plan:FinishablePlan):number|null{
 const offers=planFinishOffers(plan);
 const prices=offers.length?offers.map(offer=>offer.priceFrom).filter((price):price is number=>price!==null&&price>0):[plan.priceFrom].filter((price):price is number=>price!==null&&price>0);
 return prices.length?Math.min(...prices):null;
}
export function planPriceForFinish(plan:FinishablePlan,finish:ApartmentFinish|null):number|null{
 if(!finish)return planStartingPrice(plan);
 return planFinishOffers(plan).find(offer=>offer.finishType===finish)?.priceFrom??null;
}
