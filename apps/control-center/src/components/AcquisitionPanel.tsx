import React from 'react';
import {ArrowUpRight,BarChart3,Megaphone} from 'lucide-react';
import {api,runtime} from '../../../../packages/pulse-data/runtime';
import {usePulseEvents,usePulseLeads} from '../data';
import {loadJourneys} from '../../../../packages/journey/client';
type Row={source:string;campaign:string;visits:number;contacts:number;showings:number;deals:number};
export function AcquisitionPanel(){
 const events=usePulseEvents(),leads=usePulseLeads();const [rows,setRows]=React.useState<Row[]>([]),[error,setError]=React.useState(''),[scoped,setScoped]=React.useState(false);
 React.useEffect(()=>{let live=true;(async()=>{try{if(runtime.enabled){const r=await api('/control/acquisition');if(live){setRows(r.items);setScoped(r.scoped);setError(r.limited?'Показаны первые 500 источников':'')}return;}
 const {items}=await loadJourneys();const sessions=[...new Set(events.filter(e=>Date.parse(e.createdAt)>=Date.now()-90*86400000).map(e=>e.sessionId))];const groups=new Map<string,Row>();
 for(const session of sessions){const a=events.filter(e=>e.sessionId===session&&e.eventType==='attribution').sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt))[0];const source=String(a?.metadata.source||'unknown'),campaign=String(a?.metadata.campaign||'');const key=JSON.stringify([source,campaign]);const row=groups.get(key)||{source,campaign,visits:0,contacts:0,showings:0,deals:0};const linked=leads.filter(l=>l.sessionId===session);row.visits++;if(linked.length)row.contacts++;if(linked.some(l=>l.status==='deal'))row.deals++;if(items.some(i=>linked.some(l=>l.id===i.leadId)&&i.journey.showings.some(s=>s.status==='completed')))row.showings++;groups.set(key,row)}
 if(live)setRows([...groups.values()].sort((a,b)=>b.visits-a.visits));}catch(e){if(live)setError((e as Error).message)}})();return()=>{live=false}},[events,leads]);
 const visits=rows.reduce((sum,row)=>sum+row.visits,0),contacts=rows.reduce((sum,row)=>sum+row.contacts,0),deals=rows.reduce((sum,row)=>sum+row.deals,0);
 return <section className="panel acquisitionPanel">
  <div className="acquisitionHead">
   <div><span className="kicker">ИСТОЧНИКИ СПРОСА</span><h2>Результаты по источникам</h2><p>{scoped?'Только сессии назначенных вам клиентов. Общую конверсию рекламы видит администратор.':'Сессии за последние 90 дней, первый источник перехода. Каждый этап считается по уникальным сессиям.'}</p></div>
   <span className="acquisitionIcon"><Megaphone size={19}/></span>
  </div>
  <div className="acquisitionSummary" aria-label="Сводка источников">
   <div><span>Визиты</span><strong>{visits}</strong><small><BarChart3 size={13}/> за 90 дней</small></div>
   <div><span>Контакты</span><strong>{contacts}</strong><small>{visits?Math.round(contacts/visits*100):0}% от визитов</small></div>
   <div><span>Сделки</span><strong>{deals}</strong><small><ArrowUpRight size={13}/> итоговая конверсия</small></div>
  </div>
  <small className="acquisitionNote">Источники сохраняются по utm_source и utm_campaign. Старые переходы без меток не восстанавливаются. Расходы и окупаемость пока не учитываются.</small>
  {error&&<p className="errorNotice" role="alert">{error}</p>}
  <div className="journeyTable acquisitionTable"><table><thead><tr>{['Источник / кампания','Визиты','Контакты','Состоявшиеся показы','Сделки','Визит → контакт'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={JSON.stringify([r.source,r.campaign])}><td>{r.source==='direct'?'Прямой переход':r.source==='unknown'?'Источник неизвестен':r.source}{r.campaign&&' / '+r.campaign}</td><td>{r.visits}</td><td>{r.contacts}</td><td>{r.showings}</td><td>{r.deals}</td><td>{r.visits?Math.round(r.contacts/r.visits*100):0}%</td></tr>)}</tbody></table></div>
  {!rows.length&&<div className="acquisitionEmpty">Данные появятся после визитов в мини-приложение.</div>}
 </section>;
}