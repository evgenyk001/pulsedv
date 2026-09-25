import { EmptyState, PageFrame } from "../components/PageFrame";

export function TasksPage(){
  return <PageFrame eyebrow="OPERATIONS" title="Задачи" description="Рабочий список менеджеров: звонки, показы, follow-up и контроль сделок.">
    <section className="kanban">
      {["Сегодня","В работе","Ожидает","Готово"].map(title=><div className="kanbanCol" key={title}><div className="kanbanTitle"><b>{title}</b><span>0</span></div><EmptyState title="Пусто" text="Задачи появятся после подключения CRM pipeline."/></div>)}
    </section>
  </PageFrame>;
}
