import {FinancePanel} from '../components/FinancePanel';
import React from "react";
import {AcquisitionPanel} from '../components/AcquisitionPanel';
import { PageFrame } from "../components/PageFrame";
import { useControlPaging, usePulseEvents, usePulseLeads, usePulseProfiles, usePulseState } from "../data";
import { ActivityFeed } from "../components/ActivityFeed";
import { api, runtime } from "../../../../packages/pulse-data/runtime";

type Summary={
  sessions:number;leadSessions:number;leadsTotal:number;
  eventCounts:Record<string,number>;uniqueSessions:Record<string,number>;
  priorities:{cold:number;warm:number;hot:number;urgent:number};
};

export function AnalyticsPage(){
  const events=usePulseEvents();
  const leads=usePulseLeads();
  const profiles=usePulseProfiles();
  const state=usePulseState();
  const paging=useControlPaging("events");
  const [remote,setRemote]=React.useState<Summary|null>(null);

  React.useEffect(()=>{
    if(!runtime.enabled)return;
    let live=true;
    const load=()=>api<Summary>("/control/analytics-summary").then(value=>{if(live)setRemote(value)}).catch(()=>{});
    void load();const id=window.setInterval(()=>{if(!document.hidden)void load()},30000);
    return()=>{live=false;window.clearInterval(id)};
  },[]);

  const fallbackSessions=new Set(events.map(event=>event.sessionId)).size;
  const fallbackLeadSessions=new Set(leads.map(x=>x.sessionId).filter(Boolean)).size;
  const count=(type:string)=>remote?.eventCounts[type]??events.filter(event=>event.eventType===type).length;
  const uniqueSessions=(type:string)=>remote?.uniqueSessions[type]??new Set(events.filter(event=>event.eventType===type).map(event=>event.sessionId)).size;
  const sessions=remote?.sessions??fallbackSessions;
  const leadSessions=remote?.leadSessions??fallbackLeadSessions;
  const leadsTotal=remote?.leadsTotal??leads.length;
  const priorities=remote?.priorities??{
    cold:profiles.filter(x=>x.priority==="cold").length,
    warm:profiles.filter(x=>x.priority==="warm").length,
    hot:profiles.filter(x=>x.priority==="hot").length,
    urgent:profiles.filter(x=>x.priority==="urgent").length,
  };
  const conversion=sessions?Math.round(leadSessions/sessions*100):0;
  const funnel=[
    {label:"Сессии",value:sessions,base:sessions},
    {label:"Открыли ЖК",value:uniqueSessions("property_view"),base:sessions},
    {label:"Добавили в избранное",value:uniqueSessions("favorite_add"),base:sessions},
    {label:"Прошли PULSE Select",value:uniqueSessions("select_submit"),base:sessions},
    {label:"Открыли форму",value:uniqueSessions("lead_form_open"),base:sessions},
    {label:"Оставили контакт",value:leadSessions,base:sessions},
  ];

  return <PageFrame eyebrow="АНАЛИТИКА ПОВЕДЕНИЯ" title="Аналитика" description="Воронка показывает путь клиента до контакта и реальные действия внутри приложения.">
    <FinancePanel/><AcquisitionPanel/><section className="metrics">
      <article><span>Сессии</span><strong>{sessions}</strong><small>визиты в приложение</small></article>
      <article><span>Тёплые и выше</span><strong>{priorities.warm+priorities.hot+priorities.urgent}</strong><small>заметный интерес</small></article>
      <article><span>Лиды</span><strong>{leadsTotal}</strong><small>оставили контакты</small></article>
      <article><span>Конверсия</span><strong>{conversion}%</strong><small>контакты / сессии</small></article>
    </section>

    <section className="panel">
      <div className="kicker">ВОРОНКА</div>
      <h2>От визита до контакта</h2>
      <div className="funnelRows">
        {funnel.map((step,index)=>{
          const percent=step.base?Math.round(step.value/step.base*100):0;
          return <div className="funnelRow" key={step.label}>
            <span>{index+1}</span><b>{step.label}</b><div><i style={{width:Math.min(100,percent)+"%"}}/></div><strong>{step.value}</strong><small>{percent}%</small>
          </div>
        })}
      </div>
    </section>

    <section className="splitCards">
      <article className="panel"><div className="kicker">СИЛЬНЫЕ СИГНАЛЫ</div><h2>Что делают пользователи</h2>
        <div className="signalList compact">
          <div><b>Просмотры ЖК</b><small>{count("property_view")}</small></div>
          <div><b>Добавления в избранное</b><small>{count("favorite_add")}</small></div>
          <div><b>Прохождения PULSE Select</b><small>{count("select_submit")}</small></div>
          <div><b>Действия с ипотекой</b><small>{count("mortgage_calculated")+count("mortgage_program")}</small></div>
        </div>
      </article>
      <article className="panel"><div className="kicker">КАЧЕСТВО ИНТЕРЕСА</div><h2>Температура аудитории</h2>
        <div className="signalList compact">
          <div><b>Холодные</b><small>{priorities.cold}</small></div>
          <div><b>Тёплые</b><small>{priorities.warm}</small></div>
          <div><b>Горячие</b><small>{priorities.hot}</small></div>
          <div><b>Срочные</b><small>{priorities.urgent}</small></div>
        </div>
      </article>
    </section>

    <section className="panel"><div className="sectionHeading"><div><span className="kicker">ДЕЙСТВИЯ И КОНТЕКСТ</span><h2>Журнал активности</h2></div><span className="countBadge">{paging.total||events.length}</span></div><ActivityFeed events={events} state={state}/>{runtime.enabled&&paging.hasMore&&<div className="pagedLoadMore"><span>Загружено {events.length} из {paging.total}</span><button className="secondaryAction" disabled={paging.loading} onClick={()=>void paging.loadMore()}>{paging.loading?'Загружаем…':'Показать ещё'}</button></div>}</section>
  </PageFrame>;
}
