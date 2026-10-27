import React from 'react';
import type {ProjectDetails} from '../../../../packages/pulse-data/model';
import {APARTMENT_FINISHES,canonicalApartmentFinish} from '../../../../packages/domain/propertyFinish';
const empty:ProjectDetails={commissioningDate:null,totalApartments:null,availableApartments:null,finishes:[]};
export function ProjectDetailsEditor({value,onChange,onValidityChange}:{value?:ProjectDetails;onChange:(value:ProjectDetails)=>void;onValidityChange?:(valid:boolean)=>void}){
 const [draft,setDraft]=React.useState({...empty,...value});
 const [error,setError]=React.useState('');
 React.useEffect(()=>{onValidityChange?.(!error)},[error,onValidityChange]);
 React.useEffect(()=>{setDraft({...empty,...value})},[value?.commissioningDate,value?.totalApartments,value?.availableApartments,value?.parkingSpaces,value?.floorsFrom,value?.floorsTo,value?.areaFrom,value?.areaTo,value?.finishes?.join('|')]);
 const commit=(next=draft)=>{
  if(next.totalApartments!==null&&next.availableApartments!==null&&next.availableApartments>next.totalApartments){setError('В продаже не может быть больше квартир, чем всего в ЖК.');return}
  if(next.floorsFrom!=null&&next.floorsTo!=null&&next.floorsFrom>next.floorsTo){setError('Этажность от не может превышать этажность до.');return}
  if(next.areaFrom!=null&&next.areaTo!=null&&next.areaFrom>next.areaTo){setError('Площадь от не может превышать площадь до.');return}
  for(const key of ['floorsFrom','floorsTo','areaFrom','areaTo'] as const){if(next[key]!=null&&next[key]!<=0){setError('Этажность и площадь должны быть больше нуля.');return}}
  for(const key of ['parkingSpaces','floorsFrom','floorsTo','areaFrom','areaTo'] as const){
   const n=next[key];if(n==null)continue;
   const max=key==='parkingSpaces'?2000000:key.startsWith('floors')?200:10000;
   if(n>max||(key==='parkingSpaces'&&n<0)||(!key.startsWith('area')&&!Number.isInteger(n))){setError('Проверьте значения: этажи и парковочные места указываются целым числом в допустимом диапазоне.');return}
  }
  setError('');onChange(next);
 };
 return <section className="catalogEditorSection"><div className="catalogEditorSectionHead"><div><b>Характеристики ЖК</b><small>Точные данные для страницы ЖК. Пустое поле означает, что данные ещё не подтверждены.</small></div></div>
  <div className="formGrid">
   <label className="controlField"><span>Плановая дата ввода дома</span><input type="date" value={draft.commissioningDate??''} onChange={e=>setDraft(v=>({...v,commissioningDate:e.target.value||null}))} onBlur={()=>commit()}/></label>
   {(['totalApartments','availableApartments'] as const).map(key=><label className="controlField" key={key}><span>{key==='totalApartments'?'Всего квартир в ЖК':'Квартир в продаже'}</span><input inputMode="numeric" maxLength={7} value={draft[key]??''} onChange={e=>{const text=e.target.value.replace(/\D/g,'');setDraft(v=>({...v,[key]:text?Math.min(2_000_000,Number(text)):null}))}} onBlur={()=>commit()}/></label>)}
   {([['parkingSpaces','Парковочных мест',0,2000000,1],['floorsFrom','Этажность от',1,200,1],['floorsTo','Этажность до',1,200,1],['areaFrom','Площадь квартир от, м²',0.01,10000,0.01],['areaTo','Площадь квартир до, м²',0.01,10000,0.01]] as const).map(([key,label,min,max,step])=><label className="controlField" key={key}><span>{label}</span><input type="number" min={min} max={max} step={step} value={draft[key]??''} onChange={e=>{const n=e.target.value===''?null:Number(e.target.value);if(n===null||Number.isFinite(n))setDraft(v=>({...v,[key]:n}))}} onBlur={()=>commit()}/></label>)}
  </div>
  <p style={{fontSize:12,opacity:.72}}>Для одного корпуса укажите одинаковую этажность от и до. Если площади не заполнены, диапазон рассчитается по планировкам. Парковка: 0 — мест нет, пустое поле — количество уточняется.</p>
  <fieldset className="controlField" style={{border:0,padding:0,margin:'14px 0 0'}}>
   <legend style={{fontSize:12,fontWeight:700,marginBottom:8}}>Варианты отделки в ЖК</legend>
   <p style={{fontSize:11,opacity:.72,margin:'0 0 10px'}}>Отмечайте только подтверждённые застройщиком варианты. Цены для конкретных планировок задаются ниже.</p>
   <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
    {APARTMENT_FINISHES.map(([finish,label])=><label key={finish} className="finishChoice" style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12,whiteSpace:'nowrap',minHeight:32}}>
     <input type="checkbox" checked={(draft.finishes??[]).some(value=>canonicalApartmentFinish(value)===finish)} onChange={e=>{const next={...draft,finishes:e.target.checked?[...(draft.finishes??[]).filter(x=>canonicalApartmentFinish(x)!==finish),finish]:(draft.finishes??[]).filter(x=>canonicalApartmentFinish(x)!==finish)};setDraft(next);commit(next)}}/>{label}
    </label>)}
   </div>
  </fieldset>
  {error&&<p role="alert">{error}</p>}
 </section>;
}
