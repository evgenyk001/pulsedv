import React from 'react';
import type {CatalogFreshness} from '../../../../packages/pulse-data/model';
import {businessDay,emptyFreshness,needsCatalogReview} from '../../../../packages/pulse-data/business';
export function CatalogFreshnessBadge({value}:{value?:CatalogFreshness}){
 const label=!value?.verifiedAt?'Не проверен':needsCatalogReview(value)?'Пора обновить':'Проверен';
 return <span className={'freshnessBadge '+(needsCatalogReview(value)?'reviewDue':'reviewFresh')}>{label}{value?.reviewDueOn?' · '+new Date(value.reviewDueOn+'T00:00:00').toLocaleDateString('ru-RU'):''}</span>;
}
export function CatalogFreshnessEditor({value,onChange,disabled=false,autoSave=false}:{value?:CatalogFreshness;onChange:(value:CatalogFreshness)=>void;disabled?:boolean;autoSave?:boolean}){
 const f={...emptyFreshness(),...value};
 const patch=(p:Partial<CatalogFreshness>)=>onChange({...f,...p});
 return <section className="catalogEditorSection" aria-label="Актуальность объекта"><div className="sectionHeading"><div><h3>Актуальность данных</h3><p>Источник, ответственный и срок следующей проверки. Эти сведения видны только в CRM.</p></div><CatalogFreshnessBadge value={f}/></div><fieldset className="formGrid editorFieldset" disabled={disabled}>
 <label className="controlField wide"><span>Источник цены и условий</span><input maxLength={1000} placeholder="Например: прайс застройщика или ссылка на источник" value={f.source} onChange={e=>patch({source:e.target.value})}/></label>
 <label className="controlField"><span>Ответственный за актуальность</span><input maxLength={200} placeholder="Имя сотрудника" value={f.responsible} onChange={e=>patch({responsible:e.target.value})}/></label>
 <label className="controlField"><span>Следующая проверка</span><input type="date" value={f.reviewDueOn||''} onChange={e=>patch({reviewDueOn:e.target.value||null})}/></label>
 <div className="wide freshnessActions"><span>{f.verifiedAt?'Проверено '+new Date(f.verifiedAt).toLocaleString('ru-RU',{timeZone:'Asia/Vladivostok'}):'Данные ещё не проверены'}</span><button type="button" className="secondaryAction" disabled={!f.source.trim()||!f.responsible.trim()} onClick={()=>patch({verifiedAt:new Date().toISOString(),reviewDueOn:needsCatalogReview(f)?businessDay(new Date(Date.now()+7*86400000)):f.reviewDueOn})}>Данные проверены сегодня</button><small>{autoSave?'Изменения сохраняются в этом браузере автоматически.':'Отметка применится после сохранения карточки.'} По умолчанию повторная проверка через 7 дней.</small></div>
 </fieldset></section>;
}
