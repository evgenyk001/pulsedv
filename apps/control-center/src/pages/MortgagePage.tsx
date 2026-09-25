import { EmptyState, PageFrame } from "../components/PageFrame";

export function MortgagePage(){
  return <PageFrame eyebrow="FINANCE" title="Ипотека" description="Правила программ, банковские предложения и дата последней проверки условий.">
    <section className="splitCards">
      <article className="panel"><span className="kicker">Правила</span><h2>Федеральные программы</h2><p>Семейная, Дальневосточная, IT и базовые сценарии будут храниться отдельно от банковских офферов.</p></article>
      <article className="panel"><span className="kicker">Источники</span><h2>verified_at + source</h2><p>Каждое условие получит источник, дату проверки и историю версий.</p></article>
    </section>
    <EmptyState title="Mortgage engine ещё не подключён" text="Сейчас расчёт живёт в клиенте. Следующий шаг — вынести правила в backend/package и управлять ими здесь."/>
  </PageFrame>;
}
