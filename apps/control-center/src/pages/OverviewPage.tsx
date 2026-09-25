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
  const conversion=sessions?Math.round(leads.length/sessions*100):0;
  const hotProfiles=profiles.filter(item=>item.priority==="hot"||item.priority==="urgent");
  const urgentTasks=tasks.filter(task=>task.status!=="done"&&task.priority==="urgent");

  return <PageFrame eyebrow="CONTROL CENTER" title="Операционная панель PULSE.DV" description="Сначала показываем то, что требует действия: горячий интерес, новые контакты и просрочиваемые задачи.">
    <section className="metrics">
      <article><span>Новые лиды</span><strong>{leads.filter(x=>x.status==="new").length}</strong><small>{leads.length} всего</small></article>
      <article><span>Горячий интерес</span><strong>{hotProfiles.length}</strong><small>до заявки и после</small></article>
      <article><span>Срочные задачи</span><strong>{urgentTasks.length}</strong><small>SLA 5 минут</small></article>
      <article><span>Конверсия в контакт</span><strong>{conversion}%</strong><small>{sessions} сессий</small></article>
    </section>

    <section className="attentionGrid">
      <article className="panel">
        <div className="panelTitle"><Flame size={20}/><div><span>PRIORITY QUEUE</span><h2>Нужны действия сейчас</h2></div></div>
        {tasks.filter(task=>task.status!=="done").slice(0,5).length===0?<p>Очередь чистая. Lead Engine создаст задачи, когда появится контакт с тёплым или горячим score.</p>:<div className="signalList">
          {tasks.filter(task=>task.status!=="done").slice(0,5).map(task=><div key={task.id}><span className={"signalDot "+task.priority}/><b>{task.title}</b><small>{task.reason}</small></div>)}
        </div>}
      </article>

      <article className="panel">
        <div className="panelTitle"><Target size={20}/><div><span>INTENT</span><h2>Что интересует аудиторию</h2></div></div>
        <div className="signalList">
          {profiles.slice(0,5).map(profile=><div key={profile.id}><span className="scoreMini">{profile.score}</span><b>{profile.city||"Город не определён"}</b><small>{profile.scoreReasons[0]?.label||"Первые действия"}</small></div>)}
          {!profiles.length&&<p>Профили появятся после первых пользовательских событий.</p>}
        </div>
      </article>
    </section>

    <section className="panel">
      <div className="panelTitle"><ShieldCheck size={20}/><div><span>ARCHITECTURE</span><h2>Mini App → Event Stream → Lead Engine → PULSE Control</h2></div></div>
      <p>Сейчас работает preview-адаптер на browser storage, но scoring, профили, задачи и контракты уже отделены от хранения. Production-адаптер сможет заменить его на API/Postgres без переписывания экранов.</p>
      <div className="flowLine"><span><Activity size={14}/> user_events</span><b>→</b><span>Interest Score</span><b>→</b><span>CRM task</span><b>→</b><span>Менеджер</span></div>
    </section>
  </PageFrame>;
}
