import { JourneyPage } from './pages/JourneyPage';
import { runtime } from "../../../packages/pulse-data/runtime";
import React from "react";
import { usePulseLeads, usePulseTasks } from "./data";
import { NavLink, Route, Routes, useLocation, Link } from "react-router-dom";
import {
  Menu, X, ArrowUpRight, Bell, LayoutDashboard, Handshake, UsersRound, Building2, BadgePercent,
  Sparkles, Images, ChartNoAxesCombined, Settings2, ListChecks
} from "lucide-react";
import { OverviewPage } from "./pages/OverviewPage";
import { LeadsPage } from "./pages/LeadsPage";
import { UsersPage } from "./pages/UsersPage";
import { TasksPage } from "./pages/TasksPage";
import { ObjectsPage } from "./pages/ObjectsPage";
import { MortgagePage } from "./pages/MortgagePage";
import { SelectPage } from "./pages/SelectPage";
import { ContentPage } from "./pages/ContentPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { SettingsPage } from "./pages/SettingsPage";

const sections=[
  {to:"/",label:"Обзор",icon:LayoutDashboard,end:true},
  {to:"/leads",label:"Лиды",icon:Handshake},
  {to:"/users",label:"Пользователи",icon:UsersRound},
  {to:"/journey",label:"Подборки и показы",icon:Handshake},
  {to:"/tasks",label:"Задачи",icon:ListChecks},
  {to:"/objects",label:"Объекты",icon:Building2},
  {to:"/mortgage",label:"Ипотека",icon:BadgePercent},
  {to:"/select",label:"PULSE Select",icon:Sparkles},
  {to:"/content",label:"Контент",icon:Images},
  {to:"/analytics",label:"Аналитика",icon:ChartNoAxesCombined},
  {to:"/settings",label:"Настройки",icon:Settings2},
];

export function App(){
  const [menu,setMenu]=React.useState(false);
  const location=useLocation();
  const tasks=usePulseTasks();const leads=usePulseLeads();
  const overdue=tasks.filter(t=>t.status!=="done"&&Date.parse(t.dueAt)<Date.now()).length;
  React.useEffect(()=>setMenu(false),[location.pathname]);
  React.useEffect(()=>{const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenu(false)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[]);
  return <div className={"control"+(menu?" menuOpen":"")}>
    {menu&&<button className="menuScrim" aria-label="Закрыть меню" onClick={()=>setMenu(false)}/>}
    <aside className="sidebar">
      <div className="brand">
        <span className="mark"><i/><i/><i/></span>
        <div><b>PULSE Control</b><small>Рабочее пространство</small></div>
      </div>
      <div className="navCaption">РАБОЧЕЕ ПРОСТРАНСТВО</div>
      <nav aria-label="Разделы CRM">
        {sections.filter(section=>!runtime.enabled||runtime.member?.role!=="manager"||["/","/leads","/users","/tasks","/analytics","/journey"].includes(section.to)).map(({to,label,icon:Icon,end})=>
          <NavLink key={to} to={to} end={end} className={({isActive})=>isActive?"active":undefined}>
            <Icon size={18}/><span>{label}</span>{to==="/tasks"&&overdue>0&&<em>{overdue}</em>}{to==="/leads"&&leads.some(l=>l.status==="new")&&<em>{leads.filter(l=>l.status==="new").length}</em>}
          </NavLink>
        )}
      </nav>
      <div className="sidebarFoot"><span className="workspaceAvatar">P</span><div><b>PULSE.DV</b><small>Команда недвижимости</small></div></div>
    </aside>
    <main>
      <div className="workspaceBar">
        <button className="mobileMenu" aria-label={menu?"Скрыть меню":"Открыть меню"} aria-expanded={menu} onClick={()=>setMenu(!menu)}>{menu?<X size={20}/>:<Menu size={20}/>}</button>
        <div className="breadcrumb">Рабочее пространство <span>/</span> <b>{sections.find(s=>s.to===location.pathname)?.label||"Обзор"}</b></div>
        <div className="workspaceActions"><span className="workspaceDate">{new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}</span><Link to="/tasks?filter=overdue" className="notificationsLink" aria-label={"Просроченные задачи: "+overdue}><Bell size={17}/>{overdue>0&&<i>{overdue}</i>}</Link><a href="../mini-app/" target="_blank" rel="noreferrer">Мини-приложение <ArrowUpRight size={15}/></a></div>
      </div>
      <Routes>
        <Route path="/" element={<OverviewPage/>}/>
        <Route path="/leads" element={<LeadsPage/>}/>
        <Route path="/users" element={<UsersPage/>}/>
        <Route path="/journey" element={<JourneyPage/>}/>
        <Route path="/tasks" element={<TasksPage/>}/>
        <Route path="/objects" element={runtime.enabled&&runtime.member?.role==="manager"?<p>Раздел доступен администратору.</p>:<ObjectsPage/>}/>
        <Route path="/mortgage" element={runtime.enabled&&runtime.member?.role==="manager"?<p>Раздел доступен администратору.</p>:<MortgagePage/>}/>
        <Route path="/select" element={runtime.enabled&&runtime.member?.role==="manager"?<p>Раздел доступен администратору.</p>:<SelectPage/>}/>
        <Route path="/content" element={runtime.enabled&&runtime.member?.role==="manager"?<p>Раздел доступен администратору.</p>:<ContentPage/>}/>
        <Route path="/analytics" element={<AnalyticsPage/>}/>
        <Route path="/settings" element={runtime.enabled&&runtime.member?.role==="manager"?<p>Раздел доступен администратору.</p>:<SettingsPage/>}/>
      </Routes>
    </main>
  </div>;
}
