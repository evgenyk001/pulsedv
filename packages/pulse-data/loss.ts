import type {PulseLead} from './model';
import {businessDay} from './business';
export const LOSS_REASONS={down_payment:'Недостаточно первоначального взноса',mortgage_declined:'Ипотека не одобрена',postponed:'Покупка отложена',other_property:'Выбран другой объект или агент',no_contact:'Не удалось связаться',not_relevant:'Запрос не подходит',other:'Другая причина'} as const;
export type LossReason=keyof typeof LOSS_REASONS;
export const LOSS_REASON_IDS=Object.keys(LOSS_REASONS) as LossReason[];
export function lossError(status:string,reason:string|null|undefined,note:string|null|undefined){
 if(status!=='lost')return reason||note?'Причина потери доступна только для потерянного клиента':'';
 if(!reason||!LOSS_REASON_IDS.includes(reason as LossReason))return 'Выберите причину потери клиента';
 if(reason==='other'&&!note?.trim())return 'Уточните другую причину потери';
 if((note?.length??0)>1000)return 'Комментарий к причине — до 1000 символов';
 return '';
}
export type LossSummary={total:number;undated:number;items:{reason:LossReason|'unspecified';count:number;percent:number}[]};
export function lossSummary(leads:Pick<PulseLead,'status'|'lossReason'|'lostAt'>[],from:string,to:string):LossSummary{
 const counts=new Map<LossReason|'unspecified',number>();let total=0,undated=0;
 for(const lead of leads){if(lead.status!=='lost')continue;if(!lead.lostAt){undated++;continue}const day=businessDay(new Date(lead.lostAt));if(day<from||day>to)continue;total++;const reason=lead.lossReason&&LOSS_REASON_IDS.includes(lead.lossReason)?lead.lossReason:'unspecified';counts.set(reason,(counts.get(reason)??0)+1)}
 return {total,undated,items:[...counts].map(([reason,count])=>({reason,count,percent:total?Math.round(count/total*100):0})).sort((a,b)=>b.count-a.count||a.reason.localeCompare(b.reason))};
}
