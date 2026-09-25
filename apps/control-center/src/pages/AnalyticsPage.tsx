import { PageFrame } from "../components/PageFrame";
import { usePulseEvents, usePulseLeads, usePulseProfiles } from "../data";

export function AnalyticsPage(){
  const events=usePulseEvents();
  const leads=usePulseLeads();
  const profiles=usePulseProfiles();
  const sessions=new Set(events.map(event=>event.sessionId)).size;
  const conversion=sessions?Math.round(new Set(leads.map(x=>x.sessionId).filter(Boolean)).size/sessions*100):0;
  const count=(type:string)=>events.filter(event=>event.eventType===type).length;
  const uniqueSessions=(type:string)=>new Set(events.filter(event=>event.eventType===type).map(event=>event.sessionId)).size;
  const funnel=[
    {label:"Сессии",value:sessions,base:sessions},
    {label:"Открыли ЖК",value:uniqueSessions("property_view"),base:sessions},
    {label:"Добавили в избранное",value:uniqueSessions("favorite_add"),base:sessions},
    {label:"Прошли PULSE Select",value:uniqueSessions("select_submit"),base:sessions},
    {label:"Открыли форму",value:uniqueSessions("lead_form_open"),base:sessions},
    {label:"Оставили контакт",value:new Set(leads.map(x=>x.sessionId).filter(Boolean)).size,base:sessions},
  ];

  return <PageFrame eyebrow="EVENTS + INTENT" title="Аналитика" description="Воронка показывает путь до контакта, а не только финальное количество заявок.">
    <section className="metrics">
      <article><span>Сессии</span><strong>{sessions}</strong><small>sessions</small></article>
      <article><span>Профили ≥ warm</span><strong>{profiles.filter(x=>x.priority!=="cold").length}</strong><small>поведенческий интерес</small></article>
      <article><span>Лиды</span><strong>{leads.length}</strong><small>lead_created</small></article>
      <article><span>Конверсия</span><strong>{conversion}%</strong><small>контакты / сессии</small></article>
    </section>

    <section className="panel">
      <div className="kicker">MICRO FUNNEL</div>
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
      <article className="panel"><div className="kicker">SIGNALS</div><h2>Сильные действия</h2>
        <div className="signalList compact">
          <div><b>Просмотры ЖК</b><small>{count("property_view")}</small></div>
          <div><b>Избранное</b><small>{count("favorite_add")}</small></div>
          <div><b>PULSE Select</b><small>{count("select_submit")}</small></div>
          <div><b>Ипотека</b><small>{count("mortgage_calculated")+count("mortgage_program")}</small></div>
        </div>
      </article>
      <article className="panel"><div className="kicker">QUALITY</div><h2>Качество интереса</h2>
        <div className="signalList compact">
          <div><b>Cold</b><small>{profiles.filter(x=>x.priority==="cold").length}</small></div>
          <div><b>Warm</b><small>{profiles.filter(x=>x.priority==="warm").length}</small></div>
          <div><b>Hot</b><small>{profiles.filter(x=>x.priority==="hot").length}</small></div>
          <div><b>Urgent</b><small>{profiles.filter(x=>x.priority==="urgent").length}</small></div>
        </div>
      </article>
    </section>

    <section className="tableCard liveTable">
      <div className="tableHead eventGrid"><span>Событие</span><span>Сущность</span><span>Сессия</span><span>Время</span></div>
      {events.slice(0,80).map(event=><div className="tableRow eventGrid" key={event.id}><b>{event.eventType}</b><span>{event.entityType||"—"} {event.entityId||""}</span><span>{event.sessionId.slice(0,8)}…</span><span>{new Date(event.createdAt).toLocaleString("ru-RU")}</span></div>)}
    </section>
  </PageFrame>;
}
