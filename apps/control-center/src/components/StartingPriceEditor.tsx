import React from 'react';
import type {PulseProperty} from '../../../../packages/pulse-data/model';
import {editStartingPrice} from '../../../../packages/domain/propertyPricing';
export function StartingPriceEditor({property,onChange}:{property:PulseProperty;onChange:(patch:Partial<PulseProperty>)=>void}){
 const details=property.projectDetails;
 const mode=details?.priceInputMode??(property.priceFrom>0?'total':'per_sqm');
 const update=(edit:Parameters<typeof editStartingPrice>[1])=>{
  const next=editStartingPrice(property,edit);onChange({priceFrom:next.priceFrom,projectDetails:next.projectDetails});
 };
 const value=(input:string)=>input===''?null:Number(input);
 return <div className="formGrid" style={{gridColumn:'1/-1'}}>
  <label className="controlField"><span>Как указываем стартовую цену</span><select aria-label="Как указываем стартовую цену" value={mode} onChange={e=>update({kind:'mode',value:e.target.value as 'total'|'per_sqm'})}><option value="total">Стоимость квартиры</option><option value="per_sqm">Цена за квадратный метр</option></select></label>
  <label className="controlField"><span>Площадь квартиры по этой цене, м²</span><input aria-label="Площадь квартиры по стартовой цене" type="number" min="0.01" max="10000" step="0.01" placeholder="Например, 38,6" value={details?.startingApartmentArea??''} onChange={e=>update({kind:'area',value:value(e.target.value)})}/></label>
  <label className="controlField"><span>Цена от, ₽</span><input aria-label="Стартовая стоимость квартиры" type="number" min="1" max="10000000000" step="1" value={property.priceFrom>0?Math.round(property.priceFrom*1000000):''} onChange={e=>update({kind:'total',value:value(e.target.value)})}/></label>
  <label className="controlField"><span>Цена за м² от, ₽</span><input aria-label="Стартовая цена за квадратный метр" type="number" min="0.01" max="1000000000" step="0.01" value={details?.pricePerSqmFromRub??''} placeholder="Рассчитается автоматически" onChange={e=>update({kind:'unit',value:value(e.target.value)})}/></label>
  <small style={{gridColumn:'1/-1',opacity:.72}}>Укажите площадь именно той квартиры, для которой введена цена. При вводе стоимости цена за м² считается автоматически; при вводе цены за м² рассчитывается стоимость. Минимальная площадь по всему ЖК для этого не используется.</small>
  {mode==='per_sqm'&&!details?.startingApartmentArea&&<small role="status" style={{gridColumn:'1/-1'}}>Добавьте площадь квартиры, чтобы рассчитать её стоимость.</small>}
 </div>;
}
