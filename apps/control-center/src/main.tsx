import React from "react";
import ReactDOM from "react-dom/client";
import { Building2, UsersRound, LayoutDashboard, Handshake, BadgePercent, Images, BarChart3, ShieldCheck } from "lucide-react";
import "./styles.css";

const sections=[
  ["Обзор",LayoutDashboard],["Лиды",Handshake],["Пользователи",UsersRound],["Объекты",Building2],
  ["Ипотека",BadgePercent],["Контент",Images],["Аналитика",BarChart3]
] as const;

function App(){
  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><span className="mark"><i/><i/><i/></span><div><strong>PULSE Control</strong><small>private workspace</small></div></div>
      <nav>{sections.map(([label,Icon],i)=><button className={i===0?"active":""} key={label}><Icon size={18}/><span>{label}</span></button>)}</nav>
      <div className="secure"><ShieldCheck size={17}/><span>Отдельное приложение<br/><small>не входит в Mini App bundle</small></span></div>
    </aside>
    <main>
      <header><div><span>PULSE.DV</span><h1>Control Center</h1></div><div className="status">Architecture split started</div></header>
      <section className="hero"><span>Этап 1</span><h2>Control Center вынесен из клиентского приложения</h2><p>Legacy Floot admin сохранён в <code>legacy-floot</code>. Дальше переносим CRM-модули сюда по одному: Leads → Objects → Mortgage → Content → Analytics.</p></section>
      <section className="grid">{["Лиды и pipeline","Объекты и застройщики","PULSE Select / ипотека","Контент и баннеры"].map((x,i)=><article key={x}><b>0{i+1}</b><strong>{x}</strong><span>{i===0?"Первый модуль миграции":"Следующий этап"}</span></article>)}</section>
    </main>
  </div>
}
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);
