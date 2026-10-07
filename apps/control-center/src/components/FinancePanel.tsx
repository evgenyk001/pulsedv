import React from 'react';
import {usePulseLeads} from '../data';
import {api,runtime} from '../../../../packages/pulse-data/runtime';
import {businessDay,financeSummary} from '../../../../packages/pulse-data/business';
type Summary=ReturnType<typeof financeSummary>;
const rub=(n:number)=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(n);
export function FinancePanel(){
 const leads=usePulseLeads(),today=businessDay();
 const [from,setFrom]=React.useState(today.slice(0,7)+'-01'),[to,setTo]=React.useState(today);
 const [remote,setRemote]=React.useState<Summary|null>(null),[error,setError]=React.useState(''),[loading,setLoading]=React.useState(false),[revision,reload]=React.useReducer(n=>n+1,0);
 const valid=!!from&&!!to&&from<=to&&Date.parse(to)-Date.parse(from)<=366*86400000;
 React.useEffect(()=>{if(!runtime.enabled)return;let cancelled=false;setRemote(null);setError('');setLoading(false);if(!valid)return;setLoading(true);
 void api<Summary>('/control/finance-summary?'+new URLSearchParams({from,to})).then(v=>{if(!cancelled)setRemote(v)}).catch(e=>{if(!cancelled)setError(e.message)}).finally(()=>{if(!cancelled)setLoading(false)});
 return()=>{cancelled=true};
 },[from,to,valid,revision]);
 const summary=runtime.enabled?remote:valid?financeSummary(leads,from,to):null;
 return <section className="financePanel" aria-label="Финансовый результат"><div className="sectionHeading"><div><span className="kicker">КОМИССИИ</span><h2>Финансовый результат</h2><p>{runtime.member?.role==='manager'?'Только назначенные вам клиенты. ':''}Поступления и выплаты по фактическим датам. Ожидаемые комиссии считаются отдельно.</p></div><button className="secondaryAction" onClick={reload} disabled={loading}>Обновить</button></div>
 <div className="financePeriod"><label className="controlField"><span>С</span><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="controlField"><span>По</span><input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div>
 {!valid&&<p className="errorNotice" role="alert">Выберите корректный период не больше года.</p>}{error&&<p className="errorNotice" role="alert">{error}</p>}{loading&&<p role="status">Считаем комиссии…</p>}
 {summary&&<div className="metrics"><article><span>Комиссии поступили</span><strong>{rub(summary.received)}</strong><small>{summary.receivedDeals} поступлений</small></article><article><span>Ожидаем поступления</span><strong>{rub(summary.expected)}</strong><small>по плановой дате в выбранном периоде</small></article><article><span>Выплачено агентам</span><strong>{rub(summary.agentPaid)}</strong><small>по дате выплаты</small></article><article><span>Поступления минус выплаты</span><strong>{rub(summary.balance)}</strong><small>без налогов, рекламы и других расходов</small></article></div>}
 </section>;
}
