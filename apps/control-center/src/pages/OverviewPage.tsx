import { ArrowUpRight, ArrowRight, Clock3, Flame, UserRound, Activity, CheckCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageFrame } from '../components/PageFrame';
import { ActivityFeed } from '../components/ActivityFeed';
import { usePulseCounts, usePulseEvents, usePulseLeads, usePulseProfiles, usePulseState, usePulseTasks } from '../data';

export function OverviewPage(){
 const state=usePulseState(),leads=usePulseLeads(),events=usePulseEvents(),profiles=usePulseProfiles(),tasks=usePulseTasks();
 const counts=usePulseCounts();
 const open=tasks.filter(t=>t.status!=='done').sort((a,b)=>Date.parse(a.dueAt)-Date.parse(b.dueAt));
 const stages=[['new','Новые'],['contacted','Связались'],['qualified','Подбор'],['showing','Показ'],['booking','Бронь'],['deal','Сделка']] as const;

 const dayMs=86400_000;
 const today=new Date();today.setHours(0,0,0,0);
 const activityDays=Array.from({length:7},(_,index)=>{
   const date=new Date(today.getTime()-(6-index)*dayMs);
   const next=new Date(date.getTime()+dayMs);
   const value=leads.filter(lead=>{const created=Date.parse(lead.createdAt);return created>=date.getTime()&&created<next.getTime()}).length;
   return {date,value,day:date.toLocaleDateString('ru-RU',{weekday:'short'}).replace('.',''),dateLabel:date.toLocaleDateString('ru-RU',{day:'2-digit',month:'short'}).replace('.','')};
 });
 const maxDay=Math.max(1,...activityDays.map(day=>day.value));
 const chartPoints=activityDays.map((day,index)=>{
   const x=38+index*87;
   const y=158-(day.value/maxDay)*104;
   return {x,y,...day};
 });
 const chartLine=chartPoints.map((point,index)=>`${index?'L':'M'} ${point.x} ${point.y}`).join(' ');
 const chartArea=`M ${chartPoints[0].x} 164 L ${chartPoints.map(point=>`${point.x} ${point.y}`).join(' L ')} L ${chartPoints[chartPoints.length-1].x} 164 Z`;
 const weekLeads=activityDays.reduce((sum,day)=>sum+day.value,0);
 const dealRate=counts.leadsTotal?Math.round((counts.leadStages.deal/counts.leadsTotal)*100):0;

 return <PageFrame eyebrow="PULSE CONTROL" title="Командный центр" description="Продажи, клиенты и работа команды — единая картина в реальном времени." action={<Link className="primaryAction" to="/leads">Открыть клиентов <ArrowUpRight size={16}/></Link>}>
  <section className="commandHero">
   <article className="pulseChartCard">
    <div className="pulseChartTop">
     <div><span className="kicker">ПУЛЬС ПРОДАЖ</span><h2>Динамика новых обращений</h2><p>Количество новых заявок по дням за последние семь дней.</p></div>
     <span className="periodBadge">7 дней</span>
    </div>
    <div className="pulseChartSummary"><strong>{weekLeads}</strong><span>новых обращений за период</span><small>{counts.activeLeads} клиентов сейчас в работе</small></div>
    <div className="pulseChart">
     <svg viewBox="0 0 600 185" role="img" aria-label="График новых обращений за семь дней">
      <defs>
       <linearGradient id="pulseLine" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#ff5260"/><stop offset="55%" stopColor="#f20d1d"/><stop offset="100%" stopColor="#ff9c72"/></linearGradient>
       <linearGradient id="pulseArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f20d1d" stopOpacity=".28"/><stop offset="100%" stopColor="#f20d1d" stopOpacity="0"/></linearGradient>
      </defs>
      {[55,91,127,163].map(y=><line key={y} x1="28" x2="570" y1={y} y2={y} className="chartGridLine"/>)}
      <path d={chartArea} fill="url(#pulseArea)"/>
      <path d={chartLine} fill="none" stroke="url(#pulseLine)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      {chartPoints.map(point=><g key={point.date.toISOString()}><circle cx={point.x} cy={point.y} r="7" className="chartPointHalo"/><circle cx={point.x} cy={point.y} r="3.5" className="chartPoint"/><text x={point.x} y={Math.max(18,point.y-13)} textAnchor="middle" className="chartValue">{point.value}</text></g>)}
     </svg>
     <div className="pulseChartLabels">{chartPoints.map(point=><span key={point.date.toISOString()}><b>{point.day}</b><small>{point.dateLabel}</small></span>)}</div>
    </div>
   </article>
   <div className="focusStack">
    <article className="focusCard conversionCard">
     <div className="focusCardHead"><span>Конверсия в сделку</span><Activity size={18}/></div>
     <div className="conversionBody"><div className="conversionRing" style={{background:`conic-gradient(#f20d1d ${dealRate*3.6}deg, rgba(255,255,255,.11) 0deg)`}}><div><strong>{dealRate}%</strong><small>сделки</small></div></div><div><b>{counts.leadStages.deal}</b><span>сделок в текущей базе</span><small>из {counts.leadsTotal} обращений</small></div></div>
    </article>
    <article className="focusCard focusQueue">
     <div className="focusCardHead"><span>Фокус команды</span><Clock3 size={18}/></div>
     <Link to="/tasks?filter=overdue"><b>{counts.overdueTasks}</b><span>Просрочено</span><ArrowUpRight size={15}/></Link>
     <Link to="/users?filter=hot"><b>{counts.hotProfiles}</b><span>Горячий интерес</span><ArrowUpRight size={15}/></Link>
     <Link to="/leads?filter=unassigned"><b>{counts.unassignedLeads}</b><span>Без менеджера</span><ArrowUpRight size={15}/></Link>
    </article>
   </div>
  </section>

  <section className="metrics crmMetrics">
   {[{label:'Клиенты в работе',value:counts.activeLeads,detail:counts.newLeads+' новых обращений',to:'/leads',Icon:UserRound},{label:'Горячий интерес',value:counts.hotProfiles,detail:'Люди, готовые к диалогу',to:'/users?filter=hot',Icon:Flame},{label:'Просроченные задачи',value:counts.overdueTasks,detail:'Требуют внимания команды',to:'/tasks?filter=overdue',Icon:Clock3},{label:'Без ответственного',value:counts.unassignedLeads,detail:'Назначьте менеджера',to:'/leads?filter=unassigned',Icon:CheckCheck}].map(({label,value,detail,to,Icon})=><Link to={to} className="metricLink" key={label}><article><div className="metricHeading"><span>{label}</span><Icon size={17}/></div><strong>{value}<ArrowUpRight size={18}/></strong><small>{detail}</small></article></Link>)}
  </section>
  <section className="panel pipelinePanel"><div className="sectionHeading"><div><span className="kicker">ДВИЖЕНИЕ К СДЕЛКЕ</span><h2>Клиенты по этапам</h2></div><Link to="/leads?view=board">Открыть доску <ArrowRight size={15}/></Link></div><div className="pipelineStages">{stages.map(([status,label],i)=>{const count=counts.leadStages[status]||0;return <Link key={status} to={'/leads?status='+status}><span><i style={{background:['#8495b1','#6282e6','#9a79d4','#d8a35c','#e16c78','#43a084'][i]}}/>{label}</span><b>{count}</b><div><i style={{width:Math.max(3,count/Math.max(1,counts.leadsTotal)*100)+'%'}}/></div></Link>})}</div></section>
  <div className="dashboardGrid"><section className="panel priorityPanel"><div className="sectionHeading"><div><span className="kicker">ПРИОРИТЕТНАЯ ОЧЕРЕДЬ</span><h2>Что сделать сейчас</h2></div><span className="countBadge">{counts.openTasks}</span></div>
   {!open.length?<div className="emptyState"><CheckCheck size={28}/><strong>Нет открытых задач</strong><span>Новые задачи появятся после обращений клиентов.</span></div>:<div className="workQueue">{open.slice(0,5).map(task=>{const lead=leads.find(l=>l.id===task.leadId);const late=Date.parse(task.dueAt)<Date.now();return <Link to={lead?'/leads?lead='+lead.id:'/tasks'} key={task.id}><span className={'queueMarker '+(late?'late':'')}><Clock3 size={17}/></span><div><b>{lead?.name||'Клиент'}</b><p>{task.title}</p><small className={late?'overdue':''}>{late?'Просрочено · ':''}{new Date(task.dueAt).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</small></div><ArrowUpRight size={16}/></Link>})}</div>}
   <Link className="panelFooterLink" to="/tasks">Все задачи <ArrowRight size={15}/></Link>
  </section><section className="panel interestPanel"><div className="sectionHeading"><div><span className="kicker">СИГНАЛЫ ИНТЕРЕСА</span><h2>Кто выбирает квартиру</h2></div><Flame size={20}/></div><div className="interestList">{[...profiles].sort((a,b)=>b.score-a.score).slice(0,5).map(p=><Link to={'/users?session='+encodeURIComponent(p.sessionId)} key={p.id}><span className={'scoreBadge '+p.priority}><b>{p.score}</b></span><div><b>{p.city||'Город пока не указан'}</b><small>{state.properties.find(x=>x.id===p.topPropertyId)?.name||p.scoreReasons[0]?.label||'Первые действия'}</small></div><ArrowUpRight size={15}/></Link>)}{!profiles.length&&<div className="emptyState"><UserRound size={26}/><strong>Знакомимся с аудиторией</strong><span>Профили появятся после действий в мини-приложении.</span></div>}</div><Link className="panelFooterLink" to="/users">Все посетители <ArrowRight size={15}/></Link></section></div>
  <section className="panel"><div className="sectionHeading"><div><span className="kicker">ЖИВАЯ ИСТОРИЯ</span><h2>Последние действия клиентов</h2></div><Link to="/analytics">Весь журнал <Activity size={15}/></Link></div><ActivityFeed events={events} state={state} compact/></section>
 </PageFrame>;
}
