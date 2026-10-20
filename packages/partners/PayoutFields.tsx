import React from 'react';
import {emptyPayout,payoutMethods,type PayoutDetails,type PayoutMethod} from './payout';
import {vladivostokInputToIso,vladivostokInputNow} from '../journey/time';
import './payout.css';
export function PayoutFields({value,onChange,control=false,disabled=false}:{value:PayoutDetails;onChange:(p:PayoutDetails)=>void;control?:boolean;disabled?:boolean}){
 const patch=(p:Partial<PayoutDetails>)=>onChange({...value,...p});
 const field=(key:keyof PayoutDetails,label:string,placeholder='',maxLength=200,inputMode?:'tel'|'numeric')=><label key={key}>{label}<input value={value[key]} placeholder={placeholder} maxLength={maxLength} inputMode={inputMode} disabled={disabled} autoComplete="off" onChange={e=>patch({[key]:e.target.value})}/></label>;
 const time=value.meetingAt&&Number.isFinite(Date.parse(value.meetingAt))?new Date(Date.parse(value.meetingAt)+10*3600000).toISOString().slice(0,16):'';
 return <div className="partnerPayoutFields">
  <label>Как получить деньги<select aria-label="Как получить деньги" value={value.method} disabled={disabled} onChange={e=>patch({method:e.target.value as PayoutMethod})}>{Object.entries(payoutMethods).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
  {field('recipientName','Полное имя / название получателя','Как в документах')}
  {field('contactPhone','Телефон для связи с партнёром','+7 999 000-00-00',30,'tel')}
  {value.method==='sbp'&&<>{field('sbpPhone','Телефон для перевода по СБП','+7 999 000-00-00',30,'tel')}{field('bankName','Банк получателя','Например, Сбербанк')}</>}
  {value.method==='bank'&&<>{field('bankName','Банк получателя')}{field('account','Расчётный / банковский счёт','20 цифр',20,'numeric')}{field('bic','БИК банка','9 цифр',9,'numeric')}{field('inn','ИНН получателя','10 или 12 цифр',12,'numeric')}</>}
  {value.method==='cash'&&(control?<>{field('officeAddress','Адрес офиса для получения','Город, улица, дом, офис',500)}<label>Когда приехать (Владивосток)<input type="datetime-local" value={time} min={vladivostokInputNow()} disabled={disabled} onChange={e=>patch({meetingAt:vladivostokInputToIso(e.target.value)||''})}/></label></>:<p>Команда согласует с вами адрес офиса и время. Они появятся здесь после подтверждения.</p>)}
  {value.method==='contact'&&<p>Команда свяжется с вами по указанному телефону и поможет выбрать способ получения.</p>}
  <label>{control?'Сообщение партнёру':'Пожелания по получению'}<textarea value={value.note} maxLength={1000} rows={3} disabled={disabled} placeholder="Например, удобное время для звонка" onChange={e=>patch({note:e.target.value})}/></label>
  <small>Не указывайте пароль банка, PIN, CVV или код из СМС. Они не нужны для получения выплаты.</small>
 </div>;
}
export function PayoutSummary({details}:{details:PayoutDetails}){
 const p={...emptyPayout(),...details};return <dl className="partnerPayoutSummary"><div><dt>Способ</dt><dd>{payoutMethods[p.method]}</dd></div><div><dt>Получатель</dt><dd>{p.recipientName}</dd></div><div><dt>Телефон для связи</dt><dd>{p.contactPhone}</dd></div>{p.method==='sbp'&&<div><dt>СБП</dt><dd>{p.sbpPhone} · {p.bankName}</dd></div>}{p.method==='bank'&&<><div><dt>Банк / БИК</dt><dd>{p.bankName} / {p.bic}</dd></div><div><dt>Счёт / ИНН</dt><dd>{p.account} / {p.inn}</dd></div></>}{p.method==='cash'&&<><div><dt>Офис</dt><dd>{p.officeAddress||'Адрес уточняется'}</dd></div><div><dt>Время получения</dt><dd>{p.meetingAt?new Date(p.meetingAt).toLocaleString('ru-RU',{timeZone:'Asia/Vladivostok'}):'Время уточняется'} (Владивосток)</dd></div></>}{p.note&&<div><dt>Договорённость</dt><dd>{p.note}</dd></div>}</dl>;
}
