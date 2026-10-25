import React from 'react';
import type {PulseProperty,ApartmentFinish} from '../../../../packages/pulse-data/model';
import {APARTMENT_FINISHES} from '../../../../packages/domain/propertyFinish';
import {propertyPriceRub} from '../../../../packages/domain/propertyPresentation';

type Floorplan=PulseProperty['floorplans'][number];
export function PlanFinishOptionsEditor({plan,onChange}:{plan:Floorplan;onChange:(next:Floorplan)=>void}){
 const offers=plan.finishOptions??[];
 const add=()=>{
  const free=APARTMENT_FINISHES.find(([key])=>!offers.some(offer=>offer.finishType===key));
  if(free)onChange({...plan,finishType:null,finishOptions:[...offers,{finishType:free[0],priceFrom:null}]});
 };
 const update=(index:number,next:{finishType:ApartmentFinish;priceFrom:number|null})=>onChange({...plan,finishOptions:offers.map((option,i)=>i===index?next:option)});
 return <div style={{gridColumn:'1/-1',marginTop:10}}>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}>
   <strong style={{fontSize:12}}>Отделка и цена</strong>
   <button type="button" className="secondaryAction" disabled={offers.length>=APARTMENT_FINISHES.length} onClick={add}>+ Вариант отделки</button>
  </div>
  <p style={{fontSize:11,opacity:.72,margin:'6px 0 10px'}}>При наличии вариантов покупатель увидит их цены вместо общей цены планировки. Цена без подтверждения не подставляется автоматически.</p>
  {offers.map((offer,index)=><div key={index} className="formGrid" style={{marginBottom:9}}>
   <label className="controlField"><span>Тип отделки</span>
    <select aria-label={'Отделка варианта '+(index+1)} value={offer.finishType} onChange={e=>{const finishType=e.target.value as ApartmentFinish;if(!offers.some((item,i)=>i!==index&&item.finishType===finishType))update(index,{...offer,finishType})}}>
     {APARTMENT_FINISHES.filter(([key])=>key===offer.finishType||!offers.some((item,i)=>i!==index&&item.finishType===key)).map(([key,label])=><option key={key} value={key}>{label}</option>)}
    </select>
   </label>
   <label className="controlField"><span>Цена от, ₽ для этой отделки</span>
    <input aria-label={'Цена отделки варианта '+(index+1)} type="number" min="1" step="1" placeholder="Уточняется" value={offer.priceFrom===null?'':propertyPriceRub(offer.priceFrom)} onChange={e=>update(index,{...offer,priceFrom:e.target.value===''?null:Math.round(Number(e.target.value))/1_000_000})}/>
   </label>
   <button type="button" className="textDanger" onClick={()=>onChange({...plan,finishOptions:offers.filter((_,i)=>i!==index)})}>Удалить вариант отделки</button>
  </div>)}
 </div>;
}
