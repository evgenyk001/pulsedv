import type {PulseProperty} from '../pulse-data/model';

export type PropertyPhoto={url:string;alt:string};
export const propertyPriceRub=(price:number)=>Math.round(price*1_000_000);
export const propertyPriceLabel=(price:number)=>'от '+propertyPriceRub(price).toLocaleString('ru-RU')+' ₽';

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
export function propertyMortgageLink(property:PulseProperty,plan?:PulseProperty['floorplans'][number]){
 const price=plan?.priceFrom??property.priceFrom;
 const query=new URLSearchParams({price:String(propertyPriceRub(price)),property:property.id,from:'property',down:'min'});
 if(plan)query.set('floorplan',propertyPlanKey(property,plan));
 return '/mortgage?'+query;
}
