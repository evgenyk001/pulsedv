import {GiveawayPage} from './pages/GiveawayPage';
import {SectionNavigator} from './components/SectionNavigator';
import {PageFrame} from './components/PageFrame';
import {useDialog} from './components/useDialog';
import {PartnersPage} from "./pages/PartnersPage";
import {BroadcastsPage} from './pages/BroadcastsPage';
import { JourneyPage } from './pages/JourneyPage';
import { runtime } from "../../../packages/pulse-data/runtime";
import { useRuntime } from "./RuntimeShell";
import { usePulseCounts } from "./data";
import React from "react";
import { NavLink, Route, Routes, useLocation, Link } from "react-router-dom";
import {
  Search, Menu, X, ArrowUpRight, Bell, LayoutDashboard, Handshake, UsersRound, Building2, BadgePercent,
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
  {to:"/partners",label:"Партнёры",group:"Работа",icon:UsersRound,end:false},
  {to:"/users",label:"Пользователи",group:"Работа",icon:UsersRound,end:false},
  {to:"/journey",label:"Подборки и показы",group:"Работа",icon:Handshake,end:false},
  {to:"/tasks",label:"Задачи",group:"Работа",icon:ListChecks,end:false},
  {to:"/objects",label:"Объекты",group:"Продукт",icon:Building2,end:false},
  {to:"/mortgage",label:"Ипотека",group:"Продукт",icon:BadgePercent,end:false},
  {to:"/select",label:"PULSE Select",group:"Продукт",icon:Sparkles,end:false},
  {to:"/content",label:"Контент",group:"Продукт",icon:Images,end:false},
  {to:"/giveaway",label:"Розыгрыш",group:"Продукт",icon:BadgePercent,end:false},
  {to:"/broadcasts",label:"Рассылки",group:"Продукт",icon:Bell,end:false},
  {to:"/analytics",label:"Аналитика",group:"Контроль",icon:ChartNoAxesCombined,end:false},
  {to:"/settings",label:"Настройки",group:"Контроль",icon:Settings2,end:false},
] as const;

const groups=["Работа","Продукт","Контроль"] as const;

export function App(){
  const [menu,setMenu]=React.useState(false);
  const [navigator,setNavigator]=React.useState(false);
  React.useEffect(()=>{const open=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&!document.querySelector('[role="dialog"],[role="alertdialog"],dialog[open]')){e.preventDefault();setMenu(false);setNavigator(true)}};window.addEventListener('keydown',open);return()=>window.removeEventListener('keydown',open)},[]);
  const [compact,setCompact]=React.useState(()=>window.matchMedia('(max-width:1024px)').matches);
  const location=useLocation();
  const workspaceRef=React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(()=>{const measure=()=>{if(workspaceRef.current)document.documentElement.style.setProperty('--control-overlay-top',Math.max(0,workspaceRef.current.getBoundingClientRect().bottom)+'px')};measure();const observer=new ResizeObserver(measure);if(workspaceRef.current)observer.observe(workspaceRef.current);window.addEventListener('resize',measure);window.addEventListener('scroll',measure,{passive:true});return()=>{observer.disconnect();window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure)}},[location.key]);
  useDialog(menu,()=>setMenu(false));
  React.useEffect(()=>{const media=window.matchMedia('(max-width:1024px)');const update=()=>{setCompact(media.matches);if(!media.matches)setMenu(false)};media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[]);
  const current=useRuntime();
  const counts=usePulseCounts();
  const overdue=counts.overdueTasks;
  const newLeads=counts.newLeads;
  const activeSection=sections.find(s=>s.to===location.pathname)||sections[0];
  const visibleSections=sections.filter(section=>!runtime.enabled||runtime.member?.role!=="manager"||["/","/leads","/users","/tasks","/analytics","/journey"].includes(section.to));
  React.useLayoutEffect(()=>{setMenu(false);setNavigator(false);window.scrollTo({top:0,left:0,behavior:'auto'});},[location.pathname]);
  React.useEffect(()=>{const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenu(false)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[]);
  return <div className={"control"+(menu?" menuOpen":"")}>
    {menu&&<button className="menuScrim" aria-label="Закрыть меню" onClick={()=>setMenu(false)}/>}
    <aside className="sidebar" inert={(compact&&!menu)||undefined} aria-hidden={compact&&!menu?true:undefined} role={menu?"dialog":undefined} aria-modal={menu?true:undefined} aria-label="Навигация PULSE Control" id="control-navigation">
      <div className="brand">
        <span className="mark"><i/><i/><i/></span>
        <div><b>PULSE Control</b><small>Рабочее пространство</small></div>
      </div>
      <button type="button" className="mobileNavClose" aria-label="Закрыть навигацию" onClick={()=>setMenu(false)}><X size={20}/></button>
      <div className="sidebarNav">
        <nav aria-label="Разделы CRM" className="groupedNav">
          {groups.map(group=>{
            const items=visibleSections.filter(section=>section.group===group);
            if(!items.length)return null;
            return <section className="navGroup" key={group}>
              <div className="navCaption">{group}</div>
              <div className="navGroupLinks">
                {items.map(({to,label,icon:Icon,end})=>
                  <NavLink key={to} onClick={()=>setMenu(false)} to={to} end={end} className={({isActive})=>isActive?"active":undefined}>
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
        <div><b>PULSEDV.RU</b><small>{current.enabled?(current.member?.role==="owner"?"Владелец":current.member?.role==="admin"?"Администратор":"Менеджер"):"Локальный режим"}</small></div>
      </div>
    </aside>
    {navigator&&<SectionNavigator sections={visibleSections} onClose={()=>setNavigator(false)}/>}
    <div id="control-record-root"/>
    <main id="control-main">
      <div className="workspaceBar" ref={workspaceRef}>
        <div className="workspaceLeft">
          <button className="mobileMenu" aria-label={menu?"Скрыть меню":"Открыть меню"} aria-controls="control-navigation" aria-expanded={menu} onClick={()=>setMenu(!menu)}>{menu?<X size={20}/>:<Menu size={20}/>}</button>
          <div className="workspaceSectionIcon"><activeSection.icon size={17}/></div>
          <div className="workspaceContext"><small>PULSE CONTROL</small><b>{activeSection.label}</b></div>
        </div>
        <div className="workspaceActions"><button className="workspaceJump" onClick={()=>{setMenu(false);setNavigator(true)}} aria-label="Быстрый переход"><Search size={17}/><span>Найти раздел</span><kbd>⌘ / Ctrl K</kbd></button>
          <span className="workspaceDate">{new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}</span>
          <Link to="/tasks?filter=overdue" className="notificationsLink" aria-label={"Просроченные задачи: "+overdue}><Bell size={17}/>{overdue>0&&<i>{overdue}</i>}</Link>
          <a className="miniAppLink" href="../mini-app/" target="_blank" rel="noreferrer">Мини-приложение <ArrowUpRight size={14}/></a>
        </div>
      </div>
      <Routes>
        <Route path="/" element={<OverviewPage/>}/>
        <Route path="/leads" element={<LeadsPage/>}/>
        <Route path="/partners" element={runtime.enabled&&runtime.member?.role==="manager"?<p>Раздел доступен администратору.</p>:<PartnersPage/>}/>
        <Route path="/users" element={<UsersPage/>}/>
        <Route path="/journey" element={<JourneyPage/>}/>
        <Route path="/tasks" element={<TasksPage/>}/>
        <Route path="/objects" element={runtime.enabled&&runtime.member?.role==="manager"?<p>Раздел доступен администратору.</p>:<ObjectsPage/>}/>
        <Route path="/mortgage" element={runtime.enabled&&runtime.member?.role==="manager"?<p>Раздел доступен администратору.</p>:<MortgagePage/>}/>
        <Route path="/select" element={runtime.enabled&&runtime.member?.role==="manager"?<p>Раздел доступен администратору.</p>:<SelectPage/>}/>
        <Route path="/content" element={runtime.enabled&&runtime.member?.role==="manager"?<p>Раздел доступен администратору.</p>:<ContentPage/>}/>
        <Route path="/giveaway" element={runtime.enabled&&runtime.member?.role==="manager"?<p>Раздел доступен администратору.</p>:<GiveawayPage/>}/>
        <Route path="/broadcasts" element={runtime.enabled&&runtime.member?.role==="manager"?<p>Раздел доступен администратору.</p>:<BroadcastsPage/>}/>
        <Route path="/analytics" element={<AnalyticsPage/>}/>
        <Route path="/settings" element={runtime.enabled&&runtime.member?.role==="manager"?<p>Раздел доступен администратору.</p>:<SettingsPage/>}/>
        <Route path="*" element={<PageFrame eyebrow="НАВИГАЦИЯ" title="Раздел не найден" description="Ссылка могла устареть. Выберите нужный раздел в меню." action={<Link className="primaryAction" to="/">Открыть обзор</Link>}><div className="emptyState"><strong>Продолжим работу</strong><span>Ваши данные сохранены в соответствующих разделах.</span></div></PageFrame>}/>
      </Routes>
    </main>
  </div>;
}
