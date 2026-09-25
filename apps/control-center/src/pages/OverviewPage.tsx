import { ShieldCheck } from "lucide-react";
import { PageFrame } from "../components/PageFrame";
import { usePulseEvents, usePulseLeads, usePulseState } from "../data";

export function OverviewPage(){
  const state=usePulseState();
  const leads=usePulseLeads();
  const events=usePulseEvents();
  const sessions=new Set(events.map(event=>event.sessionId)).size;
  const conversion=sessions?Math.round(leads.length/sessions*100):0;
  return <PageFrame eyebrow="CONTROL CENTER" title="Операционная панель PULSE.DV" description="Mini App и PULSE Control работают через единый слой данных.">
    <section className="metrics">
      <article><span>Новые лиды</span><strong>{leads.filter(x=>x.status==="new").length}</strong><small>{leads.length} всего</small></article>
      <article><span>Активные объекты</span><strong>{state.properties.filter(x=>x.status==="published").length}</strong><small>{state.properties.length} в каталоге</small></article>
      <article><span>Сессии</span><strong>{sessions}</strong><small>{events.length} событий</small></article>
      <article><span>Конверсия</span><strong>{conversion}%</strong><small>лиды / сессии</small></article>
    </section>
    <section className="panel">
      <div className="panelTitle"><ShieldCheck size={20}/><div><span>Связь активна</span><h2>Mini App ↔ PULSE Control</h2></div></div>
      <p>В preview данные синхронизируются между двумя отдельными приложениями на одном origin. Следующий production-адаптер заменит browser storage на API/Postgres, не меняя интерфейсы страниц.</p>
    </section>
  </PageFrame>;
}
