import { PageFrame } from "../components/PageFrame";
import { usePulseEvents } from "../data";

export function UsersPage(){
  const events=usePulseEvents();
  const sessions=Array.from(new Set(events.map(event=>event.sessionId)));
  return <PageFrame eyebrow="CLIENT DATA" title="Пользователи" description="Сессии, интересы и история действий внутри Mini App.">
    <section className="metrics">
      <article><span>Сессии</span><strong>{sessions.length}</strong><small>preview sessions</small></article>
      <article><span>События</span><strong>{events.length}</strong><small>user_events</small></article>
      <article><span>Избранное</span><strong>{events.filter(x=>x.eventType==="favorite_add").length}</strong><small>favorite_add</small></article>
      <article><span>Заявки</span><strong>{events.filter(x=>x.eventType==="lead_created").length}</strong><small>lead_created</small></article>
    </section>
    <section className="tableCard liveTable">
      <div className="tableHead usersGrid"><span>Сессия</span><span>Событий</span><span>Последнее действие</span><span>Время</span></div>
      {sessions.map(session=>{
        const list=events.filter(event=>event.sessionId===session);
        const last=list[0];
        return <div className="tableRow usersGrid" key={session}><span>{session.slice(0,8)}…</span><b>{list.length}</b><span>{last?.eventType||"—"}</span><span>{last?new Date(last.createdAt).toLocaleString("ru-RU"):"—"}</span></div>
      })}
    </section>
  </PageFrame>;
}
