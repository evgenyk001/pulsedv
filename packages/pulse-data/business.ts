import type {CatalogFreshness,DealFinance,PulseLead} from './model';
export const emptyFreshness=():CatalogFreshness=>({source:'',responsible:'',verifiedAt:null,reviewDueOn:null});
export const emptyFinance=():DealFinance=>({commissionRub:null,agentPayoutRub:null,expectedPaymentOn:null,receivedOn:null,agentPaidOn:null});
export function businessDay(date=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Vladivostok',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)}
export function needsCatalogReview(value:CatalogFreshness|undefined,today=businessDay()){return !value?.verifiedAt||!value.reviewDueOn||value.reviewDueOn<=today}
export function financeSummary(leads:Pick<PulseLead,'finance'>[],from:string,to:string){
 const result={expected:0,received:0,agentPaid:0,balance:0,receivedDeals:0};
 const within=(date:string|null|undefined)=>!!date&&date>=from&&date<=to;
 for(const {finance:f} of leads){if(!f)continue;
  if(!f.receivedOn&&within(f.expectedPaymentOn))result.expected+=f.commissionRub??0;
  if(within(f.receivedOn)){result.received+=f.commissionRub??0;result.receivedDeals++;}
  if(within(f.agentPaidOn))result.agentPaid+=f.agentPayoutRub??0;
 }
 result.balance=result.received-result.agentPaid;return result;
}

export function financeError(f:DealFinance){
 if([f.commissionRub,f.agentPayoutRub].some(v=>v!==null&&(!Number.isInteger(v)||v<0||v>1_000_000_000)))return 'Укажите суммы в целых рублях от 0 до 1 млрд';
 if(f.agentPayoutRub!==null&&f.commissionRub!==null&&f.agentPayoutRub>f.commissionRub)return 'Выплата агенту не может превышать комиссию';
 if(f.receivedOn&&!(f.commissionRub&&f.commissionRub>0))return 'Для поступления укажите сумму комиссии';
 if(f.agentPaidOn&&!(f.agentPayoutRub&&f.agentPayoutRub>0))return 'Для выплаты укажите сумму агенту';
 if([f.receivedOn,f.agentPaidOn].some(d=>d&&d>businessDay()))return 'Фактическая оплата не может быть в будущем';
 return '';
}
