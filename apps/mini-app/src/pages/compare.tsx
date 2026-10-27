import {LoadRecovery} from '../components/LoadRecovery';
import React from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {Plus,Search,X,Check,Building2} from 'lucide-react';
import {BackLink} from '../components/BackLink';
import {PageHeader} from '../components/PageHeader';
import {ComparisonTable} from '../components/ComparisonTable';
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from '../components/Sheet';
import {Input} from '../components/Input';
import {useFavoriteIds} from '../helpers/useFavoriteIds';
import {useFavoriteProperties} from '../helpers/useCatalog';
import {recordPulseEvent} from '../../../../packages/pulse-data';
import styles from './compare.module.css';

export default function ComparePage(){
 const {ids}=useFavoriteIds();
 const {data:saved=[],isLoading,error,refetch}=useFavoriteProperties(ids);
 const [params,setParams]=useSearchParams();
 const [picker,setPicker]=React.useState<number|null>(null),[query,setQuery]=React.useState('');
 const initialized=React.useRef(false),lastViewed=React.useRef('');
 const pair=[params.get('first')||'',params.get('second')||''];
 const selected=pair.map((id,index)=>index===1&&id===pair[0]?undefined:saved.find(p=>p.id===id));
 const complete=selected[0]&&selected[1];
 React.useEffect(()=>{
  if(isLoading||initialized.current||!saved.length)return;
  initialized.current=true;
  if(pair.some(Boolean))return;
  let stored:string[]=[];try{const value=JSON.parse(localStorage.getItem('pulse.compare.v1')||'[]');if(Array.isArray(value))stored=[...new Set(value.filter((id:unknown):id is string=>typeof id==='string'&&saved.some(p=>p.id===id)))].slice(0,2)}catch{}
  const initial=stored.length?stored:saved.length===2?saved.map(p=>p.id):[];
  if(initial.length){const next=new URLSearchParams();next.set('first',initial[0]);if(initial[1])next.set('second',initial[1]);setParams(next,{replace:true})}
 },[isLoading,saved,params,setParams]);
 React.useEffect(()=>{if(isLoading||!initialized.current)return;try{localStorage.setItem('pulse.compare.v1',JSON.stringify(selected.flatMap(p=>p?[p.id]:[])))}catch{}},[pair.join('|'),isLoading,saved]);
 const choose=(index:number,id:string)=>{
  const next=new URLSearchParams(params);id?next.set(index===0?'first':'second',id):next.delete(index===0?'first':'second');
  setParams(next,{replace:true});setPicker(null);setQuery('');
  recordPulseEvent({eventType:id?'compare_add':'compare_remove',entityType:'property',entityId:id||pair[index]});
 };
 const pick=(index:number)=>{setQuery('');setPicker(index)};
 React.useEffect(()=>{const value=pair.join(',');if(complete&&lastViewed.current!==value){lastViewed.current=value;recordPulseEvent({eventType:'comparison_view',metadata:{propertyIds:value}})}},[complete?.id,pair.join('|')]);
 const filtered=saved.filter(p=>(p.name+' '+p.city+' '+p.district).toLocaleLowerCase('ru-RU').includes(query.trim().toLocaleLowerCase('ru-RU')));
 return <div className={styles.page}>
  <nav data-app-back-row className={styles.back}><BackLink to="/favorites" aria-label="Назад в избранное"/><span>Сравнение</span></nav>
  <PageHeader title={complete?'Сравнение двух ЖК':'Какие ЖК сравним?'} subtitle={complete?'Каждый параметр — рядом. Сразу видно, чем отличаются два варианта.':'Выберите первый и второй ЖК из избранного.'}/>
  {error&&!saved.length&&<LoadRecovery label="Обновить сравнение" onRetry={()=>void refetch()}/>}
  {isLoading?<p role="status">Загружаем избранное…</p>:complete?<ComparisonTable properties={[selected[0]!,selected[1]!]} onReplace={pick} onRemove={index=>choose(index,'')}/>:<>
   <div className={styles.slots}>{[0,1].map(index=>{const p=selected[index];return <div className={styles.slot} key={index}>
    <span className={styles.ordinal}>{index===0?'Первый ЖК':'Второй ЖК'}</span>
    <button className={styles.pick} onClick={()=>pick(index)} disabled={!saved.length} aria-label={p?'Заменить '+p.name:index===0?'Выбрать первый ЖК':'Выбрать второй ЖК'}>
     {p?<>{p.coverImageUrl?<img src={p.coverImageUrl} alt="" onError={event=>{event.currentTarget.style.visibility="hidden"}}/>:<Building2/>}<strong>{p.name}</strong><small>Заменить ЖК</small></>:<><span><Plus size={28}/></span><strong>Выбрать ЖК</strong></>}
    </button>{p&&<button className={styles.remove} onClick={()=>choose(index,'')} aria-label={'Убрать '+p.name+' из сравнения'}><X size={16}/></button>}
   </div>})}</div>
   {!error&&saved.length<2&&<div className={styles.empty}><p>{saved.length?'Нужен ещё один ЖК. Сохраните его в каталоге, затем вернитесь сюда.':'Сохраните понравившиеся ЖК в избранное — здесь можно будет сравнить два из них.'}</p><Link to="/catalog">Выбрать ЖК в каталоге</Link></div>}
  </>}
  <Sheet open={picker!==null} onOpenChange={open=>{if(!open)setPicker(null)}}><SheetContent side="bottom" className={styles.picker}>
   <SheetHeader><SheetTitle>{picker===0?'Выберите первый ЖК':'Выберите второй ЖК'}</SheetTitle><SheetDescription>Сохранённые ЖК из вашего избранного.</SheetDescription></SheetHeader>
   <button className={styles.close} aria-label="Закрыть выбор ЖК" onClick={()=>setPicker(null)}><X size={18}/></button>
   {saved.length>4&&<label className={styles.search}><Search size={17}/><Input aria-label="Найти ЖК в избранном" placeholder="Название или район" value={query} onChange={e=>setQuery(e.target.value)}/></label>}
   <div className={styles.choices}>{filtered.map(p=>{const other=pair[picker===0?1:0]===p.id;const active=pair[picker??0]===p.id;return <button key={p.id} className={styles.choice} disabled={other} aria-label={'Выбрать '+p.name} onClick={()=>choose(picker??0,p.id)}>
    {p.coverImageUrl?<img src={p.coverImageUrl} alt="" onError={event=>{event.currentTarget.style.visibility="hidden"}}/>:<Building2 size={30}/>}<span><strong>{p.name}</strong><small>{p.city} · {p.district}</small><b>от {p.priceFrom.toLocaleString('ru-RU')} млн ₽</b>{other&&<small>Уже выбран для другой колонки</small>}</span><span className={styles.choiceIcon}>{active?<Check size={18}/>:<Plus size={18}/>}</span>
   </button>})}{!filtered.length&&<p>По этому запросу ничего не найдено.</p>}</div>
  </SheetContent></Sheet>
 </div>;
}
