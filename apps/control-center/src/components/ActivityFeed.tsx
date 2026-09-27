import React from 'react';
import { Activity, Search, Heart, Building2, Calculator, MessageCircle, MousePointer2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PulseEvent, PulseState } from '../../../../packages/pulse-data';
import { describeEvent } from '../activityCopy';
const categories=[['all','Все действия'],['interest','Интерес к ЖК'],['finance','Ипотека'],['contact','Контакты']] as const;
const category=(type:string)=>/mortgage/.test(type)?'finance':/lead_|contact/.test(type)?'contact':/property|floorplan|favorite|compare|select|catalog/.test(type)?'interest':'navigation';
export function ActivityFeed({events,state,compact=false}:{events:PulseEvent[];state:PulseState;compact?:boolean}){
 const [query,setQuery]=React.useState('');const [filter,setFilter]=React.useState('all');const [limit,setLimit]=React.useState(compact?6:30);
 const rows=React.useMemo(()=>[...events].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)).map(event=>({event,...describeEvent(event,state)})).filter(row=>(filter==='all'||category(row.event.eventType)===filter)&&`${row.title} ${row.detail} ${row.event.sessionId}`.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru'))),[events,state,filter,query]);
 return <div className="activityFeed">
  {!compact&&<div className="activityFilters"><label className="controlSearch"><Search size={16}/><input aria-label="Поиск действий" placeholder="ЖК, действие, параметры…" value={query} onChange={e=>{setQuery(e.target.value);setLimit(30)}}/></label><div className="filterChips">{categories.map(([key,label])=><button key={key} aria-pressed={filter===key} onClick={()=>{setFilter(key);setLimit(30)}}>{label}</button>)}</div></div>}
  {!rows.length&&<div className="emptyState"><Activity size={24}/><strong>{query||filter!=='all'?'По этим условиям действий нет':'Здесь появится история клиента'}</strong><span>Просмотры ЖК, параметры ипотеки, подбор и обращения — с деталями и временем.</span></div>}
  <ol className="activityRows">{rows.slice(0,limit).map(({event,title,detail},index)=>{
   const date=new Date(event.createdAt);const dateLabel=date.toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
   const prev=rows[index-1];const showDate=!compact&&(!prev||new Date(prev.event.createdAt).toDateString()!==date.toDateString());
   const Icon=/favorite/.test(event.eventType)?Heart:/mortgage/.test(event.eventType)?Calculator:/lead_|contact/.test(event.eventType)?MessageCircle:/property/.test(event.eventType)?Building2:MousePointer2;
   return <li key={event.id}>{showDate&&<div className="activityDay">{dateLabel}</div>}<div className="activityItem"><span className={'activityIcon '+category(event.eventType)}><Icon size={16}/></span><div><b>{title}</b><p>{detail}</p><Link to={'/users?session='+encodeURIComponent(event.sessionId)}>Посетитель {event.sessionId.slice(0,8)}</Link></div><time dateTime={event.createdAt} title={date.toLocaleString('ru-RU')}>{compact?date.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'})+' · ':''}{date.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</time></div></li>;
  })}</ol>
  {!compact&&rows.length>limit&&<button className="secondaryAction" onClick={()=>setLimit(limit+30)}>Показать ещё · осталось {rows.length-limit}</button>}
 </div>;
}
