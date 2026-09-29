import { useDialog } from "../components/useDialog";
import React from 'react';
import { Flame, UserRound, Search, X, ArrowUpRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageFrame } from '../components/PageFrame';
import { InterestPanel } from '../components/InterestPanel';
import { useControlPaging, usePulseEvents, usePulseProfiles, usePulseState, usePulseLeads } from '../data';
import { describeEvent, priorityName, mortgageNames } from '../activityCopy';
export function UsersPage(){
 const events=usePulseEvents(),profiles=usePulseProfiles(),state=usePulseState(),leads=usePulseLeads();const paging=useControlPaging('profiles');
 const [params,setParams]=useSearchParams();const [query,setQuery]=React.useState('');
 const selected=params.get('session');const hotOnly=params.get('filter')==='hot';
 const profile=profiles.find(p=>p.sessionId===selected);
 const propertyName=(id:string|null)=>state.properties.find(p=>p.id===id)?.name||'Объект не указан';
 const open=(id:string)=>setParams({...Object.fromEntries(params),session:id});
 const close=()=>{const next=new URLSearchParams(params);next.delete('session');setParams(next)};
 useDialog(!!profile,close);
 const visible=profiles.filter(p=>(!hotOnly||['hot','urgent'].includes(p.priority))&&[p.sessionId,p.city,propertyName(p.topPropertyId)].join(' ').toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b.score-a.score);
 return <PageFrame eyebrow="АНАЛИТИКА КЛИЕНТА" title="Посетители и интерес" description="От первого просмотра до заявки: что искал человек и какие объекты его заинтересовали.">
  <div className="toolbar"><div className="segmented">{[['all','Все посетители'],['hot','Горячий интерес']].map(([key,label])=><button key={key} className={(hotOnly?'hot':'all')===key?'active':''} onClick={()=>setParams(key==='hot'?{filter:'hot'}:{})}>{label}</button>)}</div><label className="controlSearch"><Search size={17}/><input aria-label="Поиск посетителя" placeholder="Город, ЖК, номер посетителя" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
  <section className="tableCard liveTable"><div className="tableHead profilesGrid"><span>Посетитель</span><span>Интерес</span><span>Что выбирает</span><span>Следующий шаг</span><span>Последнее действие</span></div>
   {!visible.length?<div className="emptyState"><UserRound size={26}/><strong>Посетители не найдены</strong><span>Измените поиск или дождитесь первых действий в приложении.</span></div>:visible.map(p=>{const latest=[...events].filter(e=>e.sessionId===p.sessionId).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0];return <button className="tableRow profilesGrid leadRowButton" key={p.id} onClick={()=>open(p.sessionId)}><span className="leadName"><b><UserRound size={14}/>Посетитель {p.sessionId.slice(0,8)}</b><small>{p.city||'Город пока не указан'}</small></span><span className={'scoreBadge '+p.priority}>{p.priority==='urgent'&&<Flame size={13}/>}<b>{p.score}</b><small>{priorityName(p.priority)}</small></span><span><b>{propertyName(p.topPropertyId)}</b><small className="blockNote">{mortgageNames[p.mortgageProgram||'']||'Программа не выбрана'}</small></span><span className="nextAction"><b>{p.nextAction}</b><small>{p.eventCount} действий</small></span><span className="nextAction"><b>{latest?describeEvent(latest,state).title:'Пока нет действий'}</b><small>{new Date(p.lastSeenAt).toLocaleString('ru-RU')}</small></span></button>})}
  </section>
  {paging.hasMore&&<div className="pagedLoadMore"><span>Загружено {profiles.length} из {paging.total}</span><button className="secondaryAction" disabled={paging.loading} onClick={()=>void paging.loadMore()}>{paging.loading?'Загружаем…':'Показать ещё'}</button></div>}
  {profile&&<div className="drawerBackdrop" onClick={close}><section className="detailDrawer" role="dialog" aria-modal="true" aria-label="Профиль посетителя" onClick={e=>e.stopPropagation()}><div className="drawerHeader"><div><span className="kicker">ПУТЬ КЛИЕНТА</span><h2>Посетитель {profile.sessionId.slice(0,8)}</h2></div><button aria-label="Закрыть профиль" onClick={close}><X/></button></div><div className="profileSummary"><span className={'scoreBadge '+profile.priority}><b>{profile.score}</b>{priorityName(profile.priority)}</span><p>{profile.city||'Город не указан'} · {propertyName(profile.topPropertyId)}</p><b>{profile.nextAction}</b></div>
   {leads.filter(l=>l.sessionId===profile.sessionId||!!profile.userId&&l.userId===profile.userId).map(l=><Link className="relatedLead" key={l.id} to={'/leads?lead='+l.id}><div><small>ЗАЯВКА КЛИЕНТА</small><b>{l.name} · {l.phone}</b></div><ArrowUpRight size={18}/></Link>)}
   <InterestPanel sessionId={profile.sessionId} userId={profile.userId} events={events} state={state}/>
  </section></div>}
 </PageFrame>;
}
