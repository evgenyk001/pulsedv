import { NavLink, Route, Routes } from "react-router-dom";
import { LayoutDashboard, UsersRound, Building2, Handshake, BadgePercent, Sparkles, Images, BarChart3, Settings2, ShieldCheck } from "lucide-react";

const sections=[
  {to:"/",label:"Обзор",icon:LayoutDashboard},
  {to:"/leads",label:"Лиды",icon:UsersRound},
  {to:"/objects",label:"Объекты",icon:Building2},
  {to:"/deals",label:"Сделки",icon:Handshake},
  {to:"/mortgage",label:"Ипотека",icon:BadgePercent},
  {to:"/select",label:"PULSE Select",icon:Sparkles},
  {to:"/content",label:"Контент",icon:Images},
  {to:"/analytics",label:"Аналитика",icon:BarChart3},
  {to:"/settings",label:"Настройки",icon:Settings2},
];

function Placeholder({title,text}:{title:string;text:string}){
  return <section className="cc-card cc-placeholder">
    <span className="cc-kicker">PULSE Control</span>
    <h1>{title}</h1>
    <p>{text}</p>
    <div className="cc-status"><ShieldCheck size={18}/><span>Раздел вынесен из клиентского Mini App и готов к подключению backend/RBAC.</span></div>
  </section>
}

function Dashboard(){
  return <div className="cc-dashboard">
    <section className="cc-hero">
      <div><span className="cc-kicker">PULSE Control</span><h1>Операционный центр PULSE.DV</h1><p>Лиды, объекты, ипотека, PULSE Select и контент — отдельно от клиентского приложения.</p></div>
      <div className="cc-private"><ShieldCheck size={20}/><div><b>Private workspace</b><small>Публичный Mini App не содержит admin-кода</small></div></div>
    </section>
    <div className="cc-metrics">
      <article><span>Новые лиды</span><strong>—</strong><small>подключим backend</small></article>
      <article><span>Объекты</span><strong>—</strong><small>единый каталог</small></article>
      <article><span>Задачи</span><strong>—</strong><small>pipeline менеджеров</small></article>
      <article><span>Конверсия</span><strong>—</strong><small>после событий</small></article>
    </div>
    <section className="cc-card">
      <span className="cc-kicker">Следующий этап</span>
      <h2>Переносим живые функции Control Center</h2>
      <p>Сначала auth/RBAC и база, затем Leads → Objects → Mortgage → Content. Старый Floot admin-source сохранён отдельно как migration reference.</p>
    </section>
  </div>
}

export function ControlCenterApp(){
  return <div className="cc-app">
    <aside className="cc-sidebar">
      <div className="cc-brand"><div className="cc-logo"><i/><i/><i/></div><div><b>PULSE Control</b><span>Private workspace</span></div></div>
      <nav>{sections.map(({to,label,icon:Icon})=><NavLink key={to} to={to} end={to==="/"}><Icon size={18}/><span>{label}</span></NavLink>)}</nav>
      <div className="cc-foot">PULSE.DV · Control Center</div>
    </aside>
    <main className="cc-main">
      <Routes>
        <Route path="/" element={<Dashboard/>}/>
        <Route path="/leads" element={<Placeholder title="Лиды" text="Вынесем pipeline, timeline пользователя, статусы и назначение менеджеров."/>}/>
        <Route path="/objects" element={<Placeholder title="Объекты" text="Застройщики, ЖК, корпуса, планировки, цены и медиа из единого источника данных."/>}/>
        <Route path="/deals" element={<Placeholder title="Сделки" text="Этапы сделки, задачи и история действий менеджера."/>}/>
        <Route path="/mortgage" element={<Placeholder title="Ипотека" text="Правила программ, банковские офферы, verified_at и источник условий."/>}/>
        <Route path="/select" element={<Placeholder title="PULSE Select" text="Настройка правил ранжирования, весов и объяснений подбора."/>}/>
        <Route path="/content" element={<Placeholder title="Контент" text="Баннеры, промо, onboarding и клиентские коммуникации."/>}/>
        <Route path="/analytics" element={<Placeholder title="Аналитика" text="События, воронки, источники и конверсии."/>}/>
        <Route path="/settings" element={<Placeholder title="Настройки" text="Команда, роли, права и системные настройки."/>}/>
      </Routes>
    </main>
  </div>
}
