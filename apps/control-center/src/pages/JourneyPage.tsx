import React from 'react';
import {Link} from 'react-router-dom';
import {AlertTriangle,Building2,CalendarDays,CheckCircle2,ChevronRight,Clock3,RefreshCw,ShieldCheck} from 'lucide-react';
import {PageFrame} from '../components/PageFrame';
import {usePulseLeads,usePulseState} from '../data';
import {loadJourneys,loadVerifications,verifyProperty,type JourneyEntry} from '../../../../packages/journey/client';
import {staleVerification,showingLabels,type Verification} from '../../../../packages/journey/model';
import {runtime} from '../../../../packages/pulse-data/runtime';
import '../../../../packages/journey/journey.css';

const when=(value:string)=>new Date(value).toLocaleString('ru-RU',{timeZone:'Asia/Vladivostok',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
const dateLabel=(value:string)=>new Date(value).toLocaleDateString('ru-RU',{timeZone:'Asia/Vladivostok',day:'2-digit',month:'long',year:'numeric'});

export function JourneyPage(){
 const leads=usePulseLeads(),state=usePulseState();
 const [items,setItems]=React.useState<JourneyEntry[]>([]),[checks,setChecks]=React.useState<Verification[]>([]),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false),[notes,setNotes]=React.useState<Record<string,string>>({}),[day,setDay]=React.useState('');
 const reload=async()=>{try{const [j,v]=await Promise.all([loadJourneys(),loadVerifications()]);setItems(j.items);setChecks(v);setError(j.limited?'Показаны последние 1000 обращений':'')}catch(e){setError((e as Error).message)}};
 React.useEffect(()=>{void reload()},[]);

 const active=items.filter(item=>!['deal','closed','lost'].includes(item.status));
 const missing=active.filter(item=>!item.journey.nextStep||item.journey.nextStep.done);
 const planned=active.filter(item=>item.journey.nextStep&&!item.journey.nextStep.done).sort((a,b)=>Date.parse(a.journey.nextStep!.dueAt)-Date.parse(b.journey.nextStep!.dueAt));
 const allShowings=items.flatMap(entry=>entry.journey.showings.map(showing=>({...showing,leadId:entry.leadId}))).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
 const upcoming=allShowings.filter(showing=>!day||new Date(showing.at).toLocaleDateString('en-CA',{timeZone:'Asia/Vladivostok'})===day);
 const published=state.properties.filter(property=>property.status==='published');
 const staleCount=published.filter(property=>staleVerification(checks.find(check=>check.propertyId===property.id))).length;
 const name=(id:string)=>items.find(item=>item.leadId===id)?.leadName||leads.find(lead=>lead.id===id)?.name||'Клиент';
 const check=async(id:string)=>{setBusy(true);setError('');try{await verifyProperty(id,notes[id]??checks.find(v=>v.propertyId===id)?.note??'',checks.find(v=>v.propertyId===id)?.revision||0);await reload()}catch(e){setError((e as Error).message)}finally{setBusy(false)}};

 return <PageFrame eyebrow="ОТ ПОДБОРА ДО ПОКАЗА" title="Сопровождение клиентов" description="Следующие шаги, встречи и актуальность объектов — в одном рабочем экране." action={<button className="secondaryAction" disabled={busy} onClick={()=>void reload()}><RefreshCw size={15}/>Обновить</button>}>
  <section className="journeySummaryGrid" aria-label="Сводка сопровождения">
   <article><span className="journeyMetricIcon attention"><Clock3 size={17}/></span><div><small>Без следующего шага</small><strong>{missing.length}</strong><span>нужно запланировать действие</span></div></article>
   <article><span className="journeyMetricIcon"><CalendarDays size={17}/></span><div><small>Показы</small><strong>{allShowings.length}</strong><span>встреч в истории сопровождения</span></div></article>
   {(!runtime.enabled||runtime.member?.role!=='manager')&&<article><span className="journeyMetricIcon verified"><ShieldCheck size={17}/></span><div><small>Актуальность объектов</small><strong>{staleCount}</strong><span>требуют повторной проверки</span></div></article>}
  </section>

  {error&&<div className="errorNotice" role="alert">{error}</div>}

  <section className="panel journeyWorkspace">
   <div className="sectionHeading"><div><span className="kicker">РАБОЧАЯ ОЧЕРЕДЬ</span><h2>Следующие действия</h2></div><span className="countBadge">{active.length}</span></div>
   <div className="journeyQueueColumns">
    <div className="journeyQueueGroup">
     <div className="journeyQueueTitle"><span className="journeyMetricIcon attention"><AlertTriangle size={15}/></span><div><b>Нужно запланировать</b><small>{missing.length?missing.length+' клиентов без следующего шага':'У всех активных клиентов есть план'}</small></div></div>
     <div className="journeyQueueList">
      {!missing.length&&<div className="journeyEmpty"><CheckCircle2 size={20}/><span>Очередь разобрана</span></div>}
      {missing.map(entry=><Link className="journeyQueueRow" key={entry.leadId} to={'/leads?lead='+entry.leadId}><div><b>{entry.leadName||name(entry.leadId)}</b><small>{entry.status==='new'?'Новое обращение':'Нужен следующий шаг'}</small></div><ChevronRight size={16}/></Link>)}
     </div>
    </div>
    <div className="journeyQueueGroup">
     <div className="journeyQueueTitle"><span className="journeyMetricIcon"><Clock3 size={15}/></span><div><b>Запланировано</b><small>Ближайшие обязательства команды</small></div></div>
     <div className="journeyQueueList">
      {!planned.length&&<div className="journeyEmpty"><CheckCircle2 size={20}/><span>Нет запланированных действий</span></div>}
      {planned.map(entry=>{const step=entry.journey.nextStep!,late=Date.parse(step.dueAt)<Date.now();return <Link className="journeyQueueRow" key={entry.leadId} to={'/leads?lead='+entry.leadId}><div><b>{entry.leadName||name(entry.leadId)}</b><small>{step.title}</small><time className={late?'journeyLate':''}>{when(step.dueAt)}{late?' · просрочено':''}</time></div><ChevronRight size={16}/></Link>})}
     </div>
    </div>
   </div>
  </section>

  <section className="panel journeyWorkspace">
   <div className="sectionHeading"><div><span className="kicker">ВСТРЕЧИ</span><h2>Календарь показов</h2></div><span className="countBadge">{upcoming.length}</span></div>
   <div className="journeyToolbar"><label><span>День по Владивостоку</span><input type="date" value={day} onChange={e=>setDay(e.target.value)}/></label>{day&&<button className="secondaryAction" onClick={()=>setDay('')}>Все даты</button>}</div>
   <div className="journeyShowingList">
    {!upcoming.length&&<div className="journeyEmpty large"><CalendarDays size={24}/><b>Показов на выбранную дату нет</b><span>Когда встреча будет назначена, она появится здесь.</span></div>}
    {upcoming.map(showing=>{const property=state.properties.find(p=>p.id===showing.propertyId);return <article className="journeyShowingRow" key={showing.id}>
      <span className="journeyMetricIcon"><CalendarDays size={16}/></span>
      <div><Link to={'/leads?lead='+showing.leadId}>{name(showing.leadId)}</Link><b>{property?.name||'Объект из истории'}</b><small>{dateLabel(showing.at)} · {new Date(showing.at).toLocaleTimeString('ru-RU',{timeZone:'Asia/Vladivostok',hour:'2-digit',minute:'2-digit'})}</small>{showing.proposedAt&&<small className="journeyLate">Запрошен перенос · {when(showing.proposedAt)}</small>}{showing.result&&<p>{showing.result}</p>}</div>
      <span className="statusChip">{showingLabels[showing.status]}</span>
    </article>})}
   </div>
  </section>

  {(!runtime.enabled||runtime.member?.role!=='manager')&&<section className="panel journeyWorkspace">
   <div className="sectionHeading"><div><span className="kicker">КАТАЛОГ</span><h2>Актуальность объектов</h2><p>Проверка каждые 7 дней. Подтверждайте цену и наличие после сверки с застройщиком.</p></div><span className="countBadge">{staleCount}</span></div>
   <div className="journeyVerificationList">
    {published.sort((a,b)=>Number(staleVerification(checks.find(v=>v.propertyId===b.id)))-Number(staleVerification(checks.find(v=>v.propertyId===a.id)))).map(property=>{const verification=checks.find(v=>v.propertyId===property.id);const missingFields=[!property.coverImageUrl&&'обложка',!property.floorplans.length&&'планировки',property.floorplans.some(f=>!f.imageUrl)&&'изображения планировок',(!property.developerName||property.developerName==='Партнёр PULSE.DV')&&'название застройщика',(!property.address||property.address===property.city)&&'точный адрес',!property.documents?.length&&'документы',property.latitude==null&&'координаты'].filter(Boolean);const stale=staleVerification(verification);return <details className="journeyVerification" key={property.id}>
      <summary><span className={`journeyMetricIcon ${stale?'attention':'verified'}`}>{stale?<AlertTriangle size={15}/>:<CheckCircle2 size={15}/>}</span><div><b>{property.name}</b><small>{verification?'Проверено '+new Date(verification.checkedAt).toLocaleDateString('ru-RU'):'Пока не проверялся'}{missingFields.length?' · Не хватает: '+missingFields.join(', '):''}</small></div><span className={`statusChip ${stale?'':'published'}`}>{stale?'Требует проверки':'Актуален'}</span></summary>
      <div className="journeyVerificationBody"><label className="controlField"><span>Уточнение для клиента</span><input maxLength={2000} value={notes[property.id]??verification?.note??''} onChange={e=>setNotes({...notes,[property.id]:e.target.value})}/></label><button className="secondaryAction" disabled={busy} onClick={()=>void check(property.id)}><Building2 size={14}/>Цена и наличие проверены</button></div>
    </details>})}
   </div>
  </section>}
 </PageFrame>;
}
