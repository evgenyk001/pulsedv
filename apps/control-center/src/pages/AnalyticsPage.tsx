import { PageFrame } from "../components/PageFrame";
import { usePulseEvents, usePulseLeads, usePulseProfiles, usePulseState } from "../data";
import { describeEvent } from "../activityCopy";

export function AnalyticsPage(){
  const events=usePulseEvents();
  const leads=usePulseLeads();
  const profiles=usePulseProfiles();
  const state=usePulseState();
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

  return <PageFrame eyebrow="АНАЛИТИКА ПОВЕДЕНИЯ" title="Аналитика" description="Воронка показывает путь клиента до контакта и реальные действия внутри приложения.">
    <section className="metrics">
      <article><span>Сессии</span><strong>{sessions}</strong><small>визиты в приложение</small></article>
      <article><span>Тёплые и выше</span><strong>{profiles.filter(x=>x.priority!=="cold").length}</strong><small>заметный интерес</small></article>
      <article><span>Лиды</span><strong>{leads.length}</strong><small>оставили контакты</small></article>
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
          <div><b>Холодные</b><small>{profiles.filter(x=>x.priority==="cold").length}</small></div>
          <div><b>Тёплые</b><small>{profiles.filter(x=>x.priority==="warm").length}</small></div>
          <div><b>Горячие</b><small>{profiles.filter(x=>x.priority==="hot").length}</small></div>
          <div><b>Срочные</b><small>{profiles.filter(x=>x.priority==="urgent").length}</small></div>
        </div>
      </article>
    </section>

    <section className="tableCard liveTable">
      <div className="tableHead eventGrid"><span>Действие клиента</span><span>Контекст</span><span>Пользователь</span><span>Время</span></div>
      {events.slice(0,80).map(event=>{
        const copy=describeEvent(event,state);
        return <div className="tableRow eventGrid" key={event.id}><b>{copy.title}</b><span>{copy.detail}</span><span>Посетитель {event.sessionId.slice(0,8)}…</span><span>{new Date(event.createdAt).toLocaleString("ru-RU")}</span></div>
      })}
    </section>
  </PageFrame>;
}
