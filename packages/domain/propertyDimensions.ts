import type {PulseProperty} from '../pulse-data/model';
export function propertyAreaRange(property:Pick<PulseProperty,'projectDetails'|'floorplans'>){
 const details=property.projectDetails;
 if(details?.areaFrom!=null||details?.areaTo!=null)return {from:details.areaFrom??null,to:details.areaTo??null};
 const values=property.floorplans.flatMap(p=>[p.areaFrom,p.areaTo]).filter((v):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>0);
 return {from:values.length?Math.min(...values):null,to:values.length?Math.max(...values):null};
}
export function dimensionRange(from:number|null|undefined,to:number|null|undefined){
 const format=(n:number)=>n.toLocaleString('ru-RU');
 if(from!=null&&to!=null)return from===to?format(from):format(from)+'–'+format(to);
 if(from!=null)return 'от '+format(from);
 if(to!=null)return 'до '+format(to);
 return null;
}
