import React from 'react';
import type {DealFinance} from '../../../../packages/pulse-data/model';
export function DealFinanceEditor({value,onChange}:{value:DealFinance;onChange:(v:DealFinance)=>void}){
 const patch=(p:Partial<DealFinance>)=>onChange({...value,...p});
 const error=value.agentPayoutRub!==null&&value.commissionRub!==null&&value.agentPayoutRub>value.commissionRub;
 return <section className="catalogEditorSection" aria-label="Финансы сделки"><h3>Финансы сделки</h3><p className="financeHelp">Суммы в целых рублях. Фактические даты подтверждают полное поступление комиссии и полную выплату агенту.</p><div className="formGrid">
 {([['commissionRub','Комиссия агентству, ₽'],['agentPayoutRub','Выплата агенту, ₽']] as const).map(([key,label])=><label key={key} className="controlField"><span>{label}</span><input type="number" min="0" max="1000000000" step="1" value={value[key]??''} onChange={e=>patch({[key]:e.target.value===''?null:Number(e.target.value)})}/></label>)}
 {([['expectedPaymentOn','Ожидаемая дата поступления'],['receivedOn','Комиссия поступила'],['agentPaidOn','Агенту выплачено']] as const).map(([key,label])=><label key={key} className="controlField"><span>{label}</span><input type="date" value={value[key]||''} onChange={e=>patch({[key]:e.target.value||null})}/></label>)}
 </div>{error&&<p className="errorNotice" role="alert">Выплата агенту не может превышать комиссию.</p>}
 <p className="financeHelp">После расчёта с агентом: {value.commissionRub===null?'сумма комиссии не указана':new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(value.commissionRub-(value.agentPayoutRub??0))}. Без учёта рекламы, налогов и других расходов.</p></section>;
}
