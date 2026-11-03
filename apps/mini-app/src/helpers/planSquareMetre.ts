import type {ApartmentFinish,PulseProperty} from '../../../../packages/pulse-data/model';
import {planPriceRange} from '../../../../packages/domain/propertyFinish';
import {propertyPriceRub} from '../../../../packages/domain/propertyPresentation';
import {squareMetreFromTotal} from '../../../../packages/domain/propertyPricing';
/** Divide only a plan's own price by its confirmed area, never a group's minima. */
export function planSquareMetreLabel(plan:PulseProperty['floorplans'][number],finish?:ApartmentFinish|null):string|null{
 const area=plan.areaFrom;
 if(area==null||!Number.isFinite(area)||area<=0)return null;
 if(plan.areaTo!=null&&plan.areaTo!==area)return null;
 if(!plan.isExact&&plan.areaTo!==area)return null;
 const {from,to}=planPriceRange(plan,finish);
 const unit=(price:number|null)=>price==null?null:squareMetreFromTotal(propertyPriceRub(price),area);
 const low=unit(from),high=unit(to);
 if(low===null||Math.round(low)<=0||to!=null&&(high===null||to<from!))return null;
 const format=(value:number)=>Math.round(value).toLocaleString('ru-RU');
 return (to===null?'от '+format(low):from===to?format(low):format(low)+'–'+format(high!))+' ₽/м²';
}
