import type {ProjectDetails} from '../pulse-data/model';
const positive=(value:number|null|undefined):value is number=>value!=null&&Number.isFinite(value)&&value>0;
export function totalFromSquareMetre(unitRub:number|null,area:number|null){
 if(!positive(unitRub)||!positive(area))return null;
 const total=Math.round(unitRub*area);
 return total>0&&total<=10_000_000_000?total:null;
}
export function squareMetreFromTotal(totalRub:number|null,area:number|null){
 if(!positive(totalRub)||!positive(area))return null;
 const unit=Math.round(totalRub/area*100)/100;
 return unit>0&&unit<=1_000_000_000?unit:null;
}
type Edit={kind:'total'|'unit'|'area';value:number|null}|{kind:'mode';value:'total'|'per_sqm'};
/** A reference area belongs to the apartment whose starting price is entered. */
export function editStartingPrice<P extends {priceFrom:number;projectDetails?:ProjectDetails}>(property:P,edit:Edit):P{
 const details:ProjectDetails={commissioningDate:null,totalApartments:null,availableApartments:null,...property.projectDetails};
 let mode=details.priceInputMode??(property.priceFrom>0?'total':'per_sqm');
 let total=property.priceFrom>0?Math.round(property.priceFrom*1_000_000):null;
 let unit=details.pricePerSqmFromRub??null;
 let area=details.startingApartmentArea??null;
 if(edit.kind==='mode')mode=edit.value;
 if(edit.kind==='total'){mode='total';total=positive(edit.value)?Math.round(edit.value):null;}
 if(edit.kind==='unit'){mode='per_sqm';unit=positive(edit.value)?edit.value:null;}
 if(edit.kind==='area')area=positive(edit.value)?edit.value:null;
 if(mode==='total')unit=squareMetreFromTotal(total,area);
 else total=totalFromSquareMetre(unit,area);
 return {...property,priceFrom:total==null?0:total/1_000_000,projectDetails:{...details,startingApartmentArea:area,pricePerSqmFromRub:unit,priceInputMode:mode}};
}
