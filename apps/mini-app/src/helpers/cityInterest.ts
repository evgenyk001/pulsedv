import {safeLocalStorage} from '../../../../packages/browser/storage';
const KEY='pulse_city_interest_v1';
export function rememberCityInterest(city:string){
 try{safeLocalStorage.setItem(KEY,JSON.stringify({city:city==='Все'||city==='Не важно'?null:city,at:Date.now()}));window.dispatchEvent(new Event('pulse-city-interest'));}catch{}
}
export function rememberViewedCity(city:string){
 try{safeLocalStorage.setItem('pulse_viewed_city_v1',JSON.stringify({city,at:Date.now()}));}catch{}
}
export function readCityInterest():string|null{
 try{
  const raw=safeLocalStorage.getItem(KEY);
  if(raw){const value=JSON.parse(raw);return typeof value.city==='string'&&value.city.length<=100?value.city:null;}
  const selection=JSON.parse(safeLocalStorage.getItem('pulse_selection_current_v2')??'{}');
  if(selection.started&&typeof selection.city==='string'&&!['Все','Не важно'].includes(selection.city))return selection.city;
  const viewed=JSON.parse(safeLocalStorage.getItem('pulse_viewed_city_v1')??'{}');
  return typeof viewed.city==='string'&&Date.now()-Number(viewed.at)<30*86400000?viewed.city:null;
 }catch{return null;}
}
