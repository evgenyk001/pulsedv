import type {ProjectBuilding,PulseProperty} from '../pulse-data/model';
import {planStartingPrice} from './propertyFinish';
export const BUILDING_STATUSES=[['unknown','Статус уточняется'],['planned','Планируется'],['building','Строится'],['completed','Сдан']] as const;
export function buildingDelivery(b:ProjectBuilding){
 if(b.status==='completed')return 'Сдан';
 return b.deliveryYear?(b.deliveryQuarter?['I','II','III','IV'][b.deliveryQuarter-1]+' кв. ':'')+b.deliveryYear:'Срок уточняется';
}
export function anyDelivery(value:string|undefined){return !value||['Любой','Не важно','Все'].includes(value)}
export function buildingMatchesDelivery(b:ProjectBuilding,value:string){return anyDelivery(value)||(value==='Сдан'?b.status==='completed':b.status!=='completed'&&String(b.deliveryYear??'')===value)}
export function projectDeliveries(p:{delivery:string;projectDetails?:PulseProperty['projectDetails']}){
 const buildings=p.projectDetails?.buildings??[];
 return buildings.length?buildings.map(buildingDelivery):[p.delivery];
}
export function plansForDelivery(p:PulseProperty,value:string|undefined){
 const buildings=p.projectDetails?.buildings??[];
 if(!buildings.length||anyDelivery(value))return p.floorplans;
 const ids=new Set(buildings.filter(b=>buildingMatchesDelivery(b,value!)).map(b=>b.id));
 return p.floorplans.filter(plan=>!!plan.buildingId&&ids.has(plan.buildingId));
}
export function buildingPlans(p:PulseProperty,id:string){return id?p.floorplans.filter(plan=>plan.buildingId===id):p.floorplans}
export function buildingPrice(p:PulseProperty,id:string){
 const prices=buildingPlans(p,id).map(planStartingPrice).filter((n):n is number=>n!==null&&n>0);
 return prices.length?Math.min(...prices):null;
}
export function buildingName(p:PulseProperty,id:string|null|undefined){return (p.projectDetails?.buildings??[]).find(b=>b.id===id)?.name??null}
