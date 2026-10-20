import React from 'react';
import {PayoutFields,PayoutSummary} from '../../../../packages/partners/PayoutFields';
import {emptyPayout,payoutError,payoutStages} from '../../../../packages/partners/payout';
import {requestPartnerPayout,requestPartnerPayoutChange} from '../../../../packages/partners/client';
import type {PartnerReward} from '../../../../packages/partners/model';
import {NativeSelect} from './NativeSelect';
import styles from '../pages/partners.module.css';
export function PartnerReceivingForm({reward,name,phone,busy,run}:{reward:PartnerReward;name:string;phone:string;busy:boolean;run:(fn:()=>Promise<unknown>)=>Promise<boolean>}){
 const [details,setDetails]=React.useState(()=>({...emptyPayout(name,phone),...reward.payoutDetails})),[recipient,setRecipient]=React.useState(reward.recipientType||'person');
 React.useEffect(()=>{setDetails({...emptyPayout(name,phone),...reward.payoutDetails});setRecipient(reward.recipientType||'person')},[reward.id,reward.revision]);
 const locked=reward.payoutStage==='agreed'||reward.status==='paid',error=payoutError(details);
 return <section className={styles.form} aria-label="Получение вознаграждения"><h3>{locked?'Получение вознаграждения':'Как вам удобно получить деньги?'}</h3>
  {reward.payoutStage&&<p className={styles.hint}>{payoutStages[reward.payoutStage]}</p>}
  {locked?<>{reward.payoutDetails?<PayoutSummary details={details}/>:<p className={styles.hint}>Подробности получения уточняйте у команды PULSE.</p>}{reward.status!=='paid'&&<button type="button" className={styles.secondary} disabled={busy} onClick={()=>void run(()=>requestPartnerPayoutChange(reward.id,reward.revision))}>Нужно изменить договорённость</button>}</>:<form className={styles.form} onSubmit={e=>{e.preventDefault();void run(()=>requestPartnerPayout(reward.id,recipient,details,reward.revision))}}>
   <PayoutFields value={details} onChange={setDetails} disabled={busy}/>
   <label>Статус получателя<NativeSelect aria-label="Статус получателя" value={recipient} onChange={e=>setRecipient(e.target.value)} disabled={busy}><option value="person">Физическое лицо</option><option value="ip">Индивидуальный предприниматель</option><option value="company">Организация</option><option value="npd">Самозанятый — проверка договора</option></NativeSelect></label>
   {error&&<p className={styles.hint}>{error}</p>}<button className={styles.primary} disabled={busy||!!error}>{busy?'Сохраняем…':reward.status==='requested'?'Обновить данные для получения':'Запросить оформление выплаты'}</button>
   <p className={styles.hint}>Команда проверит документы и свяжется с вами. Выбор способа не запускает автоматический перевод.</p>
  </form>}
 </section>;
}
