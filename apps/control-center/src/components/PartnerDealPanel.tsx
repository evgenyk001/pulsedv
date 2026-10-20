import React from 'react';
import {Phone} from 'lucide-react';
import {api,runtime,updateRemote} from '../../../../packages/pulse-data/runtime';
import {listPulseLeads,updatePulseLead,type PulseLead} from '../../../../packages/pulse-data';
import {emptyFinance,financeError,businessDay} from '../../../../packages/pulse-data/business';
import {LOSS_REASONS,lossError,type LossReason} from '../../../../packages/pulse-data/loss';
import {partnerStageLabels} from '../../../../packages/partners/model';
import {ControlJourneyPanel} from '../../../../packages/journey/ControlJourneyPanel';
import {usePulseState} from '../data';

async function readLead(id:string){return runtime.enabled?(await api<{lead:PulseLead}>('/control/leads/'+encodeURIComponent(id))).lead:listPulseLeads().find(l=>l.id===id)||null}
export function PartnerLeadPreview({id}:{id:string}){
 const [lead,setLead]=React.useState<PulseLead|null>(null),[error,setError]=React.useState('');
 React.useEffect(()=>{let live=true;void readLead(id).then(v=>{if(live)setLead(v)}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[id]);
 return <section className="partnerConflictPreview">{error?<p role="alert">{error}</p>:lead?<><b>{lead.name}</b><p>{lead.phone} · {partnerStageLabels[lead.status]}</p><small>Первое обращение: {new Date(lead.createdAt).toLocaleString('ru-RU')}</small>{lead.comment&&<p>{lead.comment}</p>}</>:<p role="status">Загружаем совпадение…</p>}</section>;
}
export function PartnerDealPanel({leadId,locked,onSaved,onDirtyChange}:{leadId:string;locked:boolean;onSaved:()=>void;onDirtyChange:(dirty:boolean)=>void}){
 const state=usePulseState();
 const [lead,setLead]=React.useState<PulseLead|null>(null),[draft,setDraft]=React.useState<PulseLead|null>(null),[error,setError]=React.useState(''),[notice,setNotice]=React.useState(''),[busy,setBusy]=React.useState(false),[tab,setTab]=React.useState<'deal'|'journey'>('deal');
 const load=React.useCallback(async()=>{const l=await readLead(leadId);if(!l)throw new Error('Карточка клиента недоступна');setLead(l);setDraft({...l,finance:{...emptyFinance(),...l.finance}})},[leadId]);
 React.useEffect(()=>{let live=true;void readLead(leadId).then(l=>{if(!live)return;if(!l){setError('Карточка клиента недоступна');return}setLead(l);setDraft({...l,finance:{...emptyFinance(),...l.finance}})}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[leadId]);
 const save=async(e:React.FormEvent)=>{
  e.preventDefault();if(!draft||!lead||busy)return;
  const invalid=financeError(draft.finance!)||lossError(draft.status,draft.status==='lost'?draft.lossReason:null,draft.status==='lost'?draft.lossNote:null);if(invalid){setError(invalid);return}
  const patch={status:draft.status,finance:draft.finance,comment:draft.comment||null,nextAction:draft.nextAction||null,manager:draft.manager,lossReason:draft.status==='lost'?draft.lossReason:null,lossNote:draft.status==='lost'?draft.lossNote:null,expectedUpdatedAt:lead.updatedAt};
  setBusy(true);setError('');setNotice('');try{if(runtime.enabled)await updateRemote('leads',leadId,patch);else updatePulseLead(leadId,patch);await load();setNotice('Изменения сохранены. Этап обновится и у партнёра.');onSaved()}catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить')}finally{setBusy(false)};
 };
 const dirty=!!lead&&!!draft&&JSON.stringify({...lead,finance:{...emptyFinance(),...lead.finance}})!==JSON.stringify(draft);
 React.useEffect(()=>{onDirtyChange(dirty);return()=>onDirtyChange(false)},[dirty,onDirtyChange]);
 React.useEffect(()=>{if(!dirty)return;const prevent=(e:BeforeUnloadEvent)=>e.preventDefault();window.addEventListener('beforeunload',prevent);return()=>window.removeEventListener('beforeunload',prevent)},[dirty]);
 return <section className="partnerDealPanel" id="partner-deal" aria-label="Сделка клиента">
  <div className="partnerSectionTitle"><span>2</span><div><h3>Ведите сделку здесь</h3><p>Этап, ответственный, комиссия, подборки и показы — без перехода в другие разделы.</p></div></div>
  <nav className="partnerLocalTabs" aria-label="Сделка в партнёрской рекомендации"><button type="button" aria-pressed={tab==='deal'} onClick={()=>setTab('deal')}>Этап и комиссия</button><button type="button" aria-pressed={tab==='journey'} onClick={()=>setTab('journey')}>Чат, подборки и показы</button></nav>
  {error&&<p className="errorNotice" role="alert">{error} <button type="button" className="secondaryAction" disabled={busy} onClick={()=>void load().catch(e=>setError(e.message))}>Загрузить актуальную карточку</button></p>}
  {!draft?<p role="status">Загружаем данные клиента…</p>:tab==='journey'?<ControlJourneyPanel leadId={leadId} properties={state.properties}/>:<form className="partnerForm" onSubmit={e=>void save(e)}>
   <a className="secondaryAction" href={'tel:'+draft.phone}><Phone size={15}/>Позвонить покупателю: {draft.phone}</a>
   <label className="controlField"><span>На каком этапе покупатель</span><select aria-label="На каком этапе покупатель" value={draft.status} disabled={busy} onChange={e=>setDraft({...draft,status:e.target.value as PulseLead['status']})}>{Object.entries(partnerStageLabels).map(([key,label])=><option key={key} value={key} disabled={locked&&!['deal','closed'].includes(key)}>{label}</option>)}</select></label>
   {draft.status==='lost'&&<><label className="controlField"><span>Почему покупка не состоялась</span><select value={draft.lossReason||''} onChange={e=>setDraft({...draft,lossReason:(e.target.value||null) as LossReason|null})}><option value="">Выберите причину</option>{Object.entries(LOSS_REASONS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>{draft.lossReason==='other'&&<label className="controlField"><span>Уточните причину</span><textarea value={draft.lossNote||''} maxLength={1000} onChange={e=>setDraft({...draft,lossNote:e.target.value})}/></label>}</>}
   <label className="controlField"><span>Кто ведёт покупателя</span><select value={draft.manager||''} disabled={busy} onChange={e=>setDraft({...draft,manager:e.target.value||null})}><option value="">Пока не назначен</option>{runtime.snapshot.members.filter(m=>m.active||m.id===draft.manager).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
   <label className="controlField"><span>Следующее действие</span><input value={draft.nextAction||''} maxLength={1000} placeholder="Например, согласовать время показа" onChange={e=>setDraft({...draft,nextAction:e.target.value})}/></label>
   <label className="controlField"><span>Внутренняя заметка по сделке</span><textarea value={draft.comment||''} maxLength={5000} onChange={e=>setDraft({...draft,comment:e.target.value})}/><small>Партнёр не видит заметки и переписку покупателя.</small></label>
   <div className="partnerFinanceFields"><label className="controlField"><span>Комиссия агентству, ₽</span><input type="number" min="0" max="1000000000" step="1" disabled={locked} value={draft.finance?.commissionRub??''} onChange={e=>setDraft({...draft,finance:{...draft.finance!,commissionRub:e.target.value===''?null:Number(e.target.value)}})}/></label><label className="controlField"><span>Комиссия поступила</span><input type="date" max={businessDay()} disabled={locked} value={draft.finance?.receivedOn||''} onChange={e=>setDraft({...draft,finance:{...draft.finance!,receivedOn:e.target.value||null}})}/></label></div>
   <p>{locked?'Вознаграждение уже начислено: комиссия защищена от изменения. Неоплаченное начисление можно отменить ниже с указанием причины.':'Когда покупка состоялась, выберите «Сделка состоялась». Дату поступления комиссии заполняйте после фактического получения денег.'}</p>
   {notice&&<p className="partnerSaved" role="status">{notice}</p>}<button className="primaryAction" disabled={busy||!dirty}>{busy?'Сохраняем…':'Сохранить сделку'}</button>
  </form>}
 </section>;
}
