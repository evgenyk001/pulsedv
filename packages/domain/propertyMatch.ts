import type { PulseProperty, PulseSelectConfig } from '../pulse-data/model';
export type Criteria={city:string;rooms:string;min:number;max:number;delivery:string;sea:boolean};
export function roomMatches(label:string,rooms:string){const normalized=label.toLowerCase();if(rooms==='Все')return true;if(rooms==='Студия')return normalized.includes('студ');const count=Number(normalized.match(/\d+/)?.[0]||0);return rooms==='3+'?count>=3:count===Number(rooms);}
export function matchingPlans(property:PulseProperty,c:Pick<Criteria,'rooms'|'min'|'max'>){return property.floorplans.filter(p=>roomMatches(p.roomLabel,c.rooms)&&p.priceFrom!==null&&p.priceFrom*1_000_000>=c.min&&p.priceFrom*1_000_000<=c.max);}
export function matchesBudgetAndRooms(property:PulseProperty,c:Pick<Criteria,'rooms'|'min'|'max'>){if(property.floorplans.length)return matchingPlans(property,c).length>0;return c.rooms==='Все'&&property.priceFrom*1_000_000>=c.min&&property.priceFrom*1_000_000<=c.max;}
export function hasSea(property:PulseProperty){return [...property.tags,...property.features.map(x=>x.label)].some(text=>/мор[еяю]|морской/i.test(text));}
export function matchScore(property:PulseProperty,c:Criteria,weights:PulseSelectConfig['weights']){
 let score=0;const possible=Object.values(weights).reduce((a,b)=>a+b,0);
 if(c.city==='Все'||property.city===c.city)score+=weights.city;
 if(matchesBudgetAndRooms(property,c))score+=weights.budget+weights.rooms;
 if(c.delivery==='Любой'||property.delivery.includes(c.delivery))score+=weights.delivery;
 if(!c.sea||hasSea(property))score+=weights.preferences;
 return Math.round(score/Math.max(1,possible)*100);
}
export function priceBounds(properties:PulseProperty[]){const prices=properties.filter(p=>p.status==='published').flatMap(p=>p.floorplans.length?p.floorplans.map(x=>x.priceFrom):[p.priceFrom]).filter((x):x is number=>x!==null&&x>0).map(x=>x*1_000_000);return {minPriceRub:prices.length?Math.min(...prices):4_000_000,maxPriceRub:prices.length?Math.max(...prices):25_000_000,stepRub:100_000};}
