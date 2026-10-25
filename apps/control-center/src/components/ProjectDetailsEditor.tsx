import React from 'react';
import type {ProjectDetails} from '../../../../packages/pulse-data/model';
import {APARTMENT_FINISHES} from '../../../../packages/domain/propertyFinish';
const empty:ProjectDetails={commissioningDate:null,totalApartments:null,availableApartments:null,finishes:[]};
export function ProjectDetailsEditor({value,onChange}:{value?:ProjectDetails;onChange:(value:ProjectDetails)=>void}){
 const [draft,setDraft]=React.useState({...empty,...value});
 const [error,setError]=React.useState('');
 React.useEffect(()=>{setDraft({...empty,...value})},[value?.commissioningDate,value?.totalApartments,value?.availableApartments,value?.finishes?.join('|')]);
 const commit=()=>{
  if(draft.totalApartments!==null&&draft.availableApartments!==null&&draft.availableApartments>draft.totalApartments){setError('В продаже не может быть больше квартир, чем всего в ЖК.');setDraft({...empty,...value});return}
  setError('');onChange(draft);
 };
 return <section className="catalogEditorSection"><div className="catalogEditorSectionHead"><div><b>Ввод дома и квартиры</b><small>Точные данные для страницы ЖК. Пустое поле означает, что данные ещё не подтверждены.</small></div></div>
  <div className="formGrid">
   <label className="controlField"><span>Плановая дата ввода дома</span><input type="date" value={draft.commissioningDate??''} onChange={e=>setDraft(v=>({...v,commissioningDate:e.target.value||null}))} onBlur={commit}/></label>
   {(['totalApartments','availableApartments'] as const).map(key=><label className="controlField" key={key}><span>{key==='totalApartments'?'Всего квартир в ЖК':'Квартир в продаже'}</span><input inputMode="numeric" maxLength={7} value={draft[key]??''} onChange={e=>{const text=e.target.value.replace(/\D/g,'');setDraft(v=>({...v,[key]:text?Math.min(2_000_000,Number(text)):null}))}} onBlur={commit}/></label>)}
  </div>
  <fieldset className="controlField" style={{border:0,padding:0,margin:'14px 0 0'}}>
   <legend style={{fontSize:12,fontWeight:700,marginBottom:8}}>Варианты отделки в ЖК</legend>
   <p style={{fontSize:11,opacity:.72,margin:'0 0 10px'}}>Отмечайте только подтверждённые застройщиком варианты. Цены для конкретных планировок задаются ниже.</p>
   <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
    {APARTMENT_FINISHES.map(([finish,label])=><label key={finish} style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12}}>
     <input type="checkbox" checked={(draft.finishes??[]).includes(finish)} onChange={e=>{const next={...draft,finishes:e.target.checked?[...(draft.finishes??[]),finish]:(draft.finishes??[]).filter(x=>x!==finish)};setDraft(next);setError('');onChange(next)}}/>{label}
    </label>)}
   </div>
  </fieldset>
  {error&&<p role="alert">{error}</p>}
 </section>;
}
