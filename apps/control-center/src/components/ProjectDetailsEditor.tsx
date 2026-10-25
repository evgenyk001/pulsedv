import React from 'react';
import type {ProjectDetails} from '../../../../packages/pulse-data/model';
const empty:ProjectDetails={commissioningDate:null,totalApartments:null,availableApartments:null};
export function ProjectDetailsEditor({value,onChange}:{value?:ProjectDetails;onChange:(value:ProjectDetails)=>void}){
 const [draft,setDraft]=React.useState({...empty,...value});
 const [error,setError]=React.useState('');
 React.useEffect(()=>{setDraft({...empty,...value})},[value?.commissioningDate,value?.totalApartments,value?.availableApartments]);
 const commit=()=>{
  if(draft.totalApartments!==null&&draft.availableApartments!==null&&draft.availableApartments>draft.totalApartments){setError('В продаже не может быть больше квартир, чем всего в ЖК.');setDraft({...empty,...value});return}
  setError('');onChange(draft);
 };
 return <section className="catalogEditorSection"><div className="catalogEditorSectionHead"><div><b>Ввод дома и квартиры</b><small>Точные данные для страницы ЖК. Пустое поле означает, что данные ещё не подтверждены.</small></div></div>
  <div className="formGrid">
   <label className="controlField"><span>Плановая дата ввода дома</span><input type="date" value={draft.commissioningDate??''} onChange={e=>setDraft(v=>({...v,commissioningDate:e.target.value||null}))} onBlur={commit}/></label>
   {(['totalApartments','availableApartments'] as const).map(key=><label className="controlField" key={key}><span>{key==='totalApartments'?'Всего квартир в ЖК':'Квартир в продаже'}</span><input inputMode="numeric" maxLength={7} value={draft[key]??''} onChange={e=>{const text=e.target.value.replace(/\D/g,'');setDraft(v=>({...v,[key]:text?Math.min(2_000_000,Number(text)):null}))}} onBlur={commit}/></label>)}
  </div>{error&&<p role="alert">{error}</p>}
 </section>;
}
