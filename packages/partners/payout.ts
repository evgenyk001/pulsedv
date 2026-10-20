import {normalizePartnerPhone} from './model';
export type PayoutMethod='contact'|'sbp'|'bank'|'cash';
export type PayoutStage='details_needed'|'details_received'|'agreed';
export type PayoutDetails={method:PayoutMethod;recipientName:string;contactPhone:string;sbpPhone:string;bankName:string;account:string;bic:string;inn:string;officeAddress:string;meetingAt:string;note:string};
export const payoutMethods:Record<PayoutMethod,string>={contact:'Обсудить с командой',sbp:'Перевод по СБП',bank:'По банковским реквизитам',cash:'Наличными в офисе'};
export const payoutStages:Record<PayoutStage,string>={details_needed:'Нужно согласовать получение',details_received:'Партнёр передал данные',agreed:'Получение согласовано'};
export const emptyPayout=(name='',phone=''):PayoutDetails=>({method:'contact',recipientName:name,contactPhone:phone,sbpPhone:phone,bankName:'',account:'',bic:'',inn:'',officeAddress:'',meetingAt:'',note:''});
export function cleanPayout(p:PayoutDetails):PayoutDetails{
 const clean=Object.fromEntries(Object.entries(p).map(([k,v])=>[k,typeof v==='string'?v.trim():v])) as PayoutDetails;
 clean.contactPhone=normalizePartnerPhone(clean.contactPhone);clean.sbpPhone=normalizePartnerPhone(clean.sbpPhone);
 if(clean.method!=='sbp'){clean.sbpPhone='';if(clean.method!=='bank')clean.bankName=''}
 if(clean.method!=='bank'){clean.account='';clean.bic='';clean.inn=''}
 if(clean.method!=='cash'){clean.officeAddress='';clean.meetingAt=''}
 return clean;
}
export function payoutError(value:PayoutDetails,agreement=false){
 const p=cleanPayout(value),phone=(v:string)=>/^\+[1-9]\d{9,14}$/.test(v);
 if(!payoutMethods[p.method])return 'Выберите способ получения';
 if(p.recipientName.length<2||p.recipientName.length>200)return 'Укажите полное имя или название получателя';
 if(!phone(p.contactPhone))return 'Укажите контактный телефон с кодом страны';
 if(p.method==='sbp'&&(!phone(p.sbpPhone)||p.bankName.length<2))return 'Для СБП укажите номер телефона и банк получателя';
 if(p.method==='bank'&&(!/^\d{20}$/.test(p.account)||!/^\d{9}$/.test(p.bic)||!/^\d{10}(\d{2})?$/.test(p.inn)||p.bankName.length<2))return 'Укажите банк, счёт из 20 цифр, БИК из 9 цифр и ИНН из 10 или 12 цифр';
 if(agreement&&p.method==='contact')return 'Сначала выберите конкретный способ получения';
 if(agreement&&p.method==='cash'&&(p.officeAddress.length<5||!Number.isFinite(Date.parse(p.meetingAt))))return 'Укажите адрес офиса и согласованное время приезда';
 return '';
}
