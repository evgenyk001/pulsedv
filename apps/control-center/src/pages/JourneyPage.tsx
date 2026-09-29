import React from 'react';
import {Link} from 'react-router-dom';
import {Building2,CalendarDays,ChevronRight,Clock3,ListChecks,RefreshCw,ShieldCheck} from 'lucide-react';
import {PageFrame} from '../components/PageFrame';
import {usePulseState} from '../data';
import {loadJourneys,loadVerifications,verifyProperty,type JourneyEntry} from '../../../../packages/journey/client';
import {staleVerification,showingLabels,type Verification} from '../../../../packages/journey/model';
import {runtime} from '../../../../packages/pulse-data/runtime';
import '../../../../packages/journey/journey.css';

const when=(value:string)=>new Date(value).toLocaleString('ru-RU',{timeZone:'Asia/Vladivostok',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
export function JourneyPage(){
 const state=usePulseState();
 const [items,setItems]=React.useState<JourneyEntry[]>([]),[checks,setChecks]=React.useState<Verification[]>([]),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false),[notes,setNotes]=React.useState<Record<string,string>>({}),[day,setDay]=React.useState('');
 const reload=async()=>{setBusy(true);try{const [j,v]=await Promise.all([loadJourneys(),loadVerifications()]);setItems(j.items);setChecks(v);setError(j.limited?'Показаны последние 1000 обращений':'')}catch(e){setError((e as Error).message)}finally{setBusy(false)}};
 React.useEffect(()=>{void reload()},[]);
 const active=items.filter(item=>!['deal','closed','lost'].includes(item.status));
 const missing=active.filter(item=>!item.journey.nextStep||item.journey.nextStep.done);
 const planned=active.filter(item=>item.journey.nextStep&&!item.journey.nextStep.done).sort((a,b)=>Date.parse(a.journey.nextStep!.dueAt)-Date.parse(b.journey.nextStep!.dueAt));
 const showings=items.flatMap(entry=>entry.journey.showings.map(showing=>({...showing,leadId:entry.leadId,leadName:entry.leadName||'Клиент'}))).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
 const visibleShowings=showings.filter(showing=>!day||new Date(showing.at).toLocaleDateString('en-CA',{timeZone:'Asia/Vladivostok'})===day);
 const stale=state.properties.filter(property=>property.status==='published'&&staleVerification(checks.find(item=>item.propertyId===property.id))).length;
 const check=async(id:string)=>{setBusy(true);setError('');try{await verifyProperty(id,notes[id]??checks.find(v=>v.propertyId===id)?.note??'',checks.find(v=>v.propertyId===id)?.revision||0);await reload()}catch(e){setError((e as Error).message)}finally{setBusy(false)}};

 return <PageFrame eyebrow="ОТ ПОДБОРА ДО ПОКАЗА" title="Сопровождение клиентов" description="Следующие шаги, показы и актуальность объектов — в одном рабочем экране." action={<button className="secondaryAction journeyRefresh" disabled={busy} onClick={()=>void reload()}><RefreshCw size={15}/>{busy?'Обновляем…':'Обновить'}</button>}>
  {error&&<div className="errorNotice" role="alert">{error}</div>}

  <section className="journeyStats" aria-label="Сводка сопровождения">
   <article><span><ListChecks size={16}/>Без следующего шага</span><strong>{missing.length}</strong><small>нужно запланировать действие</small></article>
   <article><span><CalendarDays size={16}/>Показы</span><strong>{showings.length}</strong><small>в календаре обращений</small></article>
   <article><span><ShieldCheck size={16}/>Требуют проверки</span><strong>{stale}</strong><small>опубликованных объектов</small></article>
  </section>

  <section className="journeyWorkspaceGrid">
   <article className="panel journeyWorkPanel">
    <div className="sectionHeading"><div><span className="kicker">РАБОЧАЯ ОЧЕРЕДЬ</span><h2>Что сделать сейчас</h2></div><span className="countBadge">{active.length}</span></div>
    {missing.length>0&&<div className="journeyQueueGroup"><h3>Без следующего шага · {missing.length}</h3>{missing.slice(0,8).map(item=><Link className="journeyQueueRow" key={item.leadId} to={'/leads?lead='+item.leadId}><span className="journeyQueueIcon"><Clock3 size={15}/></span><div><b>{item.leadName||'Клиент'}</b><small>{item.status==='new'?'Новое обращение':'Нужно запланировать следующее действие'}</small></div><ChevronRight size={16}/></Link>)}</div>}
    {planned.length>0&&<div className="journeyQueueGroup"><h3>Запланировано</h3>{planned.slice(0,10).map(item=><Link className="journeyQueueRow" key={item.leadId} to={'/leads?lead='+item.leadId}><span className={'journeyQueueIcon '+(Date.parse(item.journey.nextStep!.dueAt)<Date.now()?'late':'')}><ListChecks size={15}/></span><div><b>{item.leadName||'Клиент'}</b><small>{item.journey.nextStep!.title} · {when(item.journey.nextStep!.dueAt)}</small></div><ChevronRight size={16}/></Link>)}</div>}
    {!active.length&&<div className="emptyState"><ListChecks size={24}/><strong>Рабочая очередь пустая</strong><span>Активные обращения появятся здесь автоматически.</span></div>}
   </article>

   <article className="panel journeyCalendarPanel">
    <div className="sectionHeading"><div><span className="kicker">КАЛЕНДАРЬ</span><h2>Показы</h2></div><span className="countBadge">{visibleShowings.length}</span></div>
    <div className="journeyDateFilter"><label><span>День по Владивостоку</span><input type="date" value={day} onChange={event=>setDay(event.target.value)}/></label>{day&&<button className="secondaryAction" onClick={()=>setDay('')}>Все даты</button>}</div>
    {!visibleShowings.length&&<div className="emptyState"><CalendarDays size={24}/><strong>Показов нет</strong><span>{day?'На выбранную дату встреч не запланировано.':'Новые показы появятся здесь после согласования.'}</span></div>}
    <div className="journeyShowingList">{visibleShowings.slice(0,12).map(showing=><Link className="journeyShowingRow" key={showing.id} to={'/leads?lead='+showing.leadId}><span className="journeyDateTile"><b>{new Date(showing.at).toLocaleDateString('ru-RU',{timeZone:'Asia/Vladivostok',day:'2-digit'})}</b><small>{new Date(showing.at).toLocaleDateString('ru-RU',{timeZone:'Asia/Vladivostok',month:'short'}).replace('.','')}</small></span><div><b>{showing.leadName}</b><small>{state.properties.find(property=>property.id===showing.propertyId)?.name||'Объект из истории'} · {new Date(showing.at).toLocaleTimeString('ru-RU',{timeZone:'Asia/Vladivostok',hour:'2-digit',minute:'2-digit'})}</small>{showing.proposedAt&&<em>Запрошен перенос · {when(showing.proposedAt)}</em>}</div><span className="statusChip">{showingLabels[showing.status]}</span></Link>)}</div>
   </article>
  </section>

  {(!runtime.enabled||runtime.member?.role!=='manager')&&<section className="panel journeyVerificationPanel">
   <div className="sectionHeading"><div><span className="kicker">АКТУАЛЬНОСТЬ КАТАЛОГА</span><h2>Проверка объектов</h2><p>Раз в 7 дней подтверждайте цену и наличие у застройщика. Комментарий увидит клиент.</p></div><span className="countBadge">{stale}</span></div>
   <div className="journeyVerificationList">{state.properties.filter(property=>property.status==='published').sort((a,b)=>Number(staleVerification(checks.find(v=>v.propertyId===b.id)))-Number(staleVerification(checks.find(v=>v.propertyId===a.id)))).map(property=>{const verification=checks.find(v=>v.propertyId===property.id);const missing=[!property.coverImageUrl&&'обложка',!property.floorplans.length&&'планировки',property.floorplans.some(f=>!f.imageUrl)&&'изображения планировок',(!property.developerName||property.developerName==='Партнёр PULSE.DV')&&'название застройщика',(!property.address||property.address===property.city)&&'точный адрес',!property.documents?.length&&'документы',property.latitude==null&&'координаты'].filter(Boolean);const staleItem=staleVerification(verification);return <details className="journeyVerificationRow" key={property.id}><summary><span className="journeyPropertyIcon"><Building2 size={16}/></span><div><b>{property.name}</b><small>{verification?'Проверено '+new Date(verification.checkedAt).toLocaleDateString('ru-RU'):'Пока не проверялся'}{missing.length?' · Не хватает: '+missing.join(', '):''}</small></div><span className={'statusChip '+(staleItem?'draft':'published')}>{staleItem?'Требует проверки':'Актуален'}</span><ChevronRight size={16}/></summary><div className="journeyVerificationEditor"><label className="controlField"><span>Уточнение для клиента</span><input maxLength={2000} value={notes[property.id]??verification?.note??''} onChange={event=>setNotes({...notes,[property.id]:event.target.value})}/></label><button className="secondaryAction" disabled={busy} onClick={()=>void check(property.id)}>Цена и наличие проверены</button></div></details>})}</div>
  </section>}
 </PageFrame>;
}
