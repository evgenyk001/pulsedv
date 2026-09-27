import React from 'react';
import { Dna, Sparkles, ArrowUpRight, Check, RefreshCw, HelpCircle, History, FileCheck2, Copy, ChevronRight } from 'lucide-react';
import { buildInterestDNA,selectIdentityEvents,dimensionLabels,type InterestDNA,type Dimension } from '../../../../packages/interest-dna';
import type { PulseEvent,PulseState } from '../../../../packages/pulse-data/model';
import { api,runtime } from '../../../../packages/pulse-data/runtime';
import { ActivityFeed } from './ActivityFeed';
type Result={dna:InterestDNA;events:PulseEvent[];linked:boolean;limited:boolean;catalogLimited:boolean;scope:string};
const confidence={early:'Мало данных',supported:'Есть подтверждающие действия',steady:'Устойчивый интерес'};
const sourceNames={declared:'Указал сам',behavior:'По действиям',scenario:'Пробный расчёт'};
export function InterestPanel({sessionId,userId,events,state,onUseNextAction}:{sessionId:string|null|undefined;userId?:string|null;events:PulseEvent[];state:PulseState;onUseNextAction?:(value:string)=>void}){
 const [remote,setRemote]=React.useState<(Result&{sessionId:string})|null>(null),[error,setError]=React.useState(''),[loading,setLoading]=React.useState(false),[refresh,setRefresh]=React.useState(0),[copied,setCopied]=React.useState(false);
 const [tab,setTab]=React.useState<'interest'|'changes'|'facts'>('interest');
 React.useEffect(()=>{setTab('interest');setCopied(false)},[sessionId]);
 React.useEffect(()=>{
  if(!runtime.enabled||!sessionId)return;
  const controller=new AbortController();setLoading(true);setError('');
  void api<Result>('/control/interest/'+encodeURIComponent(sessionId),{signal:controller.signal}).then(result=>{if(!controller.signal.aborted)setRemote({...result,sessionId})}).catch(e=>{if(!controller.signal.aborted)setError(e.message||'Не удалось загрузить профиль')}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return()=>controller.abort();
 },[sessionId,events,refresh]);
 const localEvents=React.useMemo(()=>sessionId?selectIdentityEvents(events,sessionId,userId):[],[events,sessionId,userId]);
 const localDNA=React.useMemo(()=>buildInterestDNA(localEvents,state),[localEvents,state,refresh]);
 const result=runtime.enabled?(remote?.sessionId===sessionId?remote:null):{dna:localDNA,events:localEvents,linked:!!userId,limited:false,catalogLimited:false,scope:'browser'};
 if(!sessionId)return <div className="dnaNotice">Для этой заявки нет связанной истории. Начните с уточнения пожеланий клиента.</div>;
 if(!result)return <section className="dnaPanel" aria-label="Interest DNA"><h3>Interest DNA</h3>{error?<div role="alert">{error}<button className="secondaryAction" onClick={()=>setRefresh(v=>v+1)}>Повторить</button></div>:<p role="status">Собираем профиль интересов…</p>}</section>;
 const {dna}=result;
 const copy=async()=>{try{await navigator.clipboard.writeText(dna.brief+'\nСледующий шаг: '+dna.nextAction);setCopied(true)}catch{setCopied(false);setError('Не удалось скопировать. Резюме можно выделить вручную.')}};
 return <>
  <section className="dnaPanel" aria-label="Interest DNA">
   <div className="dnaHeading"><span className="dnaMark"><Dna size={21}/></span><div><span className="kicker">ПРОФИЛЬ ПОТРЕБНОСТЕЙ</span><h3>Interest DNA</h3></div><button className="dnaRefresh" disabled={loading} aria-label="Обновить Interest DNA" onClick={()=>setRefresh(v=>v+1)}><RefreshCw size={16}/></button></div>
   <p className="dnaMeta">{dna.eventCount} действий · {dna.sessionCount} сессий · последние {dna.windowDays} дней</p>
   <p className="dnaScope">{runtime.enabled?(result.linked?'Сессии связаны по подтверждённому Telegram.':'Анонимная сессия — личность не установлена.'):'Демонстрация: история этого браузера.'}{result.scope==='assigned'?' Только история назначенных вам клиентов.':''}</p>
   {(result.limited||result.catalogLimited)&&<p className="dnaNotice">{result.limited?'Показаны последние 5000 действий; выводы могут быть неполными. ':''}{result.catalogLimited?'В рекомендации вошла только загруженная часть каталога.':''}</p>}
   {error&&<p className="errorNotice" role="alert">{error} {result?'Показана предыдущая версия профиля.':''}</p>}
   <div className="dnaBrief"><div><Sparkles size={16}/><b>Перед разговором</b><button aria-label={copied?'Резюме скопировано':'Скопировать резюме'} onClick={()=>void copy()}>{copied?<Check size={15}/>:<Copy size={15}/>}</button></div><p>{dna.brief}</p><small>Сводка по фактам. Без догадок о человеке и внешнего AI.</small></div>
   <div className="dnaTabs" role="tablist" aria-label="Разделы Interest DNA">{([{id:'interest',label:'Интересы',Icon:Dna},{id:'changes',label:'Что изменилось',Icon:History},{id:'facts',label:'Указал сам',Icon:FileCheck2}] as const).map(({id,label,Icon})=><button role="tab" id={'dna-tab-'+id} aria-controls={'dna-panel-'+id} aria-selected={tab===id} key={id} onClick={()=>setTab(id)}><Icon size={14}/>{label}{id==='changes'&&dna.changes.length>0&&<em>{dna.changes.length}</em>}</button>)}</div>
   <div role="tabpanel" id={'dna-panel-'+tab} aria-labelledby={'dna-tab-'+tab}>
    {tab==='interest'&&<><p className="dnaExplanation">Шкала показывает силу сигналов, а не вероятность покупки. Повторы ограничены, старые действия теряют вес.</p>
     {!dna.interests.length?<div className="dnaEmpty">Пока недостаточно действий для выводов. Откройте ЖК или завершите подбор в мини-приложении.</div>:(Object.keys(dimensionLabels) as Dimension[]).map(dimension=>{const items=dna.interests.filter(i=>i.dimension===dimension).slice(0,3);return items.length?<div className="dnaDimension" key={dimension}><h4>{dimensionLabels[dimension]}</h4>{items.map(item=><details className="dnaSignal" key={item.value}><summary><div><b>{item.label}</b><span>{item.strength}/100 <ChevronRight size={13}/></span></div><div className="dnaMeter" aria-hidden="true"><i style={{width:item.strength+'%'}}/></div><small>{confidence[item.confidence]} · {item.count} учтённых сигналов</small></summary><div className="dnaEvidence"><b>На чём основан вывод</b>{item.evidence.map(e=><div key={e.eventId}><span>{e.title}</span><small>{sourceNames[e.source]} · {new Date(e.at).toLocaleString('ru-RU')}</small></div>)}{item.count>item.evidence.length&&<small>Показаны последние {item.evidence.length} подтверждений.</small>}</div></details>)}</div>:null})}</>}
    {tab==='changes'&&<div className="dnaChanges">{dna.changes.length?dna.changes.map(change=><article key={change.id}><span><History size={15}/></span><div><b>{change.title}</b><p>{change.detail}</p><small>{new Date(change.at).toLocaleString('ru-RU')}</small></div></article>):<div className="dnaEmpty">Заметных изменений пока нет. Сравним завершённые подборы и отметим возвращение после перерыва.</div>}<p className="dnaExplanation">Сравнение последних запросов за 30 дней. Это история изменений, а не уведомления «с прошлого звонка».</p></div>}
    {tab==='facts'&&<div className="dnaFacts">{dna.facts.length?dna.facts.map(f=><div key={f.key}><span>{f.label}</span><b>{f.value}</b><small>{f.evidence.title} · {new Date(f.evidence.at).toLocaleDateString('ru-RU')}</small></div>):<div className="dnaEmpty">Клиент ещё не завершил PULSE Select. Просмотры не считаются подтверждёнными пожеланиями.</div>}<p className="dnaExplanation">Последний завершённый подбор. Выбор ипотечной программы не подтверждает право на неё; срок сдачи дома не равен сроку покупки.</p></div>}
   </div>
   <div className="dnaNext"><span className="kicker">СЛЕДУЮЩИЙ ШАГ</span><p>{dna.nextAction}</p>{onUseNextAction&&<button className="secondaryAction" onClick={()=>onUseNextAction(dna.nextAction)}>Вставить в план контакта <ArrowUpRight size={14}/></button>}</div>
   <details className="dnaQuestions"><summary><HelpCircle size={15}/>Что уточнить у клиента <span>{dna.questions.length}</span></summary><ul>{dna.questions.map(question=><li key={question}>{question}</li>)}</ul></details>
   {dna.recommendations.length>0&&<div className="dnaRecommendations"><h4>Объекты для обсуждения</h4>{dna.recommendations.map(p=><a key={p.id} href={'../mini-app/#/property/'+encodeURIComponent(p.id)} target="_blank" rel="noreferrer"><div><b>{p.name}</b><p>{p.reasons.join(' · ')||'Подходит под указанные параметры'}</p>{p.tradeoffs.length>0&&<small>{p.tradeoffs.join(' · ')}</small>}</div><ArrowUpRight size={16}/></a>)}<p className="dnaExplanation">По последнему подбору и текущему каталогу. Условия и наличие нужно подтвердить.</p></div>}
   <p className="dnaTimestamp">Пересчитано {new Date(dna.generatedAt).toLocaleString('ru-RU')}</p>
  </section>
  <h3>История действий</h3><ActivityFeed events={result.events} state={state}/>
 </>;
}
