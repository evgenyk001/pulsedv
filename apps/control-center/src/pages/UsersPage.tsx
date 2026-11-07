import {QuickPreview,PreviewFact} from '../components/QuickPreview';
import {RecordWorkspace} from '../components/RecordWorkspace';
import {runtime} from '../../../../packages/pulse-data/runtime';
import {clientName,clientSearch} from '../clientIdentity';
import {RegisteredClients} from '../components/RegisteredClients';
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
 const [params,setParams]=useSearchParams();const [query,setQuery]=React.useState('');const [previewId,setPreviewId]=React.useState<string|null>(null);const preview=profiles.find(p=>p.sessionId===previewId);
 const canSeeAccounts=runtime.enabled&&['owner','admin'].includes(runtime.member?.role??'');
 const accounts=canSeeAccounts&&params.get('view')==='accounts';
 const changeView=(value:string)=>{const next=new URLSearchParams(params);next.delete('session');if(value==='accounts')next.set('view','accounts');else next.delete('view');setParams(next)};
 const selected=params.get('session');const hotOnly=params.get('filter')==='hot';
 const profile=profiles.find(p=>p.sessionId===selected);
 const propertyName=(id:string|null)=>state.properties.find(p=>p.id===id)?.name||'Объект не указан';
 const open=(id:string)=>setParams({...Object.fromEntries(params),session:id});
 const close=()=>{const next=new URLSearchParams(params);next.delete('session');setParams(next)};
 useDialog(!!profile,close);
 const visible=profiles.filter(p=>(!hotOnly||['hot','urgent'].includes(p.priority))&&[clientSearch(p),p.city,propertyName(p.topPropertyId)].join(' ').toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b.score-a.score);
 return <PageFrame eyebrow="АНАЛИТИКА КЛИЕНТА" title="Пользователи" description="Аккаунты с подтверждённым номером и история интереса посетителей.">
  {canSeeAccounts&&<div className="workspaceTabs" aria-label="Тип данных пользователей"><button aria-pressed={!accounts} onClick={()=>changeView('visitors')}>Посетители и интерес</button><button aria-pressed={accounts} onClick={()=>changeView('accounts')}>Подтверждённые аккаунты</button></div>}
  {accounts?<RegisteredClients/>:<><p className="workspaceHint">Здесь история активности, включая посетителей до подтверждения номера. Количество записей не равно количеству зарегистрированных клиентов.</p>
  <div className="toolbar"><div className="segmented">{[['all','Все посетители'],['hot','Горячий интерес']].map(([key,label])=><button key={key} className={(hotOnly?'hot':'all')===key?'active':''} onClick={()=>setParams(key==='hot'?{filter:'hot'}:{})}>{label}</button>)}</div><label className="controlSearch"><Search size={17}/><input aria-label="Поиск посетителя" placeholder="Имя, телефон, Telegram, город или ЖК" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
  <section className="tableCard liveTable"><div className="tableHead profilesGrid"><span>Посетитель</span><span>Интерес</span><span>Что выбирает</span><span>Следующий шаг</span><span>Последнее действие</span></div>
   {!visible.length?<div className="emptyState"><UserRound size={26}/><strong>Посетители не найдены</strong><span>Измените поиск или дождитесь первых действий в приложении.</span></div>:visible.map(p=>{const latest=[...events].filter(e=>e.sessionId===p.sessionId).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0];return <button className="tableRow profilesGrid leadRowButton" key={p.id} onClick={()=>setPreviewId(p.sessionId)}><span className="leadName"><b><UserRound size={14}/>{clientName(p)}</b><small>{p.client?.phone||p.city||'Город пока не указан'}</small></span><span data-label="Интерес" className={'scoreBadge '+p.priority}>{p.priority==='urgent'&&<Flame size={13}/>}<b>{p.score}</b><small>{priorityName(p.priority)}</small></span><span data-label="Что выбирает"><b>{propertyName(p.topPropertyId)}</b><small className="blockNote">{mortgageNames[p.mortgageProgram||'']||'Программа не выбрана'}</small></span><span data-label="Следующий шаг" className="nextAction"><b>{p.nextAction}</b><small>{p.eventCount} действий</small></span><span data-label="Последнее действие" className="nextAction"><b>{latest?describeEvent(latest,state).title:'Пока нет действий'}</b><small>{new Date(p.lastSeenAt).toLocaleString('ru-RU')}</small></span></button>})}
  </section>
  {paging.hasMore&&<div className="pagedLoadMore"><span>Загружено {profiles.length} из {paging.total}</span><button className="secondaryAction" disabled={paging.loading} onClick={()=>void paging.loadMore()}>{paging.loading?'Загружаем…':'Показать ещё'}</button></div>}
  </>}
  {preview&&<QuickPreview title={clientName(preview)} subtitle="Посетитель · быстрый просмотр" onClose={()=>setPreviewId(null)} onOpen={()=>{setPreviewId(null);open(preview.sessionId)}}><div className="previewIdentity"><span className="clientAvatar large"><UserRound size={24}/></span><div><b>{clientName(preview)}</b><small>{preview.client?.phone||'Номер не передан'}</small></div><span className={'scoreBadge '+preview.priority}>{priorityName(preview.priority)}</span></div><section className="previewSection"><h3>Интерес посетителя</h3><dl><PreviewFact label="Город">{preview.city||'Не указан'}</PreviewFact><PreviewFact label="Объект">{propertyName(preview.topPropertyId)}</PreviewFact><PreviewFact label="Действия">{preview.eventCount}</PreviewFact><PreviewFact label="Последний визит">{new Date(preview.lastSeenAt).toLocaleString('ru-RU')}</PreviewFact><PreviewFact label="Telegram">{preview.client?.username?'@'+preview.client.username:'Не указан'}</PreviewFact></dl></section><section className="previewNextStep"><span className="kicker">СЛЕДУЮЩИЙ ШАГ</span><h3>{preview.nextAction||'Наблюдать интерес'}</h3></section><p className="workspaceHint">История посещений и подтверждённый аккаунт — разные данные. Само наличие посетителя не подтверждает передачу номера.</p></QuickPreview>}
  {profile&&<RecordWorkspace key={profile.id} title={clientName(profile)} eyebrow="Посетитель · история интереса" label="Профиль посетителя" onClose={close} sections={[
   {id:'profile',label:'Профиль',content:<>{profile.client&&<div className="profileSummary" aria-label="Контакты клиента">
    {profile.client.phone&&<p>Телефон: <a href={'tel:'+profile.client.phone}>{profile.client.phone}</a></p>}
    {profile.client.username&&<p>Telegram: <a href={'https://t.me/'+encodeURIComponent(profile.client.username)} target="_blank" rel="noreferrer">@{profile.client.username}</a></p>}
    {profile.client.telegramId&&<p>Telegram ID: {profile.client.telegramId}</p>}
   </div>}<div className="profileSummary"><span className={'scoreBadge '+profile.priority}><b>{profile.score}</b>{priorityName(profile.priority)}</span><p>{profile.city||'Город не указан'} · {propertyName(profile.topPropertyId)}</p><b>{profile.nextAction}</b></div>
   {leads.filter(l=>l.sessionId===profile.sessionId||!!profile.userId&&l.userId===profile.userId).map(l=><Link className="relatedLead" key={l.id} to={'/leads?lead='+l.id}><div><small>ЗАЯВКА КЛИЕНТА</small><b>{l.name} · {l.phone}</b></div><ArrowUpRight size={18}/></Link>)}
</>},
   {id:'interest',label:'Интерес и история',content:<>   <InterestPanel sessionId={profile.sessionId} userId={profile.userId} events={events} state={state}/></>},
  ]}/>}
 </PageFrame>;
}
