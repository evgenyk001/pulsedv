import { Activity, Flame, ShieldCheck, Target } from "lucide-react";
import { PageFrame } from "../components/PageFrame";
import { usePulseEvents, usePulseLeads, usePulseProfiles, usePulseState, usePulseTasks } from "../data";

export function OverviewPage(){
  const state=usePulseState();
  const leads=usePulseLeads();
  const events=usePulseEvents();
  const profiles=usePulseProfiles();
  const tasks=usePulseTasks();
  const sessions=new Set(events.map(event=>event.sessionId)).size;
  const conversion=sessions?Math.round(new Set(leads.map(x=>x.sessionId).filter(Boolean)).size/sessions*100):0;
  const hotProfiles=profiles.filter(item=>item.priority==="hot"||item.priority==="urgent");
  const urgentTasks=tasks.filter(task=>task.status!=="done"&&task.priority==="urgent");

  return <PageFrame eyebrow="ЦЕНТР УПРАВЛЕНИЯ" title="Операционная панель PULSE.DV" description="Сначала показываем то, что требует действия: горячий интерес, новые контакты и задачи с коротким сроком.">
    <section className="metrics">
      <article><span>Новые лиды</span><strong>{leads.filter(x=>x.status==="new").length}</strong><small>{leads.length} всего</small></article>
      <article><span>Горячий интерес</span><strong>{hotProfiles.length}</strong><small>до заявки и после</small></article>
      <article><span>Срочные задачи</span><strong>{urgentTasks.length}</strong><small>связаться за 5 минут</small></article>
      <article><span>Конверсия в контакт</span><strong>{conversion}%</strong><small>{sessions} сессий</small></article>
    </section>

    <section className="attentionGrid">
      <article className="panel">
        <div className="panelTitle"><Flame size={20}/><div><span>ПРИОРИТЕТНАЯ ОЧЕРЕДЬ</span><h2>Нужны действия сейчас</h2></div></div>
        {tasks.filter(task=>task.status!=="done").slice(0,5).length===0?<p>Очередь чистая. Система создаст задачу, когда у клиента появится заметный интерес и контакт.</p>:<div className="signalList">
          {tasks.filter(task=>task.status!=="done").slice(0,5).map(task=><div key={task.id}><span className={"signalDot "+task.priority}/><b>{task.title}</b><small>{task.reason}</small></div>)}
        </div>}
      </article>

      <article className="panel">
        <div className="panelTitle"><Target size={20}/><div><span>ИНТЕРЕС</span><h2>Что интересует аудиторию</h2></div></div>
        <div className="signalList">
          {profiles.slice(0,5).map(profile=><div key={profile.id}><span className="scoreMini">{profile.score}</span><b>{profile.city||"Город не определён"}</b><small>{profile.scoreReasons[0]?.label||"Первые действия"}</small></div>)}
          {!profiles.length&&<p>Профили появятся после первых действий пользователей.</p>}
        </div>
      </article>
    </section>

    <section className="panel">
      <div className="panelTitle"><ShieldCheck size={20}/><div><span>КАК РАБОТАЕТ СИСТЕМА</span><h2>Mini App → интерес клиента → задача → менеджер</h2></div></div>
      <p>Заявки, интересы клиента и задачи связаны между собой. Проверьте сроки связи и назначенных менеджеров. Режим подключения указан в верхней панели.</p>
      <div className="flowLine"><span><Activity size={14}/> Действия клиента</span><b>→</b><span>Индекс интереса</span><b>→</b><span>Задача</span><b>→</b><span>Менеджер</span></div>
    </section>
  </PageFrame>;
}
