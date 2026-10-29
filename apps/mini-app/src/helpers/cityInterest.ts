const KEY='pulse_city_interest_v1';
export function rememberCityInterest(city:string){
 try{localStorage.setItem(KEY,JSON.stringify({city:city==='Все'||city==='Не важно'?null:city,at:Date.now()}));window.dispatchEvent(new Event('pulse-city-interest'));}catch{}
}
export function readCityInterest():string|null{
 try{
  const raw=localStorage.getItem(KEY);
  if(raw){const value=JSON.parse(raw);return typeof value.city==='string'&&value.city.length<=100?value.city:null;}
  const selection=JSON.parse(localStorage.getItem('pulse_selection_current_v2')??'{}');
  return selection.started&&typeof selection.city==='string'&&!['Все','Не важно'].includes(selection.city)?selection.city:null;
 }catch{return null;}
}
