import { JourneyPage } from './pages/JourneyPage';
import { runtime } from "../../../packages/pulse-data/runtime";
import { useRuntime } from "./RuntimeShell";
import React from "react";
import { NavLink, Route, Routes, useLocation, Link } from "react-router-dom";
import {
  Menu, X, ArrowUpRight, Bell, LayoutDashboard, Handshake, UsersRound, Building2, BadgePercent,
  Sparkles, Images, ChartNoAxesCombined, Settings2, ListChecks, ChevronRight
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
  {to:"/",label:"Обзор",group:"Работа",icon:LayoutDashboard,end:true},
  {to:"/leads",label:"Лиды",group:"Работа",icon:Handshake,end:false},
  {to:"/users",label:"Пользователи",group:"Работа",icon:UsersRound,end:false},
  {to:"/journey",label:"Подборки и показы",group:"Работа",icon:Handshake,end:false},
  {to:"/tasks",label:"Задачи",group:"Работа",icon:ListChecks,end:false},
  {to:"/objects",label:"Объекты",group:"Продукт",icon:Building2,end:false},
  {to:"/mortgage",label:"Ипотека",group:"Продукт",icon:BadgePercent,end:false},
  {to:"/select",label:"PULSE Select",group:"Продукт",icon:Sparkles,end:false},
  {to:"/content",label:"Контент",group:"Продукт",icon:Images,end:false},
  {to:"/analytics",label:"Аналитика",group:"Контроль",icon:ChartNoAxesCombined,end:false},
  {to:"/settings",label:"Настройки",group:"Контроль",icon:Settings2,end:false},
] as const;

const groups=["Работа","Продукт","Контроль"] as const;

export function App(){
  const [menu,setMenu]=React.useState(false);
  const location=useLocation();
  const current=useRuntime();
  const overdue=current.counts.overdueTasks;
  const newLeads=current.counts.newLeads;
  const activeSection=sections.find(s=>s.to===location.pathname)||sections[0];
  const visibleSections=sections.filter(section=>!runtime.enabled||runtime.member?.role!=="manager"||["/","/leads","/users","/tasks","/analytics","/journey"].includes(section.to));
  React.useEffect(()=>{setMenu(false);window.scrollTo({top:0,left:0,behavior:'auto'});},[location.pathname]);
  React.useEffect(()=>{const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenu(false)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[]);
  return <div className={"control"+(menu?" menuOpen":"")}>
    {menu&&<button className="menuScrim" aria-label="Закрыть меню" onClick={()=>setMenu(false)}/>}
    <aside className="sidebar">
      <div className="brand">
        <span className="mark"><i/><i/><i/></span>
        <div><b>PULSE Control</b><small>Command Center</small></div>
      </div>
      <div className="sidebarNav">
        <nav aria-label="Разделы CRM" className="groupedNav">
          {groups.map(group=>{
            const items=visibleSections.filter(section=>section.group===group);
            if(!items.length)return null;
            return <section className="navGroup" key={group}>
              <div className="navCaption">{group}</div>
              <div className="navGroupLinks">
                {items.map(({to,label,icon:Icon,end})=>
                  <NavLink key={to} to={to} end={end} className={({isActive})=>isActive?"active":undefined}>
                    <span className="navIcon"><Icon size={17}/></span>
                    <span>{label}</span>
                    {to==="/tasks"&&overdue>0&&<em>{overdue}</em>}
                    {to==="/leads"&&newLeads>0&&<em>{newLeads}</em>}
                    <ChevronRight className="navChevron" size={14}/>
                  </NavLink>
                )}
              </div>
            </section>;
          })}
        </nav>
      </div>
      <div className="sidebarFoot">
        <span className="workspaceAvatar">P</span>
        <div><b>PULSE.DV</b><small>{current.enabled?(current.member?.role==="owner"?"Владелец":current.member?.role==="admin"?"Администратор":"Менеджер"):"Демонстрация"}</small></div>
      </div>
    </aside>
    <main>
      <div className="workspaceBar">
        <div className="workspaceLeft">
          <button className="mobileMenu" aria-label={menu?"Скрыть меню":"Открыть меню"} aria-expanded={menu} onClick={()=>setMenu(!menu)}>{menu?<X size={20}/>:<Menu size={20}/>}</button>
          <div className="workspaceSectionIcon"><activeSection.icon size={17}/></div>
          <div className="workspaceContext"><small>PULSE CONTROL</small><b>{activeSection.label}</b></div>
        </div>
        <div className="workspaceActions">
          <span className="workspaceDate">{new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}</span>
          <Link to="/tasks?filter=overdue" className="notificationsLink" aria-label={"Просроченные задачи: "+overdue}><Bell size={17}/>{overdue>0&&<i>{overdue}</i>}</Link>
          <a className="miniAppLink" href="../mini-app/" target="_blank" rel="noreferrer">Мини-приложение <ArrowUpRight size={14}/></a>
        </div>
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
