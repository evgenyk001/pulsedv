import {MapPin} from 'lucide-react';
import {useSearchParams} from 'react-router-dom';

/** URL state survives refresh, navigation and browser Back without a storage dependency. */
export function useCatalogCity(){
  const [params,setParams]=useSearchParams();
  const city=params.get('city')||'';
  const setCity=(value:string)=>setParams(current=>{
    const next=new URLSearchParams(current);
    if(value)next.set('city',value);else next.delete('city');
    return next;
  });
  return [city,setCity] as const;
}
export function CatalogCityFilter({city,cities,onChange}:{city:string;cities:{city:string;all:number}[];onChange:(city:string)=>void}){
  return <label className="catalogCityFilter"><MapPin size={18}/><span>Город</span>
    <select aria-label="Город объектов" value={city} onChange={e=>onChange(e.target.value)}>
      <option value="">Все города</option>
      {city&&!cities.some(item=>item.city===city)&&<option value={city}>{city}</option>}
      {cities.map(item=><option key={item.city} value={item.city}>{item.city} · {item.all}</option>)}
    </select>
  </label>;
}
