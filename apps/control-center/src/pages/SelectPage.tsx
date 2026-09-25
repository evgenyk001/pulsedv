import { EmptyState, PageFrame } from "../components/PageFrame";

export function SelectPage(){
  return <PageFrame eyebrow="MATCHING" title="PULSE Select" description="Правила ранжирования, веса приоритетов и объяснения результата.">
    <section className="panel">
      <span className="kicker">Lead Engine</span>
      <h2>Мягкое ранжирование вместо жёсткой анкеты</h2>
      <p>Здесь будут редактироваться scoring_rules: город, бюджет, комнаты, срок сдачи и мягкие приоритеты.</p>
    </section>
    <EmptyState title="Правила пока зашиты в клиентском preview" text="Перенесём их в общую базу, чтобы менять логику без релиза Mini App."/>
  </PageFrame>;
}
