import React from 'react';
import {Phone,MessageCircle} from 'lucide-react';
import {PayoutFields,PayoutSummary} from '../../../../packages/partners/PayoutFields';
import {emptyPayout,payoutError,payoutStages,contactPhoneHref} from '../../../../packages/partners/payout';
import {coordinatePartnerPayout} from '../../../../packages/partners/client';
import type {PartnerReferral} from '../../../../packages/partners/model';
export function PartnerPayoutPanel({referral,owner,busy,run,onDirtyChange}:{referral:PartnerReferral;owner:boolean;busy:boolean;run:(fn:()=>Promise<unknown>)=>Promise<void>;onDirtyChange:(dirty:boolean)=>void}){
 const w=referral.reward!,[details,setDetails]=React.useState(()=>({...emptyPayout(referral.partnerName,referral.partnerContact?.phone),...w.payoutDetails})),[confirmed,setConfirmed]=React.useState(false),[recipient,setRecipient]=React.useState(w.recipientType||'person');
 // Initialise before paint so a delayed effect cannot erase the first Safari edit.
 React.useLayoutEffect(()=>{setDetails({...emptyPayout(referral.partnerName,referral.partnerContact?.phone),...w.payoutDetails});setConfirmed(false);setRecipient(w.recipientType||'person')},[w.id,w.revision]);
 const error=payoutError(details,true),username=referral.partnerContact?.telegramUsername;
 const call=contactPhoneHref(details.contactPhone||referral.partnerContact?.phone||'');
 const changed=JSON.stringify(details)!==JSON.stringify({...emptyPayout(referral.partnerName,referral.partnerContact?.phone),...w.payoutDetails})||recipient!==(w.recipientType||'person');
 React.useLayoutEffect(()=>{if(changed)setConfirmed(false)},[JSON.stringify(details),recipient]);
 React.useEffect(()=>{onDirtyChange(changed);return()=>onDirtyChange(false)},[changed,onDirtyChange]);
 React.useEffect(()=>{if(!changed)return;const prevent=(e:BeforeUnloadEvent)=>e.preventDefault();window.addEventListener('beforeunload',prevent);return()=>window.removeEventListener('beforeunload',prevent)},[changed]);
 return <section className="partnerPayoutPanel" id="partner-receiving" aria-label="Согласование получения вознаграждения">
  <div className="partnerSectionTitle"><span>4</span><div><h3>Согласуйте получение с партнёром</h3><p>Выберите способ, проверьте данные и договоритесь о переводе или приезде в офис.</p></div></div>
  <div className="partnerContactActions"><b>{referral.partnerName}</b>{call&&<a className="secondaryAction" href={call}><Phone size={15}/>Позвонить партнёру</a>}{username&&/^[a-zA-Z0-9_]{5,32}$/.test(username)&&<a className="secondaryAction" href={'https://t.me/'+username} target="_blank" rel="noreferrer"><MessageCircle size={15}/>Написать в Telegram</a>}</div>
  <p className="partnersNotice">{w.payoutStage?payoutStages[w.payoutStage]:'Способ получения ещё не согласован'}</p>
  {w.payoutStage==='agreed'||w.status==='paid'?<>{w.payoutDetails?<PayoutSummary details={details}/>:<p>Способ получения в архивной записи не указан.</p>}{owner&&w.status!=='paid'&&<button type="button" className="secondaryAction" disabled={busy} onClick={()=>void run(()=>coordinatePartnerPayout(w.id,{revision:w.revision,decision:'reopen',note:'Уточните способ получения или свяжитесь с командой PULSE.'}))}>Изменить договорённость</button>}</>:<>
   {owner&&<><button type="button" className="secondaryAction" disabled={busy} onClick={()=>void run(()=>coordinatePartnerPayout(w.id,{revision:w.revision,decision:'request_details',payout:details,recipientType:recipient,note:'Выберите способ получения вознаграждения и проверьте контактные данные в кабинете партнёра.'}))}>Попросить партнёра заполнить данные</button><p>Партнёр увидит запрос в мини-аппе и получит уведомление в Telegram после подключения бота. Можно также записать данные после разговора.</p></>}
   <PayoutFields value={details} onChange={setDetails} control disabled={!owner||busy}/>
   <label className="controlField"><span>Статус получателя</span><select disabled={!owner||busy} value={recipient} onChange={e=>setRecipient(e.target.value)}><option value="person">Физическое лицо</option><option value="ip">Индивидуальный предприниматель</option><option value="company">Организация</option><option value="npd">Самозанятый — требуется проверка договора</option></select></label>
   {owner&&<><label className="partnerCheckbox"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>Согласовали способ получения с партнёром и проверили данные получателя</span></label>{error&&<p className="partnerFieldHint">{error}</p>}<button type="button" className="primaryAction" disabled={busy||!confirmed||!!error} onClick={()=>void run(()=>coordinatePartnerPayout(w.id,{revision:w.revision,decision:'agree',payout:details,recipientType:recipient,contactConfirmed:true}))}>Подтвердить договорённость</button><small>Это подтверждает условия получения. Деньги переводятся или выдаются отдельно, затем выплата отмечается ниже.</small></>}
  </>}
 </section>;
}
