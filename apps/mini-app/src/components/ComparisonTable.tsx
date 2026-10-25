import React from 'react';
import {Link,useLocation} from 'react-router-dom';
import {Building2, Check, ChevronRight, MapPin, SlidersHorizontal, WalletCards, X} from 'lucide-react';
import {monthlyMortgagePayment} from '../../../../packages/domain/propertyMatch';
import type {PulseProperty} from '../../../../packages/pulse-data/model';
import styles from './ComparisonTable.module.css';

function readScenario(){
 const defaults={different:false,down:30,rate:18,years:20};
 try{const v=JSON.parse(sessionStorage.getItem('pulse.compare.scenario.v1')||'null');if(v&&typeof v.different==='boolean'&&Number.isFinite(v.down)&&v.down>=0&&v.down<=100&&Number.isFinite(v.rate)&&v.rate>=0&&v.rate<=50&&Number.isFinite(v.years)&&v.years>=1&&v.years<=30)return v as typeof defaults}catch{}
 return defaults;
}

export function ComparisonTable({properties,onReplace,onRemove}:{properties:PulseProperty[];onReplace?:(index:number)=>void;onRemove?:(index:number)=>void}){
 const location=useLocation();
 const [scenario,setScenario]=React.useState(readScenario);
 const {different,down,rate,years}=scenario;
 const setDifferent=(different:boolean)=>setScenario(v=>({...v,different}));
 const setDown=(down:number)=>setScenario(v=>({...v,down}));
 const setRate=(rate:number)=>setScenario(v=>({...v,rate}));
 const setYears=(years:number)=>setScenario(v=>({...v,years}));
 React.useEffect(()=>{try{sessionStorage.setItem('pulse.compare.scenario.v1',JSON.stringify(scenario))}catch{}},[scenario]);
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
     <span><Building2 size={23}/></span>{p.coverImageUrl&&<img src={p.coverImageUrl} alt="" onError={event=>{event.currentTarget.style.display="none"}}/>}
     <i>{index+1}</i>
    </div>
    <div className={styles.projectCopy}>
     <strong>{p.name}</strong>
     <small><MapPin size={11}/>{p.city} · {p.district}</small>
     <b>от {p.priceFrom.toLocaleString('ru-RU')} млн ₽</b>
    </div>
    <div className={styles.projectActions}>{onReplace&&<button onClick={()=>onReplace(index)} aria-label={'Заменить '+p.name}>Заменить</button>}{onRemove&&<button onClick={()=>onRemove(index)} aria-label={'Убрать '+p.name+' из сравнения'}><X size={15}/></button>}</div>
    <Link to={"/property/"+p.id} state={{returnTo:location.pathname+location.search}} aria-label={"Открыть "+p.name}>Подробнее <ChevronRight size={14}/></Link>
   </article>)}
  </div>

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

  <section className={styles.scenario}>
   <div className={styles.scenarioHead}><span><SlidersHorizontal size={16}/></span><div><strong>Сценарий платежа</strong><small>Меняйте параметры — расчёт обновится сразу</small></div></div>
   <div className={styles.inputs}>
    <label><span>Взнос</span><div><input aria-label="Взнос, %" type="number" min={0} max={100} value={down} onChange={e=>setDown(Math.min(100,Math.max(0,Number(e.target.value))))}/><b>%</b></div></label>
    <label><span>Ставка</span><div><input aria-label="Ставка, %" type="number" min={0} max={50} step={0.1} value={rate} onChange={e=>setRate(Math.min(50,Math.max(0,Number(e.target.value))))}/><b>%</b></div></label>
    <label><span>Срок</span><div><input aria-label="Срок, лет" type="number" min={1} max={30} value={years} onChange={e=>setYears(Math.min(30,Math.max(1,Number(e.target.value))))}/><b>лет</b></div></label>
   </div>
  </section>

  <p className={styles.disclaimer}><WalletCards size={14}/>Расчёт ориентировочный: минимальная цена ЖК, взнос {down}%, ставка {rate}%, срок {years} лет. Условия банка и наличие квартир уточняются отдельно.</p>
 </section>;
}
