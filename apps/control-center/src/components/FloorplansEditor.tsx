import React from 'react';
import {ChevronDown,ImageIcon,PackageOpen,Plus,Trash2,Upload,X} from 'lucide-react';
import type {PulseProperty} from '../../../../packages/pulse-data/model';
import {planPriceLabel} from '../../../../packages/domain/propertyPresentation';
import {buildingName} from '../../../../packages/domain/projectBuildings';
import {PlanBuildingEditor} from './ProjectStructureEditor';
import {PlanDimensionsEditor} from './PlanDimensionsEditor';
import {PlanFinishOptionsEditor} from './PlanFinishOptionsEditor';
import './floorplansEditor.css';
type Plan=PulseProperty['floorplans'][number];
const keyFor=(plan:Plan,index:number)=>plan.id||'plan-'+index;
function Preview({url}:{url:string|null}){
 const [broken,setBroken]=React.useState(false);
 React.useEffect(()=>setBroken(false),[url]);
 return <span className="controlPlanPreview">{url&&!broken?<img src={url} alt="" loading="lazy" onError={()=>setBroken(true)}/>:<span><ImageIcon size={24}/>Нет изображения</span>}</span>;
}
export function FloorplansEditor({property,onChange,onUpload,onRemoveImage,disabled=false}:{property:PulseProperty;onChange:(plans:Plan[])=>void;onUpload?:(file:File|undefined,id:string|undefined)=>void;onRemoveImage?:(id:string)=>void;disabled?:boolean}){
 const plans=property.floorplans;
 const [active,setActive]=React.useState<string|null>(null);
 const editor=React.useRef<HTMLDivElement>(null),heading=React.useRef<HTMLHeadingElement>(null);
 const prefix=React.useId(),panelId=prefix+'-editor';
 const activeIndex=plans.findIndex((plan,index)=>keyFor(plan,index)===active);
 React.useEffect(()=>{
  if(active===null)return;
  const frame=requestAnimationFrame(()=>{editor.current?.scrollIntoView({block:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});heading.current?.focus({preventScroll:true})});
  return()=>cancelAnimationFrame(frame);
 },[active]);
 const close=()=>{const trigger=document.getElementById(prefix+'-'+activeIndex);setActive(null);trigger?.focus({preventScroll:true})};
 const update=(index:number,next:Plan)=>onChange(plans.map((plan,i)=>i===index?next:plan));
 const add=()=>{const plan:Plan={id:crypto.randomUUID(),roomLabel:'1',areaFrom:null,areaTo:null,priceFrom:null,priceTo:null,isExact:true,imageUrl:null,finishType:null,finishOptions:[],sortOrder:plans.length};onChange([...plans,plan]);setActive(plan.id!)};
 const renderEditor=(plan:Plan,index:number)=><div className="editorRow floorplanEditor controlPlanEditor" id={panelId} ref={editor} key={'editor-'+keyFor(plan,index)} role="region" aria-label="Параметры планировки">
  <div className="controlPlanEditorHead"><div><small>ПЛАНИРОВКА {index+1}</small><h3 ref={heading} tabIndex={-1}>Параметры планировки</h3></div><button type="button" aria-label="Свернуть редактор планировки" onClick={close}><X size={18}/></button></div>
  <PlanBuildingEditor property={property} plan={plan} onChange={next=>update(index,next)}/>
  <PlanDimensionsEditor plan={plan} onChange={next=>update(index,next)}/>
  <PlanFinishOptionsEditor plan={plan} onChange={next=>update(index,next)}/>
  <div className="rowActions controlPlanEditorActions">
   {onUpload&&<label className="secondaryAction fileButton"><Upload size={14}/>Фото планировки<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{onUpload(e.target.files?.[0],plan.id);e.target.value=''}}/></label>}
   {onRemoveImage&&plan.imageUrl?.startsWith('/media/')&&plan.id&&<button type="button" className="textDanger" onClick={()=>onRemoveImage(plan.id!)}>Удалить фото</button>}
   <button type="button" className="textDanger" onClick={()=>{if(window.confirm('Удалить эту планировку из объекта?')){onChange(plans.filter((_,i)=>i!==index));setActive(null)}}}><Trash2 size={14}/>Удалить планировку</button>
   <button type="button" className="secondaryAction" onClick={close}>Свернуть</button>
  </div>
 </div>;
 return <section className="catalogEditorSection controlFloorplans" aria-label="Планировки объекта"><div className="catalogEditorSectionHead"><span><PackageOpen size={16}/></span><div><b>Планировки <em>{plans.length}</em></b><small>Выберите карточку, чтобы изменить параметры</small></div></div>
  <fieldset className="controlPlanFieldset" disabled={disabled}><div className="controlPlanGrid">{Array.from({length:Math.ceil(plans.length/2)},(_,row)=><React.Fragment key={keyFor(plans[row*2],row*2)}>
   {plans.slice(row*2,row*2+2).map((plan,offset)=>{const index=row*2+offset,key=keyFor(plan,index),opened=active===key;return <button type="button" id={prefix+'-'+index} className="controlPlanTile" key={key} aria-label={'Редактировать планировку '+(index+1)} aria-expanded={opened} aria-controls={opened?panelId:undefined} onClick={()=>opened?close():setActive(key)}>
    <Preview url={plan.imageUrl}/><span className="controlPlanTileCopy"><span><b>{plan.roomLabel==='Студия'?'Студия':plan.roomLabel+' комн.'}</b><ChevronDown size={15}/></span><strong>{plan.areaFrom===null?'Площадь уточняется':plan.areaFrom.toLocaleString('ru-RU')+(plan.areaTo&&plan.areaTo!==plan.areaFrom?'–'+plan.areaTo.toLocaleString('ru-RU'):'')+' м²'}</strong><span className="controlPlanPrice">{planPriceLabel(plan)}</span>{plan.buildingId&&<small>{buildingName(property,plan.buildingId)}{plan.sectionLabel?' · '+plan.sectionLabel:''}</small>}</span>
   </button>})}
   {activeIndex>=row*2&&activeIndex<row*2+2&&renderEditor(plans[activeIndex],activeIndex)}
  </React.Fragment>)}</div>
  {!plans.length&&<div className="catalogEditorEmpty">Планировок пока нет. Добавьте первую вручную или импортируйте CSV.</div>}
  <button type="button" className="secondaryAction controlPlanAdd" onClick={add}><Plus size={18}/>Добавить планировку</button></fieldset>
 </section>;
}
