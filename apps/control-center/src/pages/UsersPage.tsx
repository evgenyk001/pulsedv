import { Flame, UserRound } from "lucide-react";
import { PageFrame } from "../components/PageFrame";
import { usePulseEvents, usePulseProfiles, usePulseState } from "../data";
import { describeEvent, priorityName } from "../activityCopy";

export function UsersPage(){
  const events=usePulseEvents();
  const profiles=usePulseProfiles();
  const state=usePulseState();
  const propertyName=(id:string|null)=>state.properties.find(item=>item.id===id)?.name||id||"—";
  const hot=profiles.filter(profile=>profile.priority==="urgent"||profile.priority==="hot");
  const latestFor=(sessionId:string)=>events.find(event=>event.sessionId===sessionId);

  return <PageFrame eyebrow="АНАЛИТИКА КЛИЕНТА" title="Пользователи" description="Интерес накапливается до заявки: ЖК, ипотека, PULSE Select и глубина намерения остаются в одном профиле.">
    <section className="metrics">
      <article><span>Профили</span><strong>{profiles.length}</strong><small>активные сессии</small></article>
      <article><span>Горячий интерес</span><strong>{hot.length}</strong><small>индекс от {state.leadEngine.thresholds.hot}</small></article>
      <article><span>Действия</span><strong>{events.length}</strong><small>активность в приложении</small></article>
      <article><span>Средний индекс</span><strong>{profiles.length?Math.round(profiles.reduce((sum,item)=>sum+item.score,0)/profiles.length):0}</strong><small>из 100</small></article>
    </section>

    <section className="tableCard liveTable">
      <div className="tableHead profilesGrid"><span>Профиль</span><span>Индекс интереса</span><span>Главный интерес</span><span>Следующее действие</span><span>Последняя активность</span></div>
      {profiles.length===0?<div className="emptyState"><strong>Нет профилей</strong><span>Откройте Mini App и совершите несколько действий — профиль появится автоматически.</span></div>:profiles.map(profile=>{
        const latest=latestFor(profile.sessionId);
        const activity=latest?describeEvent(latest,state):null;
        return <div className="tableRow profilesGrid" key={profile.id}>
          <span className="leadName"><b><UserRound size={13}/>Посетитель {profile.sessionId.slice(0,8)}…</b><small>{profile.city||"Город ещё не определён"}</small></span>
          <span className={"scoreBadge "+profile.priority}>{profile.priority==="urgent"&&<Flame size={13}/>}<b>{profile.score}</b><small>{priorityName(profile.priority)}</small></span>
          <span><b>{propertyName(profile.topPropertyId)}</b><small className="blockNote">{profile.mortgageProgram?("Ипотека: "+profile.mortgageProgram):profile.scoreReasons[0]?.label||"Наблюдаем"}</small></span>
          <span className="nextAction"><b>{profile.nextAction}</b><small>{profile.eventCount} действий</small></span>
          <span className="nextAction"><b>{activity?.title||"Пока нет действий"}</b><small>{new Date(profile.lastSeenAt).toLocaleString("ru-RU")}</small></span>
        </div>
      })}
    </section>
  </PageFrame>;
}
