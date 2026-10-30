import React from 'react';
import {Building2,Map,ChevronRight} from 'lucide-react';
import type {PulseProperty} from '../../../../packages/pulse-data/model';
import {buildingDelivery,buildingPrice,BUILDING_STATUSES} from '../../../../packages/domain/projectBuildings';
import {dimensionRange} from '../../../../packages/domain/propertyDimensions';
import {propertyPriceLabel} from '../../../../packages/domain/propertyPresentation';
import {Sheet,SheetTrigger,SheetContent,SheetHeader,SheetTitle} from './Sheet';
import './projectBuildings.css';
const date=(value:string)=>new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z'));
export function ProjectBuildings({property,selected,onSelect}:{property:PulseProperty;selected:string;onSelect:(id:string)=>void}){
 const [all,setAll]=React.useState(false),[broken,setBroken]=React.useState(false),[zoom,setZoom]=React.useState(1);
 const buildings=property.projectDetails?.buildings??[],masterplan=property.projectDetails?.masterplanUrl;
 React.useEffect(()=>setBroken(false),[masterplan]);
 if(!buildings.length&&!masterplan)return null;
 const active=buildings.find(b=>b.id===selected),visible=all?buildings:buildings.slice(0,6);
 return <section className="pulseBuildings" aria-label="Корпуса и очереди ЖК">
  <div className="pulseBuildingsHeading"><span><Building2 size={18}/></span><div><small>СТРУКТУРА ПРОЕКТА</small><h2>{buildings.length?'Корпуса и очереди':'Генплан проекта'}</h2></div></div>
  {masterplan&&<Sheet onOpenChange={()=>setZoom(1)}><SheetTrigger asChild><button className="pulseMasterplanButton"><Map size={18}/>Посмотреть генплан<ChevronRight size={16}/></button></SheetTrigger><SheetContent side="right" className="pulseMasterplanSheet"><SheetHeader><SheetTitle>Генплан · {property.name}</SheetTitle></SheetHeader>{broken?<p>Изображение не загрузилось. Менеджер поможет с расположением корпусов.</p>:<><div className="pulseMasterplanTools"><button aria-label="Уменьшить генплан" disabled={zoom===1} onClick={()=>setZoom(v=>Math.max(1,v-.5))}>−</button><span>{zoom*100}%</span><button aria-label="Увеличить генплан" disabled={zoom===3} onClick={()=>setZoom(v=>Math.min(3,v+.5))}>+</button></div><div className="pulseMasterplanImage" tabIndex={0} aria-label="Генплан с прокруткой"><img style={{width:zoom*100+'%',maxWidth:'none'}} src={masterplan} alt={'Генплан '+property.name} loading="lazy" onError={()=>setBroken(true)}/></div></>}</SheetContent></Sheet>}
  {buildings.length>0&&<><p className="pulseBuildingsHint">Выберите корпус — ниже будут его планировки и цены. Ввод дома и передача ключей указаны отдельно.</p>
   <label className="pulseBuildingSelect"><span>Корпус</span><select aria-label="Выбрать корпус" value={selected} onChange={e=>onSelect(e.target.value)}><option value="">Все корпуса</option>{buildings.map(b=><option key={b.id} value={b.id}>{b.name}{b.phase?' · '+b.phase:''}</option>)}</select></label>
   <div className="pulseBuildingGrid">{visible.map(b=>{const price=buildingPrice(property,b.id);return <button key={b.id} aria-pressed={selected===b.id} onClick={()=>onSelect(selected===b.id?'':b.id)}><span className="pulseBuildingStatus">{BUILDING_STATUSES.find(([key])=>key===b.status)?.[1]}</span><strong>{b.name}</strong>{b.phase&&<small>{b.phase}</small>}<span>{buildingDelivery(b)}</span><b>{price===null?'Цена уточняется':propertyPriceLabel(price)}</b></button>})}</div>
   {buildings.length>6&&<button className="pulseBuildingMore" onClick={()=>setAll(!all)}>{all?'Свернуть список':'Все корпуса · '+buildings.length}</button>}
   {active&&<div className="pulseBuildingFacts" role="region" aria-label="Характеристики выбранного корпуса"><h3>{active.name}</h3><dl>
    {([
     ['Срок сдачи',buildingDelivery(active)],['Очередь',active.phase],['Секции',active.sections],['Адрес',active.address],
     ['Плановый ввод',active.commissioningDate?date(active.commissioningDate):null],['Передача ключей',active.handoverDate?date(active.handoverDate):null],
     ['Технология',active.constructionType],['Потолки от',active.ceilingHeight?active.ceilingHeight.toLocaleString('ru-RU')+' м':null],['Этажность',dimensionRange(active.floorsFrom,active.floorsTo)],['Всего квартир',active.totalApartments?.toLocaleString('ru-RU')],['Квартир в продаже',active.availableApartments?.toLocaleString('ru-RU')]
    ] as const).filter(([,value])=>value!==null&&value!==undefined&&value!=='').map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
   </dl></div>}
  </>}
 </section>;
}
