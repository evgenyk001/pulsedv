import React from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight, CalendarDays, Compass, Building2, MessageCircle, X} from 'lucide-react';
import {useClientJourneys} from '../helpers/useClientJourneys';
import {clientUpdates} from '../../../../packages/journey/updates';
import './clientPolish.css';
function stored(key:string){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
export function ContinueChoice(){
 const {data}=useClientJourneys();
 const last=stored('pulse.last-property'),selection=stored('pulse_selection_current_v2');
 const [hidden,setHidden]=React.useState(()=>stored('pulse.continue-hidden'));
 const next=data?.items.flatMap(e=>e.journey.showings.filter(s=>s.status==='confirmed'&&Date.parse(s.at)>Date.now()).map(s=>({...s,leadId:e.leadId}))).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))[0];
 const recent=clientUpdates(data?.items||[])[0];
 const activeSelection=selection&&(selection.showResult===true||(Number.isInteger(selection.step)&&selection.step>0));
 const item=next?{key:'showing:'+next.id+next.at,to:'/journey?lead='+next.leadId,title:'У вас запланирован показ',detail:new Date(next.at).toLocaleString('ru-RU',{timeZone:'Asia/Vladivostok',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})+' · время Владивостока',action:'Посмотреть детали',Icon:CalendarDays}
 :recent?{key:recent.id,to:'/journey?lead='+recent.leadId,title:recent.title,detail:'Есть обновление по вашему обращению',action:'Открыть обращение',Icon:MessageCircle}
 :activeSelection?{key:'selection:'+JSON.stringify(selection),to:'/selection',title:selection.showResult?'Ваша подборка сохранена':'Продолжим подбор?',detail:[selection.city,selection.showResult?'Результаты готовы':'Шаг '+(Math.min(3,selection.step)+1)+' из 4'].filter(Boolean).join(' · '),action:selection.showResult?'Смотреть варианты':'Продолжить',Icon:Compass}
 :last&&typeof last.id==='string'&&typeof last.name==='string'?{key:'property:'+last.id+last.at,to:'/property/'+encodeURIComponent(last.id),title:last.name,detail:'Вы недавно смотрели этот проект',action:'Вернуться к проекту',Icon:Building2}:null;
 if(!item||hidden===item.key)return null;
 const Icon=item.Icon;
 return <section className="pulseResume" aria-label="Продолжить выбор"><Link to={item.to}><span className="pulseResumeIcon"><Icon size={22}/></span><span className="pulseResumeCopy"><strong>{item.title}</strong><small>{item.detail}</small><span className="pulseResumeAction">{item.action}<ArrowRight size={14}/></span></span></Link><button aria-label="Скрыть продолжение выбора" onClick={()=>{setHidden(item.key);try{localStorage.setItem('pulse.continue-hidden',JSON.stringify(item.key))}catch{}}}><X size={16}/></button></section>;
}
