import { EmptyState, PageFrame } from "../components/PageFrame";

export function ContentPage(){
  return <PageFrame eyebrow="CONTENT" title="Контент" description="Промо-баннеры, onboarding и клиентские коммуникации.">
    <div className="contentGrid">
      <section className="panel"><span className="kicker">Баннеры</span><h2>Главная</h2><p>Изображение, заголовок, CTA, аудитория, порядок и видимость.</p></section>
      <section className="panel"><span className="kicker">Onboarding</span><h2>Версии экранов</h2><p>Контроль artwork и версии показа без вмешательства в клиентский код.</p></section>
    </div>
    <EmptyState title="Редактор контента ещё не подключён" text="Мигрируем banners_GET/POST и хранение медиа из Floot baseline."/>
  </PageFrame>;
}
