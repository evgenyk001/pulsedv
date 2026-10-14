import type {DealFinance} from '../pulse-data/model';
function local(){try{return JSON.parse(localStorage.getItem('pulse.partners.v1')||'null')}catch{return null}}
export function guardLocalPartnerFinance(leadId:string,finance:DealFinance|undefined,status:string){
 const s=local(),r=s?.referrals?.find((r:any)=>r.leadId===leadId),w=s?.rewards?.find((w:any)=>w.referralId===r?.id&&w.status!=='void');
 if(w&&(w.commissionRub!==finance?.commissionRub||w.receivedOn!==finance?.receivedOn||!['deal','closed'].includes(status)))throw new Error('Вознаграждение уже начислено. Сначала отмените неоплаченное начисление в разделе «Партнёры»');
}
export function localPartnerPaid(from:string,to:string){return (local()?.rewards??[]).filter((w:any)=>w.status==='paid'&&w.paidOn&&w.paidOn>=from&&w.paidOn<=to).reduce((a:number,w:any)=>a+w.grossMinor/100,0)}
