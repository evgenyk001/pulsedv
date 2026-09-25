import { Flame, UserRound } from "lucide-react";
import { PageFrame } from "../components/PageFrame";
import { usePulseEvents, usePulseProfiles, usePulseState } from "../data";

export function UsersPage(){
  const events=usePulseEvents();
  const profiles=usePulseProfiles();
  const state=usePulseState();
  const propertyName=(id:string|null)=>state.properties.find(item=>item.id===id)?.name||id||"—";
  const hot=profiles.filter(profile=>profile.priority==="urgent"||profile.priority==="hot");

  return <PageFrame eyebrow="CLIENT INTELLIGENCE" title="Пользователи" description="Анонимный интерес копится до заявки: ЖК, ипотека, PULSE Select и глубина намерения остаются в одном профиле.">
    <section className="metrics">
      <article><span>Профили</span><strong>{profiles.length}</strong><small>активные сессии</small></article>
      <article><span>Горячий интерес</span><strong>{hot.length}</strong><small>score ≥ {state.leadEngine.thresholds.hot}</small></article>
      <article><span>События</span><strong>{events.length}</strong><small>user_events</small></article>
      <article><span>Средний score</span><strong>{profiles.length?Math.round(profiles.reduce((sum,item)=>sum+item.score,0)/profiles.length):0}</strong><small>0–100</small></article>
    </section>

    <section className="tableCard liveTable">
      <div className="tableHead profilesGrid"><span>Профиль</span><span>Interest Score</span><span>Главный интерес</span><span>Следующее действие</span><span>Последняя активность</span></div>
      {profiles.length===0?<div className="emptyState"><strong>Нет профилей</strong><span>Откройте Mini App и совершите несколько действий — профиль появится автоматически.</span></div>:profiles.map(profile=><div className="tableRow profilesGrid" key={profile.id}>
        <span className="leadName"><b><UserRound size={13}/>{profile.sessionId.slice(0,8)}…</b><small>{profile.city||"Город ещё не определён"}</small></span>
        <span className={"scoreBadge "+profile.priority}>{profile.priority==="urgent"&&<Flame size={13}/>}<b>{profile.score}</b><small>{profile.priority}</small></span>
        <span><b>{propertyName(profile.topPropertyId)}</b><small className="blockNote">{profile.mortgageProgram?("Ипотека: "+profile.mortgageProgram):profile.scoreReasons[0]?.label||"Наблюдаем"}</small></span>
        <span className="nextAction"><b>{profile.nextAction}</b><small>{profile.eventCount} событий</small></span>
        <span>{new Date(profile.lastSeenAt).toLocaleString("ru-RU")}</span>
      </div>)}
    </section>
  </PageFrame>;
}
