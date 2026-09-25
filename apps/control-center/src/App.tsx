import { NavLink, Route, Routes } from "react-router-dom";
import {
  LayoutDashboard, Handshake, UsersRound, Building2, BadgePercent,
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
  {to:"/tasks",label:"Задачи",icon:ListChecks},
  {to:"/objects",label:"Объекты",icon:Building2},
  {to:"/mortgage",label:"Ипотека",icon:BadgePercent},
  {to:"/select",label:"PULSE Select",icon:Sparkles},
  {to:"/content",label:"Контент",icon:Images},
  {to:"/analytics",label:"Аналитика",icon:ChartNoAxesCombined},
  {to:"/settings",label:"Настройки",icon:Settings2},
];

export function App(){
  return <div className="control">
    <aside className="sidebar">
      <div className="brand">
        <span className="mark"><i/><i/><i/></span>
        <div><b>PULSE Control</b><small>Private workspace</small></div>
      </div>
      <nav>
        {sections.map(({to,label,icon:Icon,end})=>
          <NavLink key={to} to={to} end={end} className={({isActive})=>isActive?"active":undefined}>
            <Icon size={18}/><span>{label}</span>
          </NavLink>
        )}
      </nav>
      <div className="sidebarFoot">PULSE.DV · Control Center</div>
    </aside>
    <main>
      <Routes>
        <Route path="/" element={<OverviewPage/>}/>
        <Route path="/leads" element={<LeadsPage/>}/>
        <Route path="/users" element={<UsersPage/>}/>
        <Route path="/tasks" element={<TasksPage/>}/>
        <Route path="/objects" element={<ObjectsPage/>}/>
        <Route path="/mortgage" element={<MortgagePage/>}/>
        <Route path="/select" element={<SelectPage/>}/>
        <Route path="/content" element={<ContentPage/>}/>
        <Route path="/analytics" element={<AnalyticsPage/>}/>
        <Route path="/settings" element={<SettingsPage/>}/>
      </Routes>
    </main>
  </div>;
}
