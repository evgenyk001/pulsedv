import { Building2, ChartNoAxesCombined, Handshake, Images, LayoutDashboard, Settings2, UsersRound } from "lucide-react";

const sections=[
  {label:"Обзор",icon:LayoutDashboard},
  {label:"Лиды",icon:Handshake},
  {label:"Пользователи",icon:UsersRound},
  {label:"Объекты",icon:Building2},
  {label:"Контент",icon:Images},
  {label:"Аналитика",icon:ChartNoAxesCombined},
  {label:"Настройки",icon:Settings2},
];

export function App(){
  return <div className="control">
    <aside className="sidebar">
      <div className="brand"><span className="mark"><i/><i/><i/></span><div><b>PULSE Control</b><small>Private workspace</small></div></div>
      <nav>{sections.map(({label,icon:Icon},index)=><button className={index===0?"active":""} key={label}><Icon size={18}/><span>{label}</span></button>)}</nav>
    </aside>
    <main>
      <header><div><span>CONTROL CENTER</span><h1>Операционная панель PULSE.DV</h1><p>Админка теперь живёт отдельно от клиентского Mini App.</p></div><div className="status">Private</div></header>
      <section className="grid">
        <article><span>Лиды сегодня</span><strong>—</strong><small>Подключим к общей базе</small></article>
        <article><span>Активные объекты</span><strong>—</strong><small>Каталог и статусы публикации</small></article>
        <article><span>PULSE Select</span><strong>—</strong><small>События и конверсия</small></article>
      </section>
      <section className="panel"><div><h2>Разделение началось</h2><p>Следующий шаг — перенести сюда Floot admin baseline: лиды, объекты, баннеры и pipeline, затем подключить отдельную серверную авторизацию и RBAC.</p></div></section>
    </main>
  </div>
}
