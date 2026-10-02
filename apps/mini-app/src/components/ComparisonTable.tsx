import React from 'react';
import {Link} from 'react-router-dom';
import {Building2, Check, ChevronRight, MapPin, SlidersHorizontal, WalletCards} from 'lucide-react';
import {monthlyMortgagePayment} from '../../../../packages/domain/propertyMatch';
import type {PulseProperty} from '../../../../packages/pulse-data/model';
import styles from './ComparisonTable.module.css';

export function ComparisonTable({properties}:{properties:PulseProperty[]}){
 const [different,setDifferent]=React.useState(false),[down,setDown]=React.useState(30),[rate,setRate]=React.useState(18),[years,setYears]=React.useState(20);
 const rows:{name:string;value:(p:PulseProperty)=>string}[]=[
  {name:'Расположение',value:p=>p.city+' · '+p.district},
  {name:'Цена от',value:p=>p.priceFrom.toLocaleString('ru-RU')+' млн ₽'},
  {name:'Застройщик',value:p=>p.developerName||'Уточняется'},
  {name:'Сдача',value:p=>p.delivery||'Уточняется'},
  {name:'Класс',value:p=>p.className||'Уточняется'},
  {name:'Комнатность',value:p=>p.floorplans.map(f=>f.roomLabel).join(', ')||'Уточняется'},
  {name:'Отделка',value:p=>p.features.filter(f=>/отдел|ремонт/i.test(f.label)).map(f=>f.label).join(', ')||'Не указана'},
  {name:'Платёж по сценарию',value:p=>Math.round(monthlyMortgagePayment(p.priceFrom*1e6*(1-down/100),rate,years)).toLocaleString('ru-RU')+' ₽/мес'},
 ];
 const displayed=rows.filter(r=>!different||new Set(properties.map(r.value)).size>1);
 return <section className={styles.compare} aria-label="Сравнение ЖК">
  <div className={styles.projectRail}>
   {properties.map((p,index)=><article className={styles.project} key={p.id}>
    <div className={styles.projectMedia}>
     {p.coverImageUrl?<img src={p.coverImageUrl} alt=""/>:<span><Building2 size={23}/></span>}
     <i>{index+1}</i>
    </div>
    <div className={styles.projectCopy}>
     <strong>{p.name}</strong>
     <small><MapPin size={11}/>{p.city} · {p.district}</small>
     <b>от {p.priceFrom.toLocaleString('ru-RU')} млн ₽</b>
    </div>
    <Link to={"/property/"+p.id} aria-label={"Открыть "+p.name}><ChevronRight size={17}/></Link>
   </article>)}
  </div>

  <section className={styles.scenario}>
   <div className={styles.scenarioHead}><span><SlidersHorizontal size={16}/></span><div><strong>Сценарий платежа</strong><small>Меняйте параметры — расчёт обновится сразу</small></div></div>
   <div className={styles.inputs}>
    <label><span>Взнос</span><div><input aria-label="Взнос, %" type="number" min={0} max={100} value={down} onChange={e=>setDown(Math.min(100,Math.max(0,Number(e.target.value))))}/><b>%</b></div></label>
    <label><span>Ставка</span><div><input aria-label="Ставка, %" type="number" min={0} max={50} step={0.1} value={rate} onChange={e=>setRate(Math.min(50,Math.max(0,Number(e.target.value))))}/><b>%</b></div></label>
    <label><span>Срок</span><div><input aria-label="Срок, лет" type="number" min={1} max={30} value={years} onChange={e=>setYears(Math.min(30,Math.max(1,Number(e.target.value))))}/><b>лет</b></div></label>
   </div>
  </section>

  <div className={styles.compareHead}>
   <div><span>ПАРАМЕТРЫ</span><strong>{different?'Только различия':'Всё рядом'}</strong></div>
   <label className={styles.differenceToggle}><input type="checkbox" checked={different} onChange={e=>setDifferent(e.target.checked)}/><span><Check size={12}/></span>Только различия</label>
  </div>

  <div className={styles.rows}>
   {displayed.map(row=><section className={styles.row} key={row.name}>
    <h3>{row.name}</h3>
    <div className={styles.values}>
     {properties.map((property,index)=><div key={property.id}><i>{index+1}</i><span>{row.value(property)}</span></div>)}
    </div>
   </section>)}
   {!displayed.length&&<div className={styles.same}>По выбранным параметрам проекты одинаковы.</div>}
  </div>

  <p className={styles.disclaimer}><WalletCards size={14}/>Расчёт ориентировочный: минимальная цена ЖК, взнос {down}%, ставка {rate}%, срок {years} лет. Условия банка и наличие квартир уточняются отдельно.</p>
 </section>;
}
