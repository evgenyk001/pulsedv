import React from 'react';
import {Link} from 'react-router-dom';
import {useClientJourneys} from '../helpers/useClientJourneys';
import {clientUpdates} from '../../../../packages/journey/updates';
import './clientPolish.css';
function stored(key:string){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
export function ContinueChoice(){
 const {data}=useClientJourneys();const last=stored('pulse.last-property'),selection=stored('pulse_selection_current_v2');
 const updates=clientUpdates(data?.items||[]);const next=data?.items.flatMap(e=>e.journey.showings.filter(s=>s.status==='confirmed'&&Date.parse(s.at)>Date.now()).map(s=>({...s,leadId:e.leadId}))).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))[0];
 const recent=updates[0];const entry=data?.items[0];
 if(!last&&!selection&&!entry)return null;
 return <section className="pulseContinue"><h2>Продолжить выбор</h2>{next&&<Link to={'/journey?lead='+next.leadId}><b>Ближайший показ</b><small>{new Date(next.at).toLocaleString('ru-RU',{timeZone:'Asia/Vladivostok'})} · Владивосток</small></Link>}{recent&&<Link to={'/journey?lead='+recent.leadId}><b>{recent.title}</b><small>Открыть обращение →</small></Link>}{!recent&&!next&&entry&&<Link to={'/journey?lead='+entry.leadId}><b>Моё обращение</b><small>Статус, подборки и связь с менеджером →</small></Link>}{selection&&<Link to="/selection"><b>{selection.showResult?'Вернуться к результатам подбора':'Продолжить подбор'}</b><small>{typeof selection.city==='string'?selection.city:'Ваши параметры сохранены'}</small></Link>}{last&&typeof last.id==='string'&&typeof last.name==='string'&&<Link to={'/property/'+encodeURIComponent(last.id)}><b>{last.name}</b><small>Вы недавно смотрели этот ЖК →</small></Link>}</section>;
}
