import {squareMetreFromTotal} from './propertyPricing';
import type {ApartmentFinish,PulseProperty} from '../pulse-data/model';
import {planPriceForFinish,planStartingPrice,planPriceRange,type FinishablePlan} from './propertyFinish';

export type PropertyPhoto={url:string;alt:string};
export const propertyPriceRub=(price:number)=>Math.round(price*1_000_000);
export const propertyPriceLabel=(price:number)=>'от '+propertyPriceRub(price).toLocaleString('ru-RU')+' ₽';
export const formatPropertyMillions=(price:number)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(price);

/** The two project minima need not describe the same apartment. Never divide them. */
export function propertyPricePerSqm(property:PulseProperty,options:{plans?:PulseProperty['floorplans'];finish?:ApartmentFinish|null}={}){
 const explicit=property.projectDetails?.pricePerSqmFromRub;
 if(options.plans===undefined&&!options.finish){
  if(explicit!=null&&Number.isFinite(explicit)&&explicit>0)return explicit;
  const paired=squareMetreFromTotal(propertyPriceRub(property.priceFrom),property.projectDetails?.startingApartmentArea??null);
  if(paired!==null)return paired;
 }
 const prices=(options.plans??property.floorplans).flatMap(plan=>{
  if(!(plan.areaFrom&&plan.areaFrom===plan.areaTo))return [];
  const {from,to}=planPriceRange(plan,options.finish);
  if(from==null||from<=0||(!plan.isExact&&to!==from))return [];
  return [propertyPriceRub(from)/plan.areaFrom];
 });
 return prices.length?Math.round(Math.min(...prices)):null;
}
export function propertyPricePerSqmLabel(property:PulseProperty,options:Parameters<typeof propertyPricePerSqm>[1]={}){
 const price=propertyPricePerSqm(property,options);
 return price===null?null:'от '+Math.round(price).toLocaleString('ru-RU')+' ₽/м²';
}
export function planPriceLabel(plan:FinishablePlan,finish?:ApartmentFinish|null){
 const {from,to}=planPriceRange(plan,finish);
 if(from==null)return 'Цена уточняется';
 const format=(value:number)=>propertyPriceRub(value).toLocaleString('ru-RU');
 return to==null?'от '+format(from)+' ₽':from===to?format(from)+' ₽':format(from)+'–'+format(to)+' ₽';
}


export function propertyPhotos(property:PulseProperty):PropertyPhoto[]{
 const photos:PropertyPhoto[]=[];
 const seen=new Set<string>();
 const add=(url:string|null,alt:string)=>{if(url&&!seen.has(url)){seen.add(url);photos.push({url,alt:alt.trim()||property.name});}};
 add(property.coverImageUrl,property.images.find(image=>image.url===property.coverImageUrl)?.alt||property.name);
 for(const image of [...property.images].sort((a,b)=>a.sortOrder-b.sortOrder))add(image.url,image.alt);
 return photos;
}

export function propertyPlanKey(property:PulseProperty,plan:PulseProperty['floorplans'][number]){
 return plan.id??'index-'+property.floorplans.indexOf(plan);
}
export function propertyPlan(property:PulseProperty,key:string|null){
 if(!key)return undefined;
 const byId=property.floorplans.find(plan=>plan.id===key);
 if(byId)return byId;
 return /^index-\d+$/.test(key)?property.floorplans[Number(key.slice(6))]:undefined;
}
export function propertyMortgageLink(property:PulseProperty,plan?:PulseProperty['floorplans'][number],finish?:ApartmentFinish|null){
 const price=plan?(finish?planPriceForFinish(plan,finish):planStartingPrice(plan)):property.priceFrom;
 const query=new URLSearchParams({price:String(propertyPriceRub(price??property.priceFrom)),property:property.id,from:'property',down:'min'});
 if(plan)query.set('floorplan',propertyPlanKey(property,plan));
 if(finish&&plan&&planPriceForFinish(plan,finish)!==null)query.set('finish',finish);
 return '/mortgage?'+query;
}

/** New catalog uploads have static derivatives. Older/external images use originals. */
export function catalogImageVariant(url:string,kind:'card'|'thumb'){
 return /^\/media\/images\/[a-f0-9-]{36}\.(?:jpg|png|webp)$/.test(url)?url+'.'+kind+'.webp':url;
}
