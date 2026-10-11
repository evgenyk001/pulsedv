import React from 'react';
import {usePulseLeads} from '../data';
import {api,runtime} from '../../../../packages/pulse-data/runtime';
import {businessDay} from '../../../../packages/pulse-data/business';
import {LOSS_REASONS,lossSummary,type LossSummary} from '../../../../packages/pulse-data/loss';
export function LossReasonsPanel(){
 const leads=usePulseLeads(),today=businessDay();
 const [from,setFrom]=React.useState(today.slice(0,7)+'-01'),[to,setTo]=React.useState(today);
 const [remote,setRemote]=React.useState<LossSummary|null>(null),[error,setError]=React.useState(''),[loading,setLoading]=React.useState(false),[revision,reload]=React.useReducer(n=>n+1,0);
 const valid=!!from&&!!to&&from<=to&&Date.parse(to)-Date.parse(from)<=366*86400000;
 React.useEffect(()=>{if(!runtime.enabled)return;let cancelled=false;setRemote(null);setError('');setLoading(false);if(!valid)return;setLoading(true);
 void api<LossSummary>('/control/loss-summary?'+new URLSearchParams({from,to})).then(v=>{if(!cancelled)setRemote(v)}).catch(e=>{if(!cancelled)setError(e.message)}).finally(()=>{if(!cancelled)setLoading(false)});return()=>{cancelled=true};
 },[from,to,valid,revision]);
 const summary=runtime.enabled?remote:valid?lossSummary(leads,from,to):null;
 return <section className="financePanel" aria-label="Причины потери клиентов"><div className="sectionHeading financeHeading"><div><span className="kicker">ОБРАТНАЯ СВЯЗЬ</span><h2>Почему теряем клиентов</h2><p>{runtime.member?.role==='manager'?'Только назначенные вам клиенты. ':''}Клиенты со статусом «Потерян» по дате потери. Время Владивостока.</p></div><button className="secondaryAction" onClick={reload} disabled={loading}>Обновить</button></div>
 <div className="financePeriod"><label className="controlField"><span>С</span><input type="date" aria-label="Потери с" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="controlField"><span>По</span><input type="date" aria-label="Потери по" value={to} onChange={e=>setTo(e.target.value)}/></label></div>
 {!valid&&<p className="errorNotice" role="alert">Выберите корректный период не больше года.</p>}{error&&<p className="errorNotice" role="alert">{error}</p>}{loading&&<p role="status">Считаем причины потерь…</p>}
 {summary&&<><div className="lossSummaryTotal"><b>{summary.total}</b><span>потерянных клиентов за период</span></div>{summary.items.length?<div className="lossReasonList">{summary.items.map(item=><div key={item.reason}><div><span>{item.reason==='unspecified'?'Причина не указана':LOSS_REASONS[item.reason]}</span><b>{item.count} · {item.percent}%</b></div><div className="lossReasonTrack" aria-hidden="true"><i style={{width:item.percent+'%'}}/></div></div>)}</div>:<div className="emptyState"><strong>Потерь за этот период нет</strong><span>При закрытии клиента укажите причину — она появится в отчёте.</span></div>}{summary.undated>0&&<p className="muted">Ещё {summary.undated} старых потерянных клиентов без даты потери. Они не включены в период.</p>}</>}
 </section>;
}
