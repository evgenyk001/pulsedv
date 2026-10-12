import type {PulseProperty} from '../pulse-data/model';
import {matchesBudgetAndRooms,hasSea,deliveryMatches} from '../domain/propertyMatch';
export type SearchCriteria={q:string;city:string;rooms:string;min:number;max:number;delivery:string;sea:boolean;purchaseMode:'any'|'cash'|'mortgage'};
export type SearchSettings={criteria:SearchCriteria|null;watchFavorites:boolean;telegram:boolean};
export type SearchUpdate={id:string;propertyId:string;name:string;kind:'match'|'price'|'floorplan';title:string;at:string;notified:boolean};
export type SearchSnapshot=Record<string,{match:boolean;favorite:boolean;price:number;plans:string[]}>;
export const defaultSearchSettings:SearchSettings={criteria:null,watchFavorites:false,telegram:false};
export function sameSearchCriteria(a:SearchCriteria|null,b:SearchCriteria|null){return JSON.stringify(a?Object.entries(a).sort(([x],[y])=>x.localeCompare(y)):null)===JSON.stringify(b?Object.entries(b).sort(([x],[y])=>x.localeCompare(y)):null);}
export function searchMatches(p:PulseProperty,c:SearchCriteria){
 return p.status==='published'&&(!c.q||[p.name,p.city,p.district,p.developerName].join(' ').toLowerCase().includes(c.q.toLowerCase()))&&(c.city==='Все'||c.city==='Не важно'||p.city===c.city)&&deliveryMatches(p,c.delivery)&&(!c.sea||hasSea(p))&&matchesBudgetAndRooms(p,c);
}
export function searchSnapshot(properties:PulseProperty[],settings:SearchSettings,favorites:string[]):SearchSnapshot{
 const ids=new Set(favorites);
 if(!settings.criteria&&!settings.watchFavorites)return {};
 return Object.fromEntries(properties.filter(p=>p.status==='published').map(p=>[p.id,{match:!!settings.criteria&&searchMatches(p,settings.criteria),favorite:settings.watchFavorites&&ids.has(p.id),price:Math.round(p.priceFrom*1_000_000),plans:p.floorplans.map(f=>f.id??[f.roomLabel,f.areaFrom,f.areaTo].join(':'))}]).filter(([,s])=>(s as SearchSnapshot[string]).match||(s as SearchSnapshot[string]).favorite));
}
export function searchChanges(before:SearchSnapshot,after:SearchSnapshot,properties:PulseProperty[],at:string):Omit<SearchUpdate,'id'>[]{
 const result:Omit<SearchUpdate,'id'>[]=[];
 for(const p of properties){const next=after[p.id];if(!next)continue;const old=Object.hasOwn(before,p.id)?before[p.id]:undefined;
  const add=(kind:SearchUpdate['kind'],title:string)=>result.push({propertyId:p.id,name:p.name,kind,title,at,notified:false});
  if(next.match&&!old?.match)add('match','Новый подходящий вариант');
  if(next.favorite&&old?.favorite&&old.price!==next.price&&next.price>0)add('price',`Цена в каталоге: от ${new Intl.NumberFormat('ru-RU').format(next.price)} ₽ (было от ${new Intl.NumberFormat('ru-RU').format(old.price)} ₽)`);
  if(next.favorite&&old?.favorite&&next.plans.some(id=>!old.plans.includes(id)))add('floorplan','Добавлена планировка в избранном ЖК');
 }
 return result;
}
export function searchUrl(c:SearchCriteria){const q=new URLSearchParams({city:c.city,rooms:c.rooms,min:String(c.min),max:String(c.max),delivery:c.delivery});if(c.q)q.set('q',c.q);if(c.sea)q.set('sea','1');return '/catalog?'+q;}
