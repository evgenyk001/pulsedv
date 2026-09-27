import React from 'react';
import {monthlyMortgagePayment} from '../../../../packages/domain/propertyMatch';
import type {PulseProperty} from '../../../../packages/pulse-data/model';
import '../../../../packages/journey/journey.css';
export function ComparisonTable({properties}:{properties:PulseProperty[]}){
 const [different,setDifferent]=React.useState(false),[down,setDown]=React.useState(30),[rate,setRate]=React.useState(18),[years,setYears]=React.useState(20);
 const rows:{name:string;value:(p:PulseProperty)=>string}[]=[
 {name:'Расположение',value:p=>p.city+' · '+p.district},{name:'Цена от',value:p=>p.priceFrom.toLocaleString('ru-RU')+' млн ₽'},
 {name:'Сдача',value:p=>p.delivery||'Уточняется'},{name:'Класс',value:p=>p.className||'Уточняется'},
 {name:'Комнатность',value:p=>p.floorplans.map(f=>f.roomLabel).join(', ')||'Уточняется'},
 {name:'Отделка',value:p=>p.features.filter(f=>/отдел|ремонт/i.test(f.label)).map(f=>f.label).join(', ')||'Не указана'},
 {name:'Платёж по сценарию',value:p=>Math.round(monthlyMortgagePayment(p.priceFrom*1e6*(1-down/100),rate,years)).toLocaleString('ru-RU')+' ₽/мес'}];
 return <section className="pulseJourney" aria-label="Сравнение ЖК"><label><span><input type="checkbox" checked={different} onChange={e=>setDifferent(e.target.checked)}/> Только различия</span></label><details><summary>Параметры платежа</summary><label>Взнос, %<input type="number" min={0} max={100} value={down} onChange={e=>setDown(Math.min(100,Math.max(0,Number(e.target.value))))}/></label><label>Ставка, %<input type="number" min={0} max={50} step={0.1} value={rate} onChange={e=>setRate(Math.min(50,Math.max(0,Number(e.target.value))))}/></label><label>Срок, лет<input type="number" min={1} max={30} value={years} onChange={e=>setYears(Math.min(30,Math.max(1,Number(e.target.value))))}/></label></details><div className="journeyTable" tabIndex={0} aria-label="Прокручиваемая таблица сравнения"><table><thead><tr><th>Параметр</th>{properties.map(p=><th key={p.id}>{p.name}</th>)}</tr></thead><tbody>{rows.filter(r=>!different||new Set(properties.map(r.value)).size>1).map(r=><tr key={r.name}><th>{r.name}</th>{properties.map(p=><td key={p.id}>{r.value(p)}</td>)}</tr>)}</tbody></table></div><p>Расчёт по минимальной цене ЖК, взнос {down}%, ставка {rate}%, срок {years} лет. Не предложение банка. Цена квартиры и условия кредита уточняются отдельно.</p></section>;
}
