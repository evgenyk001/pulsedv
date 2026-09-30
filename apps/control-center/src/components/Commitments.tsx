import React from 'react';
import {Link} from 'react-router-dom';
import {ArrowUpRight,CalendarCheck2,Clock3} from 'lucide-react';
import {loadJourneys,type JourneyEntry} from '../../../../packages/journey/client';
import {usePulseLeads} from '../data';

export function Commitments(){
 const leads=usePulseLeads();
 const [items,setItems]=React.useState<JourneyEntry[]>([]),[error,setError]=React.useState('');
 React.useEffect(()=>{let live=true;loadJourneys().then(r=>{if(live)setItems(r.items)}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[leads]);
 const open=items.filter(i=>!['deal','closed','lost'].includes(i.status)&&i.journey.nextStep&&!i.journey.nextStep.done).sort((a,b)=>Date.parse(a.journey.nextStep!.dueAt)-Date.parse(b.journey.nextStep!.dueAt));
 const overdue=open.filter(item=>Date.parse(item.journey.nextStep!.dueAt)<Date.now()).length;
 return <section className="panel commitmentsPanel">
  <div className="commitmentsHead">
   <div><span className="kicker">ОБЯЗАТЕЛЬСТВА КОМАНДЫ</span><h2>Договорённости с клиентами</h2><p>Что команда обещала сделать дальше и где срок уже требует внимания.</p></div>
   <div className="commitmentsSummary"><span><Clock3 size={15}/><b>{overdue}</b><small>просрочено</small></span><span><CalendarCheck2 size={15}/><b>{open.length}</b><small>запланировано</small></span></div>
  </div>
  {error&&<p className="errorNotice" role="alert">{error}</p>}
  <div className="commitmentsList">
   {!open.length&&<div className="commitmentsEmpty"><CalendarCheck2 size={20}/><span>Открытых договорённостей пока нет. Следующий шаг можно запланировать в карточке лида.</span></div>}
   {open.slice(0,6).map(item=>{const lead=leads.find(l=>l.id===item.leadId);const late=Date.parse(item.journey.nextStep!.dueAt)<Date.now();return <Link key={item.leadId} to={'/leads?lead='+item.leadId}>
    <span className={'commitmentDot '+(late?'late':'')}/>
    <div><b>{lead?.name||'Клиент'}</b><small>{item.journey.nextStep!.title}</small></div>
    <time className={late?'overdue':''}>{new Date(item.journey.nextStep!.dueAt).toLocaleString('ru-RU',{timeZone:'Asia/Vladivostok',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</time>
    <ArrowUpRight size={15}/>
   </Link>})}
  </div>
  <Link className="commitmentsFooter" to="/journey">Календарь и клиенты без следующего шага <ArrowUpRight size={15}/></Link>
 </section>;
}