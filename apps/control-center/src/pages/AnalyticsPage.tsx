import { EmptyState, PageFrame } from "../components/PageFrame";

export function AnalyticsPage(){
  return <PageFrame eyebrow="EVENTS" title="Аналитика" description="Воронки, источники, UTM, Interest Score и поведение внутри Mini App.">
    <section className="metrics">
      <article><span>Сессии</span><strong>—</strong><small>sessions</small></article>
      <article><span>События</span><strong>—</strong><small>user_events</small></article>
      <article><span>Лиды</span><strong>—</strong><small>lead_created</small></article>
      <article><span>Конверсия</span><strong>—</strong><small>после аналитики</small></article>
    </section>
    <EmptyState title="Event stream ещё не подключён" text="Начнём с server-side POST событий в Postgres, очереди добавим позже."/>
  </PageFrame>;
}
