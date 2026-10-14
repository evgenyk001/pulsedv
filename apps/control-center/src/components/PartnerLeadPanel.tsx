import React from 'react';
import {Link} from 'react-router-dom';
import {runtime} from '../../../../packages/pulse-data/runtime';
import {getLeadPartner,subscribePartners} from '../../../../packages/partners/client';
import {referralLabels,type PartnerReferral} from '../../../../packages/partners/model';
export function PartnerLeadPanel({leadId}:{leadId:string}){
 const [referral,setReferral]=React.useState<PartnerReferral|null>(null),[error,setError]=React.useState('');
 React.useEffect(()=>{if(runtime.enabled&&runtime.member?.role==='manager')return;let cancelled=false;const load=()=>{void getLeadPartner(leadId).then(v=>{if(!cancelled){setReferral(v.referral);setError('')}}).catch(e=>{if(!cancelled)setError(e.message)})};load();const off=subscribePartners(load);return()=>{cancelled=true;off()}},[leadId]);
 if(error)return <p className="errorNotice">{error}</p>;if(!referral)return null;
 return <section className="leadRequestContext" aria-label="Рекомендация партнёра"><span>ПАРТНЁРСКАЯ РЕКОМЕНДАЦИЯ</span><h3>{referral.partnerName}</h3><p>{referralLabels[referral.status]}{referral.conflict?' · Найдено совпадение в CRM':''}</p><Link className="secondaryAction" to={'/partners?referral='+referral.id}>Проверка и вознаграждение</Link><small>Пригласивший партнёр и ответственный менеджер учитываются отдельно.</small></section>;
}
