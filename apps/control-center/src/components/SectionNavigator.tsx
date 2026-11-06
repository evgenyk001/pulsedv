import React from 'react';
import {useNavigate} from 'react-router-dom';
import {ArrowUpRight,Search,X} from 'lucide-react';
import {useDialog} from './useDialog';
type Section={to:string;label:string;group:string};
export function SectionNavigator({sections,onClose}:{sections:Section[];onClose:()=>void}){
 const [query,setQuery]=React.useState('');const navigate=useNavigate();
 const items=sections.filter(s=>(s.label+' '+s.group).toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru').trim()));
 useDialog(true,onClose);
 const go=(to:string)=>{onClose();navigate(to)};
 return <div className="sectionNavigatorBackdrop" onClick={onClose}><section className="sectionNavigator" role="dialog" aria-modal="true" aria-label="Быстрый переход" onClick={e=>e.stopPropagation()}>
  <header><Search size={19} aria-hidden="true"/><input aria-label="Найти раздел" placeholder="Куда перейти?" value={query} onChange={e=>setQuery(e.target.value)} autoFocus onKeyDown={e=>{if(e.key==='Enter'&&items[0]){e.preventDefault();go(items[0].to)}}}/><button aria-label="Закрыть быстрый переход" onClick={onClose}><X size={19}/></button></header>
  <div className="sectionNavigatorResults">{items.length?items.map(item=><button key={item.to} onClick={()=>go(item.to)}><span><strong>{item.label}</strong><small>{item.group}</small></span><ArrowUpRight size={16}/></button>):<p role="status">Раздел не найден. Попробуйте другое название.</p>}</div>
  <footer>Введите название раздела <span>Enter — открыть · Esc — закрыть</span></footer>
 </section></div>;
}
