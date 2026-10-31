import React from 'react';
import {CheckSquare,Trash2,X} from 'lucide-react';
import type {PulseProperty} from '../../../../packages/pulse-data/model';
export type CatalogSelectionItem=Pick<PulseProperty,'id'|'name'|'city'>;
const LIMIT=100;
export function useCatalogSelection(resetKey:string){
 const [mode,setMode]=React.useState(false),[items,setItems]=React.useState<Map<string,CatalogSelectionItem>>(()=>new Map());
 React.useEffect(()=>setItems(new Map()),[resetKey]);
 const toggle=(item:CatalogSelectionItem)=>setItems(current=>{const next=new Map(current);if(next.has(item.id))next.delete(item.id);else if(next.size<LIMIT)next.set(item.id,{id:item.id,name:item.name,city:item.city});return next});
 const remove=(ids:string[])=>setItems(current=>{const next=new Map(current);ids.forEach(id=>next.delete(id));return next});
 const page=(visible:CatalogSelectionItem[])=>setItems(current=>{const next=new Map(current),all=visible.length>0&&visible.every(p=>next.has(p.id));for(const p of visible){if(all)next.delete(p.id);else if(next.size<LIMIT)next.set(p.id,{id:p.id,name:p.name,city:p.city})}return next});
 const cancel=()=>{setMode(false);setItems(new Map())};
 return {mode,setMode,items,toggle,remove,page,cancel};
}
export function confirmCatalogDelete(items:CatalogSelectionItem[],dirty=false){
 if(!items.length)return false;
 return window.confirm('Удалить '+items.length+' ЖК из каталога?\n\n'+items.slice(0,10).map(p=>'• '+p.name+' · '+p.city).join('\n')+(items.length>10?'\n…и ещё '+(items.length-10):'')+'\n\nУдалятся карточки ЖК, их фото, планировки и документы. Обращения и переписка сохранятся, но карточки удалённых ЖК станут недоступны. Отменить удаление нельзя.'+(dirty?'\nНесохранённые правки карточки будут потеряны.':''));
}
export function CatalogSelectionBar({selection,visible,busy=false,loading=false,progress,onDelete}:{selection:ReturnType<typeof useCatalogSelection>;visible:CatalogSelectionItem[];busy?:boolean;loading?:boolean;progress?:string;onDelete:()=>void}){
 const entries=Array.from(selection.items.values()),all=visible.length>0&&visible.every(p=>selection.items.has(p.id));
 const capacity=selection.items.size+visible.filter(p=>!selection.items.has(p.id)).length<=LIMIT;
 return <div className="catalogSelectionBar" role="region" aria-label="Управление выбором объектов">
  {!selection.mode?<button className="secondaryAction" disabled={busy||loading||!visible.length} onClick={()=>selection.setMode(true)}><CheckSquare size={16}/>Выбрать объекты</button>:<>
   <div className="catalogSelectionActions"><strong aria-live="polite">{progress||'Выбрано: '+entries.length+' / '+LIMIT}</strong><button className="secondaryAction" disabled={busy||loading||!visible.length||(!all&&!capacity)} onClick={()=>selection.page(visible)}>{all?'Снять выбор на странице':'Выбрать страницу'}</button><button className="catalogDeleteAction" disabled={busy||!entries.length} onClick={onDelete}><Trash2 size={16}/>Удалить выбранные{entries.length?' · '+entries.length:''}</button><button className="secondaryAction" disabled={busy} onClick={selection.cancel}><X size={16}/>Отмена выбора</button></div>
   {!capacity&&!all&&<small>За один раз можно выбрать до {LIMIT} объектов.</small>}
   {entries.length>0&&<details><summary>Проверить выбранные объекты · {entries.length}</summary><ul>{entries.map(p=><li key={p.id}><span><b>{p.name}</b><small>{p.city}</small></span><button type="button" aria-label={'Снять выбор: '+p.name} disabled={busy} onClick={()=>selection.toggle(p)}><X size={16}/></button></li>)}</ul></details>}
   <p>Выбор сохраняется при переходе между страницами. Смена города, поиска или фильтра сбрасывает выбор.</p>
  </>}
 </div>;
}
export function CatalogSelectionCheck({selection,item,busy=false}:{selection:ReturnType<typeof useCatalogSelection>;item:CatalogSelectionItem;busy?:boolean}){
 if(!selection.mode)return null;
 return <label className="catalogSelectionCheck"><input type="checkbox" aria-label={'Выбрать ЖК: '+item.name} checked={selection.items.has(item.id)} disabled={busy||(!selection.items.has(item.id)&&selection.items.size>=LIMIT)} onChange={()=>selection.toggle(item)}/></label>;
}
