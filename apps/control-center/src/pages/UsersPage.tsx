import { EmptyState, PageFrame } from "../components/PageFrame";

export function UsersPage(){
  return <PageFrame eyebrow="CLIENT DATA" title="Пользователи" description="Профиль клиента, интересы, события, избранное и история подборов.">
    <section className="tableCard">
      <div className="tableHead usersGrid"><span>Пользователь</span><span>Источник</span><span>Interest Score</span><span>Последняя активность</span></div>
      <EmptyState title="Пользовательские события ещё не подключены" text="Здесь будет timeline по user_events: просмотр ЖК, избранное, ипотека, PULSE Select и отправленные заявки."/>
    </section>
  </PageFrame>;
}
