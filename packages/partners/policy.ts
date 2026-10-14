import {businessDay} from '../pulse-data/business';
export const PARTNER_CLAIM_MONTHS=6;
/** Calendar months in the agency's timezone; clamp 31st to the target month's last day. */
export function claimExpiresOn(start:string){
 const [year,month,day]=start.split('-').map(Number),last=new Date(Date.UTC(year,month-1+PARTNER_CLAIM_MONTHS+1,0));
 const date=new Date(Date.UTC(last.getUTCFullYear(),last.getUTCMonth(),Math.min(day,last.getUTCDate())));
 return date.toISOString().slice(0,10);
}
export function claimDateError(start:string|null|undefined,end:string|null|undefined,dealOn:string,today=businessDay()){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(dealOn)||Number.isNaN(Date.parse(dealOn+'T00:00:00Z'))||new Date(dealOn+'T00:00:00Z').toISOString().slice(0,10)!==dealOn||dealOn>today)return 'Укажите фактическую дату сделки не позднее сегодняшнего дня';
 if(start&&dealOn<start)return 'Дата сделки раньше подтверждённого закрепления';
 if(end&&dealOn>end)return 'Сделка состоялась после окончания шестимесячного закрепления';
 return '';
}
export function claimLabel(end:string|null|undefined,today=businessDay()){
 if(!end)return 'Условия прежней редакции';
 const date=new Date(end+'T00:00:00Z').toLocaleDateString('ru-RU',{timeZone:'UTC'});
 return end<today?'Закреп истёк '+date:'Закреп до '+date;
}
