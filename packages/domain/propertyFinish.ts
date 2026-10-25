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
