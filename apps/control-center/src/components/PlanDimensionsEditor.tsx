import React from 'react';
import type {PulseProperty} from '../../../../packages/pulse-data/model';
import {propertyPriceRub} from '../../../../packages/domain/propertyPresentation';
import {totalFromSquareMetre,squareMetreFromTotal} from '../../../../packages/domain/propertyPricing';
type Plan=PulseProperty['floorplans'][number];
export function PlanDimensionsEditor({plan,onChange}:{plan:Plan;onChange:(next:Plan)=>void}){
 const exact=!!plan.isExact;
 const unitInput=React.useRef(false);
 const [unitDraft,setUnitDraft]=React.useState<string|null>(null);
 const numberField=(key:'areaFrom'|'areaTo'|'priceFrom'|'priceTo',label:string)=>{
  const money=key.startsWith('price'),value=plan[key]??null;
  return <label className="controlField" key={key}><span>{label}</span><input type="number" min={money?1:0.01} step={money?1:0.01} value={value===null?'':money?propertyPriceRub(value):value} onChange={e=>{
   const v=e.target.value===''?null:money?Math.round(Number(e.target.value))/1_000_000:Number(e.target.value);
   if(key==='priceFrom')unitInput.current=false;
   const unit=exact&&key==='areaFrom'&&unitInput.current?squareMetreFromTotal(plan.priceFrom==null?null:propertyPriceRub(plan.priceFrom),plan.areaFrom):null;
   const total=unit===null?null:totalFromSquareMetre(unit,v);
   onChange({...plan,[key]:v,...(exact&&key==='areaFrom'?{areaTo:v}:{}),...(exact&&key==='priceFrom'?{priceTo:v}:{}),...(unit!==null?{priceFrom:total===null?null:total/1000000,priceTo:total===null?null:total/1000000}:{})});
  }}/></label>;
 };
 return <div className="formGrid">
  <label className="controlField"><span>Что добавляем</span><select aria-label="Что добавляем" value={exact?'exact':'range'} onChange={e=>{
   const isExact=e.target.value==='exact';
   if(isExact&&(plan.areaTo!=null&&plan.areaTo!==plan.areaFrom||plan.priceTo!=null&&plan.priceTo!==plan.priceFrom||plan.finishOptions?.some(offer=>offer.priceTo!=null&&offer.priceTo!==offer.priceFrom))&&!window.confirm('Оставить начальную площадь и цену как точные значения этой планировки? Верхние границы диапазонов будут заменены.'))return;
   onChange({...plan,isExact,...(isExact?{areaTo:plan.areaFrom,priceTo:plan.priceFrom,finishOptions:plan.finishOptions?.map(offer=>({...offer,priceTo:offer.priceFrom}))}:{})});
  }}><option value="exact">Конкретная планировка</option><option value="range">Группа планировок · диапазон</option></select></label>
  <label className="controlField"><span>Комнатность</span><input value={plan.roomLabel} onChange={e=>onChange({...plan,roomLabel:e.target.value})}/></label>
  {numberField('areaFrom',exact?'Площадь, м²':'Площадь от, м²')}
  {!exact&&numberField('areaTo','Площадь до, м²')}
  {numberField('priceFrom',exact?'Цена, ₽':'Цена от, ₽')}
  {exact&&<label className="controlField"><span>Цена за м², ₽</span><input aria-label="Цена планировки за квадратный метр" type="number" min="0.01" step="0.01" disabled={!plan.areaFrom} placeholder="Укажите точную площадь" value={unitDraft??squareMetreFromTotal(plan.priceFrom==null?null:propertyPriceRub(plan.priceFrom),plan.areaFrom)??''} onFocus={e=>setUnitDraft(e.target.value)} onBlur={()=>setUnitDraft(null)} onChange={e=>{
   setUnitDraft(e.target.value);
   unitInput.current=true;const total=totalFromSquareMetre(e.target.value===''?null:Number(e.target.value),plan.areaFrom);
   const price=total===null?null:total/1000000;onChange({...plan,priceFrom:price,priceTo:price});
  }}/></label>}
  {!exact&&numberField('priceTo','Цена до, ₽')}
  <label className="controlField"><span>Изображение · URL</span><input value={plan.imageUrl??''} onChange={e=>onChange({...plan,imageUrl:e.target.value||null})}/></label>
  <small style={{gridColumn:'1/-1'}}>{exact?'Одна планировка: своё изображение, точная площадь и цена. Другую планировку добавьте отдельной строкой.':'Группа вариантов: укажите границы площади и цены. Если верхняя цена неизвестна, оставьте её пустой.'}</small>
 </div>;
}
