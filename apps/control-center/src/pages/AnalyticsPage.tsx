import { PageFrame } from "../components/PageFrame";
import { usePulseEvents, usePulseLeads } from "../data";

export function AnalyticsPage(){
  const events=usePulseEvents();
  const leads=usePulseLeads();
  const sessions=new Set(events.map(event=>event.sessionId)).size;
  const conversion=sessions?Math.round(leads.length/sessions*100):0;
  return <PageFrame eyebrow="EVENTS" title="Аналитика" description="Живой поток действий Mini App.">
    <section className="metrics">
      <article><span>Сессии</span><strong>{sessions}</strong><small>sessions</small></article>
      <article><span>События</span><strong>{events.length}</strong><small>user_events</small></article>
      <article><span>Лиды</span><strong>{leads.length}</strong><small>lead_created</small></article>
      <article><span>Конверсия</span><strong>{conversion}%</strong><small>лиды / сессии</small></article>
    </section>
    <section className="tableCard liveTable">
      <div className="tableHead eventGrid"><span>Событие</span><span>Сущность</span><span>Сессия</span><span>Время</span></div>
      {events.slice(0,50).map(event=><div className="tableRow eventGrid" key={event.id}><b>{event.eventType}</b><span>{event.entityType||"—"} {event.entityId||""}</span><span>{event.sessionId.slice(0,8)}…</span><span>{new Date(event.createdAt).toLocaleString("ru-RU")}</span></div>)}
    </section>
  </PageFrame>;
}
