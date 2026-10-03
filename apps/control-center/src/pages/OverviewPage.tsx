import React from 'react';
import { ArrowUpRight, ArrowRight, Clock3, Flame, UserRound, Activity, CheckCheck, CalendarRange, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageFrame } from '../components/PageFrame';
import { ActivityFeed } from '../components/ActivityFeed';
import { useControlTrend, usePulseCounts, usePulseEvents, usePulseLeads, usePulseProfiles, usePulseState, usePulseTasks, type ControlTrendDay } from '../data';

type TrendMetric='leads'|'events'|'visitors';
type TrendRange='7d'|'30d'|'90d'|'6m'|'12m'|'custom';
type TrendBucket={key:string;axis:string;label:string;start:string;end:string;leads:number;events:number;visitors:number};

const DAY_MS=86400_000;
const VLADIVOSTOK='Asia/Vladivostok';
const BUSINESS_DATE=new Intl.DateTimeFormat('en-CA',{timeZone:VLADIVOSTOK,year:'numeric',month:'2-digit',day:'2-digit'});
const RANGE_DAYS:Record<Exclude<TrendRange,'custom'>,number>={ '7d':7,'30d':30,'90d':90,'6m':180,'12m':365 };
const RANGE_OPTIONS:{id:TrendRange;label:string}[]=[
 {id:'7d',label:'7д'},{id:'30d',label:'30д'},{id:'90d',label:'90д'},{id:'6m',label:'6м'},{id:'12m',label:'12м'},{id:'custom',label:'Свой'}
];
const METRIC_META:Record<TrendMetric,{label:string;title:string;description:string;summary:string}>={
 leads:{label:'Обращения',title:'Динамика новых обращений',description:'Новые заявки клиентов за выбранный период.',summary:'новых обращений'},
 events:{label:'Активность',title:'Активность клиентов',description:'Все зафиксированные действия клиентов в Mini App.',summary:'действий клиентов'},
 visitors:{label:'Посетители',title:'Уникальные посетители',description:'Уникальные сессии с активностью за выбранный период.',summary:'уникальных посетителей'},
};
const isoDate=(date:Date)=>date.toISOString().slice(0,10);
const parseIso=(value:string)=>new Date(value+'T00:00:00Z');
const addDays=(value:string,days:number)=>isoDate(new Date(parseIso(value).getTime()+days*DAY_MS));
const businessDate=(value:string|Date)=>BUSINESS_DATE.format(value instanceof Date?value:new Date(value));
const formatShort=(value:string)=>parseIso(value).toLocaleDateString('ru-RU',{day:'numeric',month:'short',timeZone:'UTC'}).replace('.','');
const formatMonth=(value:string)=>parseIso(value+'-01').toLocaleDateString('ru-RU',{month:'short',year:'2-digit',timeZone:'UTC'}).replace('.','');
const formatFull=(value:string)=>parseIso(value).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
const daysInclusive=(from:string,to:string)=>Math.floor((parseIso(to).getTime()-parseIso(from).getTime())/DAY_MS)+1;

function localTrend(from:string,to:string,leads:{createdAt:string}[],events:{createdAt:string;sessionId:string}[]){
 const length=Math.max(1,daysInclusive(from,to));
 const previousTo=addDays(from,-1),previousFrom=addDays(previousTo,-(length-1));
 const dayMap=new Map<string,{date:string;leads:number;events:number;visitors:number;visitorIds:Set<string>}>();
 for(let index=0;index<length;index++){const date=addDays(from,index);dayMap.set(date,{date,leads:0,events:0,visitors:0,visitorIds:new Set()});}
 leads.forEach(lead=>{const date=businessDate(lead.createdAt);const day=dayMap.get(date);if(day)day.leads++});
 events.forEach(event=>{const date=businessDate(event.createdAt);const day=dayMap.get(date);if(day){day.events++;day.visitorIds.add(event.sessionId)}});
 const days:ControlTrendDay[]=[...dayMap.values()].map(day=>({date:day.date,leads:day.leads,events:day.events,visitors:day.visitorIds.size}));
 const inRange=(value:string,start:string,end:string)=>{const date=businessDate(value);return date>=start&&date<=end};
 const currentVisitors=new Set(events.filter(event=>inRange(event.createdAt,from,to)).map(event=>event.sessionId)).size;
 const previousVisitors=new Set(events.filter(event=>inRange(event.createdAt,previousFrom,previousTo)).map(event=>event.sessionId)).size;
 return {
  from,to,timezone:VLADIVOSTOK,days,
  totals:{
   leads:leads.filter(lead=>inRange(lead.createdAt,from,to)).length,
   events:events.filter(event=>inRange(event.createdAt,from,to)).length,
   visitors:currentVisitors,
  },
  previous:{
   leads:leads.filter(lead=>inRange(lead.createdAt,previousFrom,previousTo)).length,
   events:events.filter(event=>inRange(event.createdAt,previousFrom,previousTo)).length,
   visitors:previousVisitors,
  },
 };
}

function aggregateTrend(days:ControlTrendDay[]):TrendBucket[]{
 if(days.length<=31)return days.map(day=>({key:day.date,axis:formatShort(day.date),label:formatFull(day.date),start:day.date,end:day.date,leads:day.leads,events:day.events,visitors:day.visitors}));
 if(days.length<=120){
  const result:TrendBucket[]=[];
  for(let index=0;index<days.length;index+=7){
   const chunk=days.slice(index,index+7),start=chunk[0].date,end=chunk[chunk.length-1].date;
   result.push({
    key:start,axis:formatShort(start),label:start===end?formatFull(start):formatShort(start)+' — '+formatShort(end),start,end,
    leads:chunk.reduce((sum,item)=>sum+item.leads,0),
    events:chunk.reduce((sum,item)=>sum+item.events,0),
    visitors:chunk.reduce((sum,item)=>sum+item.visitors,0),
   });
  }
  return result;
 }
 const months=new Map<string,TrendBucket>();
 days.forEach(day=>{
  const key=day.date.slice(0,7);
  const existing=months.get(key);
  if(existing){existing.end=day.date;existing.leads+=day.leads;existing.events+=day.events;existing.visitors+=day.visitors;}
  else months.set(key,{key,axis:formatMonth(key),label:parseIso(day.date).toLocaleDateString('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'}),start:day.date,end:day.date,leads:day.leads,events:day.events,visitors:day.visitors});
 });
 return [...months.values()];
}

export function OverviewPage(){
 const state=usePulseState(),leads=usePulseLeads(),events=usePulseEvents(),profiles=usePulseProfiles(),tasks=usePulseTasks();
 const counts=usePulseCounts();
 const open=tasks.filter(t=>t.status!=='done').sort((a,b)=>Date.parse(a.dueAt)-Date.parse(b.dueAt));
 const stages=[['new','Новые'],['contacted','Связались'],['qualified','Подбор'],['showing','Показ'],['booking','Бронь'],['deal','Сделка']] as const;

 const [trendRange,setTrendRange]=React.useState<TrendRange>('7d');
 const [trendMetric,setTrendMetric]=React.useState<TrendMetric>('leads');
 const today=businessDate(new Date());
 const [customFrom,setCustomFrom]=React.useState(()=>addDays(today,-29));
 const [customTo,setCustomTo]=React.useState(today);
 const presetDays=trendRange==='custom'?null:RANGE_DAYS[trendRange];
 const rangeFrom=trendRange==='custom'?customFrom:addDays(today,-((presetDays??7)-1));
 const rangeTo=trendRange==='custom'?customTo:today;
 const safeFrom=rangeFrom<=rangeTo?rangeFrom:rangeTo;
 const safeTo=rangeTo>=rangeFrom?rangeTo:rangeFrom;
 const trendQuery=useControlTrend(safeFrom,safeTo);
 const fallbackTrend=React.useMemo(()=>localTrend(safeFrom,safeTo,leads,events),[safeFrom,safeTo,leads,events]);
 const trend=trendQuery.data??fallbackTrend;
 const buckets=React.useMemo(()=>aggregateTrend(trend.days),[trend.days]);
 const metric=METRIC_META[trendMetric];
 const values=buckets.map(bucket=>bucket[trendMetric]);
 const maxValue=Math.max(1,...values);
 const chartMax=maxValue<=4?4:Math.ceil(maxValue/4)*4;
 const chartLeft=44,chartRight=566,chartTop=30,chartBottom=154;
 const chartPoints=buckets.map((bucket,index)=>{
  const x=buckets.length===1?305:chartLeft+index*((chartRight-chartLeft)/(buckets.length-1));
  const value=bucket[trendMetric];
  const y=chartBottom-(value/chartMax)*(chartBottom-chartTop);
  return {...bucket,value,x,y};
 });
 const chartLine=chartPoints.length?chartPoints.map((point,index)=>`${index?'L':'M'} ${point.x} ${point.y}`).join(' '):'';
 const chartArea=chartPoints.length?`M ${chartPoints[0].x} ${chartBottom+5} L ${chartPoints.map(point=>`${point.x} ${point.y}`).join(' L ')} L ${chartPoints[chartPoints.length-1].x} ${chartBottom+5} Z`:'';
 const labelStep=Math.max(1,Math.ceil(chartPoints.length/7));
 const axisPoints=chartPoints.filter((_,index)=>index%labelStep===0||index===chartPoints.length-1);
 const [hoveredPoint,setHoveredPoint]=React.useState<number|null>(null);
 React.useEffect(()=>setHoveredPoint(null),[trendMetric,trendRange,safeFrom,safeTo]);
 const activeIndex=hoveredPoint??Math.max(0,chartPoints.length-1);
 const activePoint=chartPoints[activeIndex];
 const currentTotal=trend.totals[trendMetric],previousTotal=trend.previous[trendMetric];
 const changePct=previousTotal>0?Math.round(((currentTotal-previousTotal)/previousTotal)*100):null;
 const bucketTotal=values.reduce((sum,value)=>sum+value,0);
 const average=buckets.length?Math.round((bucketTotal/buckets.length)*10)/10:0;
 const peak=chartPoints.reduce<(typeof chartPoints)[number]|null>((best,point)=>!best||point.value>best.value?point:best,null);
 const granularity=trend.days.length<=31?'день':trend.days.length<=120?'неделю':'месяц';
 const periodText=safeFrom===safeTo?formatFull(safeFrom):formatShort(safeFrom)+' — '+formatShort(safeTo);
 const dealRate=counts.leadsTotal?Math.round((counts.leadStages.deal/counts.leadsTotal)*100):0;

 return <PageFrame eyebrow="PULSE CONTROL" title="Командный центр" description="Продажи, клиенты и работа команды — единая картина в реальном времени." action={<Link className="primaryAction" to="/leads">Открыть клиентов <ArrowUpRight size={16}/></Link>}>
  <section className="commandHero">
   <article className="pulseChartCard">
    <div className="pulseChartTop">
     <div><span className="kicker">ПУЛЬС ПРОДАЖ</span><h2>{metric.title}</h2><p>{metric.description}</p></div>
     <span className="pulsePeriodCaption"><CalendarRange size={14}/>{periodText}</span>
    </div>

    <div className="pulseChartControls">
     <div className="pulseMetricTabs" role="tablist" aria-label="Показатель графика">
      {(Object.keys(METRIC_META) as TrendMetric[]).map(key=><button key={key} role="tab" aria-selected={trendMetric===key} onClick={()=>setTrendMetric(key)}>{METRIC_META[key].label}</button>)}
     </div>
     <div className="pulseRangeTabs" aria-label="Период графика">
      {RANGE_OPTIONS.map(option=><button key={option.id} aria-pressed={trendRange===option.id} onClick={()=>setTrendRange(option.id)}>{option.label}</button>)}
     </div>
    </div>
    {trendRange==='custom'&&<div className="pulseCustomRange">
     <label><span>От</span><input type="date" value={customFrom} max={customTo} onChange={e=>setCustomFrom(e.target.value||customFrom)}/></label>
     <span>—</span>
     <label><span>До</span><input type="date" value={customTo} min={customFrom} max={today} onChange={e=>setCustomTo(e.target.value||customTo)}/></label>
     <small>До 366 дней</small>
    </div>}

    <div className="pulseChartSummary">
     <strong>{currentTotal}</strong><span>{metric.summary} за период</span>
     <small className={changePct===null?'':changePct>0?'trendUp':changePct<0?'trendDown':'trendFlat'}><TrendingUp size={13}/>{changePct===null?(currentTotal>0?'Новый период':'Нет данных для сравнения'):`${changePct>0?'+':''}${changePct}% к прошлому периоду`}</small>
    </div>

    <div className="pulseChartInsights">
     <span><small>Среднее / {granularity}</small><b>{average.toLocaleString('ru-RU')}</b></span>
     <span><small>Пиковый интервал</small><b>{peak?peak.value:0}<em>{peak?' · '+peak.axis:''}</em></b></span>
     <span><small>Сейчас в работе</small><b>{counts.activeLeads}</b></span>
    </div>

    <div className="pulseChart" aria-busy={trendQuery.loading}>
     {trendQuery.loading&&<span className="pulseChartStatus">Обновляем данные…</span>}
     {trendQuery.error&&<span className="pulseChartStatus error">Сервер недоступен — показаны уже загруженные данные</span>}
     {activePoint&&<div className="pulseChartTooltip" style={{left:(activePoint.x/600*100)+'%',top:Math.max(3,(activePoint.y/185*100)-4)+'%'}}><b>{activePoint.value}</b><span>{activePoint.label}</span></div>}
     <svg viewBox="0 0 600 185" role="img" aria-label={metric.title+' · '+periodText}>
      <defs>
       <linearGradient id="pulseLine" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#ff5260"/><stop offset="55%" stopColor="#f20d1d"/><stop offset="100%" stopColor="#ff9c72"/></linearGradient>
       <linearGradient id="pulseArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f20d1d" stopOpacity=".28"/><stop offset="100%" stopColor="#f20d1d" stopOpacity="0"/></linearGradient>
      </defs>
      {[0,1,2,3,4].map(step=>{const value=Math.round(chartMax*(4-step)/4);const y=chartTop+step*((chartBottom-chartTop)/4);return <g key={step}><line x1={chartLeft} x2={chartRight} y1={y} y2={y} className="chartGridLine"/><text x="8" y={y+3} className="chartAxisValue">{value}</text></g>})}
      {chartArea&&<path d={chartArea} fill="url(#pulseArea)"/>}
      {chartLine&&<path d={chartLine} fill="none" stroke="url(#pulseLine)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>}
      {chartPoints.map((point,index)=>{
       const hitWidth=Math.max(18,(chartRight-chartLeft)/Math.max(1,chartPoints.length));
       return <g key={point.key} onMouseEnter={()=>setHoveredPoint(index)} onMouseLeave={()=>setHoveredPoint(null)} onClick={()=>setHoveredPoint(index)} tabIndex={0} role="button" aria-label={point.label+': '+point.value} onFocus={()=>setHoveredPoint(index)} onBlur={()=>setHoveredPoint(null)}>
        <rect x={point.x-hitWidth/2} y="18" width={hitWidth} height="146" fill="transparent"/>
        <circle cx={point.x} cy={point.y} r={activeIndex===index?8:6} className="chartPointHalo"/>
        <circle cx={point.x} cy={point.y} r={activeIndex===index?4.2:3.2} className="chartPoint"/>
        {chartPoints.length<=8&&<text x={point.x} y={Math.max(18,point.y-13)} textAnchor="middle" className="chartValue">{point.value}</text>}
       </g>;
      })}
     </svg>
     <div className="pulseChartLabels">{axisPoints.map(point=><span key={point.key} style={{left:(point.x/600*100)+'%'}}><b>{point.axis}</b></span>)}</div>
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
