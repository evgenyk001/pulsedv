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

// Keep the user's draft separate from the last valid calculation. In particular,
// clearing an input must not coerce an empty string to 0 (or the minimum term).
function ScenarioNumberInput({label,value,min,max,integer=false,onChange}:{label:string;value:number;min:number;max:number;integer?:boolean;onChange:(value:number)=>void}){
 const [draft,setDraft]=React.useState(String(value).replace('.',','));
 const edit=(text:string)=>{
  if(!(integer?/^\d*$/:/^\d*(?:[.,]\d*)?$/).test(text))return;
  setDraft(text);
  const number=text.trim()===''?NaN:Number(text.replace(',','.'));
  if(Number.isFinite(number)&&number>=min&&number<=max)onChange(number);
 };
 const commit=()=>{
  const number=draft.trim()===''?NaN:Number(draft.replace(',','.'));
  const next=Number.isFinite(number)?Math.min(max,Math.max(min,number)):value;
  onChange(next);setDraft(String(next).replace('.',','));
 };
 return <input aria-label={label} type="text" inputMode={integer?'numeric':'decimal'} maxLength={12} value={draft} onChange={e=>edit(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}}/>;
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
    <label><span>Взнос</span><div><ScenarioNumberInput label="Взнос, %" min={0} max={100} value={down} onChange={setDown}/><b>%</b></div></label>
    <label><span>Ставка</span><div><ScenarioNumberInput label="Ставка, %" min={0} max={50} value={rate} onChange={setRate}/><b>%</b></div></label>
    <label><span>Срок</span><div><ScenarioNumberInput label="Срок, лет" min={1} max={30} integer value={years} onChange={setYears}/><b>лет</b></div></label>
   </div>
  </section>

  <p className={styles.disclaimer}><WalletCards size={14}/>Расчёт ориентировочный: минимальная цена ЖК, взнос {down}%, ставка {rate}%, срок {years} лет. Условия банка и наличие квартир уточняются отдельно.</p>
 </section>;
}
