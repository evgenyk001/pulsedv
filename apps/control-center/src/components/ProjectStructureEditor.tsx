import React from 'react';
import {Building2,Plus,Trash2,ChevronDown,ArrowUp,ArrowDown} from 'lucide-react';
import type {PulseProperty,ProjectBuilding} from '../../../../packages/pulse-data/model';
import {BUILDING_STATUSES,buildingDelivery} from '../../../../packages/domain/projectBuildings';

const freshBuilding=(index:number):ProjectBuilding=>({id:crypto.randomUUID(),name:'Корпус '+index,phase:'',sections:'',status:'unknown',address:null,deliveryYear:null,deliveryQuarter:null,commissioningDate:null,handoverDate:null,floorsFrom:null,floorsTo:null,totalApartments:null,availableApartments:null});
export function structureError(property:PulseProperty){
 const details=property.projectDetails,buildings=details?.buildings??[];
 if(buildings.some(b=>!b.name.trim()))return 'Укажите название каждого корпуса.';
 if(new Set(buildings.map(b=>b.name.trim().toLowerCase())).size!==buildings.length)return 'Названия корпусов должны различаться.';
 for(const b of buildings){
  if(b.ceilingHeight!=null&&(b.ceilingHeight<1.8||b.ceilingHeight>10))return 'Высота потолков корпуса: от 1,8 до 10 м.';
  if(b.deliveryQuarter&&!b.deliveryYear)return 'Укажите год сдачи для выбранного квартала.';
  if(b.deliveryYear!==null&&(!Number.isInteger(b.deliveryYear)||b.deliveryYear<2000||b.deliveryYear>2200))return 'Проверьте год сдачи корпуса.';
  for(const [key,max] of [['floorsFrom',200],['floorsTo',200],['totalApartments',2000000],['availableApartments',2000000]] as const){const n=b[key];if(n!==null&&(!Number.isInteger(n)||n<(key.startsWith('floors')?1:0)||n>max))return 'Проверьте этажность и количество квартир корпуса.';}
  if(b.floorsFrom!==null&&b.floorsTo!==null&&b.floorsFrom>b.floorsTo)return 'Этажность от не может превышать этажность до.';
  if(b.totalApartments!==null&&b.availableApartments!==null&&b.availableApartments>b.totalApartments)return 'В продаже не может быть больше квартир, чем всего в корпусе.';
  if(b.commissioningDate&&b.handoverDate&&b.handoverDate<b.commissioningDate)return 'Передача ключей не может быть раньше ввода корпуса.';
 }
 if(details?.ceilingHeight!=null&&(details.ceilingHeight<1.8||details.ceilingHeight>10))return 'Высота потолков: от 1,8 до 10 м.';
 if(details?.masterplanUrl){try{if(!details.masterplanUrl.startsWith('/media/')&&new URL(details.masterplanUrl).protocol!=='https:')return 'Для генплана нужна HTTPS-ссылка.'}catch{return 'Для генплана нужна HTTPS-ссылка.'}}
 return '';
}
export function ProjectStructureEditor({property,onChange,onValidityChange}:{property:PulseProperty;onChange:(patch:Partial<PulseProperty>)=>void;onValidityChange:(valid:boolean)=>void}){
 const details=property.projectDetails??{commissioningDate:null,totalApartments:null,availableApartments:null},buildings=details.buildings??[];
 const error=structureError(property);
 React.useEffect(()=>onValidityChange(!error),[error,onValidityChange]);
 const patch=(values:Partial<typeof details>)=>onChange({projectDetails:{...details,...values}});
 const update=(id:string,values:Partial<ProjectBuilding>)=>patch({buildings:buildings.map(b=>b.id===id?{...b,...values}:b)});
 const remove=(b:ProjectBuilding)=>{
  const linked=property.floorplans.filter(p=>p.buildingId===b.id).length;
  if(!window.confirm('Удалить «'+b.name+'»?'+(linked?' Его планировки сохранятся без привязки к корпусу.':'')))return;
  onChange({projectDetails:{...details,buildings:buildings.filter(x=>x.id!==b.id)},floorplans:property.floorplans.map(p=>p.buildingId===b.id?{...p,buildingId:null}:p)});
 };
 const move=(index:number,delta:number)=>{const next=[...buildings];[next[index],next[index+delta]]=[next[index+delta],next[index]];patch({buildings:next})};
 const addBuilding=()=>{let index=buildings.length+1;while(buildings.some(b=>b.name===('Корпус '+index)))index++;patch({buildings:[...buildings,freshBuilding(index)]})};
 const unassigned=property.floorplans.filter(p=>!p.buildingId).length;
 return <section className="catalogEditorSection projectStructure" aria-label="Структура проекта">
  <div className="catalogEditorSectionHead"><span><Building2 size={18}/></span><div><b>Корпуса и очереди</b><small>Один ЖК — несколько домов с собственными сроками и планировками</small></div><button type="button" disabled={buildings.length>=100} onClick={addBuilding}><Plus size={16}/>Добавить корпус</button></div>
  {!buildings.length&&<p className="structureHint">Для одного дома этот раздел можно оставить пустым. Общие данные ЖК продолжат работать как раньше.</p>}
  {buildings.length>0&&<p className="structureHint">Сначала добавьте корпуса, затем привяжите к ним планировки ниже. Общий срок ЖК остаётся обзорной подписью; сроки корпусов показываются отдельно.{unassigned>0?' Без корпуса: '+unassigned+' планировок.':''}</p>}
  <div className="buildingEditorList">{buildings.map((b,index)=><details className="buildingEditor" key={b.id} open={buildings.length===1?true:undefined}>
   <summary><Building2 size={18}/><div><b>{b.name||'Без названия'}</b><small>{[b.phase,buildingDelivery(b)].filter(Boolean).join(' · ')}</small></div><ChevronDown size={17}/></summary>
   <div className="buildingEditorBody"><div className="formGrid">
    {([['name','Название корпуса'],['phase','Очередь / этап'],['sections','Секции корпуса'],['address','Адрес корпуса']] as const).map(([key,label])=><label className="controlField" key={key}><span>{label}</span><input maxLength={key==='address'?400:120} value={b[key]??''} onChange={e=>update(b.id,{[key]:e.target.value||(key==='address'?null:'')})}/></label>)}
    <label className="controlField"><span>Состояние корпуса</span><select value={b.status} onChange={e=>update(b.id,{status:e.target.value as ProjectBuilding['status']})}>{BUILDING_STATUSES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label className="controlField"><span>Квартал сдачи</span><select value={b.deliveryQuarter??''} onChange={e=>update(b.id,{deliveryQuarter:e.target.value?Number(e.target.value):null})}><option value="">Уточняется</option>{[1,2,3,4].map(q=><option key={q} value={q}>{q} квартал</option>)}</select></label>
    <label className="controlField"><span>Год сдачи</span><input type="number" min={2000} max={2200} value={b.deliveryYear??''} onChange={e=>update(b.id,{deliveryYear:e.target.value?Number(e.target.value):null})}/></label>
    {([['commissioningDate','Плановый ввод корпуса'],['handoverDate','Передача ключей по договору']] as const).map(([key,label])=><label className="controlField" key={key}><span>{label}</span><input type="date" value={b[key]??''} onChange={e=>update(b.id,{[key]:e.target.value||null})}/></label>)}
    {([['floorsFrom','Этажность от'],['floorsTo','Этажность до'],['totalApartments','Всего квартир в корпусе'],['availableApartments','Квартир в продаже в корпусе']] as const).map(([key,label])=><label className="controlField" key={key}><span>{label}</span><input type="number" min={key.startsWith('floors')?1:0} max={key.startsWith('floors')?200:2000000} value={b[key]??''} onChange={e=>update(b.id,{[key]:e.target.value!==''?Number(e.target.value):null})}/></label>)}
    <label className="controlField"><span>Технология корпуса · если отличается</span><input maxLength={200} value={b.constructionType??''} onChange={e=>update(b.id,{constructionType:e.target.value||null})}/></label>
    <label className="controlField"><span>Потолки корпуса от, м · если отличаются</span><input type="number" min={1.8} max={10} step={0.01} value={b.ceilingHeight??''} onChange={e=>update(b.id,{ceilingHeight:e.target.value?Number(e.target.value):null})}/></label>
   </div><p className="structureHint">Ввод и передача ключей — разные даты. Заполняйте только подтверждённые сведения; пустые значения останутся «уточняется».</p>
   <div className="buildingEditorActions"><span>{property.floorplans.filter(p=>p.buildingId===b.id).length} планировок</span><button type="button" aria-label={'Выше: '+b.name} disabled={!index} onClick={()=>move(index,-1)}><ArrowUp size={16}/></button><button type="button" aria-label={'Ниже: '+b.name} disabled={index===buildings.length-1} onClick={()=>move(index,1)}><ArrowDown size={16}/></button><button type="button" className="textDanger" onClick={()=>remove(b)}><Trash2 size={15}/>Удалить корпус</button></div>
   </div>
  </details>)}</div>
  <details className="projectExtraFields"><summary>Генплан и дополнительные параметры ЖК</summary><div className="formGrid">
   <label className="controlField wide"><span>Генплан · HTTPS URL или /media/</span><input maxLength={2048} list="project-gallery-images" value={details.masterplanUrl??''} onChange={e=>patch({masterplanUrl:e.target.value||null})}/><small>Загрузите генплан в «Фото объекта» и выберите его ссылку здесь.</small></label>
   <datalist id="project-gallery-images">{property.images.map(image=><option key={image.url} value={image.url}>{image.alt}</option>)}</datalist>
   <label className="controlField"><span>Технология строительства</span><input maxLength={200} placeholder="Например, монолитно-кирпичный" value={details.constructionType??''} onChange={e=>patch({constructionType:e.target.value||null})}/></label>
   <label className="controlField"><span>Высота потолков от, м</span><input type="number" min={1.8} max={10} step={0.01} value={details.ceilingHeight??''} onChange={e=>patch({ceilingHeight:e.target.value?Number(e.target.value):null})}/></label>
   <label className="controlField"><span>Парковка</span><select value={details.parkingType??''} onChange={e=>patch({parkingType:(e.target.value||null) as typeof details.parkingType})}><option value="">Уточняется</option><option value="underground">Подземная</option><option value="multilevel">Многоуровневая</option><option value="surface">Наземная</option><option value="mixed">Несколько видов</option></select></label>
  </div></details>
  {error&&<p className="errorNotice" role="alert">{error}</p>}
 </section>;
}
export function PlanBuildingEditor({property,plan,onChange}:{property:PulseProperty;plan:PulseProperty['floorplans'][number];onChange:(plan:PulseProperty['floorplans'][number])=>void}){
 const buildings=property.projectDetails?.buildings??[];
 if(!buildings.length)return null;
 return <div className="formGrid planBuildingFields"><label className="controlField"><span>Корпус планировки</span><select aria-label="Корпус планировки" value={plan.buildingId??''} onChange={e=>onChange({...plan,buildingId:e.target.value||null})}><option value="">Не привязана к корпусу</option>{buildings.map(b=><option key={b.id} value={b.id}>{b.name}{b.phase?' · '+b.phase:''}</option>)}</select></label><label className="controlField"><span>Секция планировки</span><input aria-label="Секция планировки" maxLength={80} value={plan.sectionLabel??''} onChange={e=>onChange({...plan,sectionLabel:e.target.value||null})}/></label></div>;
}
