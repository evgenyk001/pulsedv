import {ControlSelect} from './ControlSelect';
import React from 'react';
import {createPortal} from 'react-dom';
import {ArrowLeft, Check, CircleHelp, X} from 'lucide-react';
export type RecordSection={id:string;label:string;count?:number;content:React.ReactNode};
/** A record is a workspace: fixed chrome and exactly one scrolling content area. */
export function RecordWorkspace({title,eyebrow,label,sections,onClose,footer,notice,issues=[]}:{title:string;eyebrow:string;label:string;sections:RecordSection[];onClose:()=>void;footer?:React.ReactNode;notice?:React.ReactNode;issues?:{section:string;message:string}[]}){
 const [active,setActive]=React.useState(sections[0].id);const prefix=React.useId();
 React.useLayoutEffect(()=>{const viewport=window.visualViewport;const update=()=>{document.documentElement.style.setProperty('--record-viewport-height',(viewport?.height??window.innerHeight)+'px');document.documentElement.style.setProperty('--record-viewport-top',(viewport?.offsetTop??0)+'px')};update();viewport?.addEventListener('resize',update);viewport?.addEventListener('scroll',update);window.addEventListener('resize',update);return()=>{viewport?.removeEventListener('resize',update);viewport?.removeEventListener('scroll',update);window.removeEventListener('resize',update)}},[]);
 const scroll=React.useRef<HTMLDivElement>(null),tabs=React.useRef<HTMLDivElement>(null);
 const choose=(id:string)=>{setActive(id);scroll.current?.scrollTo({top:0,behavior:'instant'});};
 const tabKey=(e:React.KeyboardEvent,index:number)=>{let i=index;if(e.key==='ArrowRight')i=(i+1)%sections.length;else if(e.key==='ArrowLeft')i=(i+sections.length-1)%sections.length;else if(e.key==='Home')i=0;else if(e.key==='End')i=sections.length-1;else return;e.preventDefault();choose(sections[i].id);tabs.current?.querySelectorAll<HTMLButtonElement>('[role=tab]')[i]?.focus()};
 const view=<div className="recordBackdrop"><section className="recordWorkspace" role="dialog" aria-modal="true" aria-label={label}>
  <header className="recordHeader"><button type="button" className="recordBack" aria-label="Вернуться к списку" onClick={onClose}><ArrowLeft size={19}/></button><div><span>{eyebrow}</span><h2>{title}</h2></div><button type="button" className="recordClose" aria-label="Закрыть редактор" onClick={onClose}><X size={19}/></button></header>
  <div className={'recordTabs'+(sections.length>4?' recordTabsMany':'')} role="tablist" aria-label="Разделы карточки" ref={tabs}>{sections.map((s,i)=><button type="button" role="tab" aria-selected={active===s.id} tabIndex={active===s.id?0:-1} aria-controls={prefix+s.id} id={prefix+'tab-'+s.id} key={s.id} onClick={()=>choose(s.id)} onKeyDown={e=>tabKey(e,i)}>{s.label}{s.count!==undefined&&<span>{s.count}</span>}</button>)}</div>
  {sections.length>4&&<label className="recordMobileNavigation"><span>Раздел</span><ControlSelect aria-label="Раздел карточки" value={active} onChange={e=>choose(e.target.value)}>{sections.map(s=><option key={s.id} value={s.id}>{s.label}{s.count!==undefined?' · '+s.count:''}</option>)}</ControlSelect></label>}
  <div className="recordScroll" ref={scroll}>{notice}{issues.map(issue=><div className="recordIssue" key={issue.section} role="alert"><span>{issue.message}</span><button type="button" className="secondaryAction" onClick={()=>choose(issue.section)}>Проверить поля</button></div>)}<div className="recordContent">{sections.map(s=><div key={s.id} role="tabpanel" id={prefix+s.id} aria-labelledby={prefix+'tab-'+s.id} hidden={active!==s.id}>{s.content}</div>)}</div></div>
  {footer&&<footer className="recordFooter">{footer}</footer>}
 </section></div>;
 const host=document.getElementById('control-record-root');return host?createPortal(view,host):view;
}
export function SaveStatus({dirty,busy}:{dirty:boolean;busy:boolean}){return <span className={'recordSaveStatus'+(dirty?' isDirty':'')} role="status"><Check size={15}/>{busy?'Сохраняем…':dirty?'Есть изменения':'Изменения сохранены'}</span>}
export function FieldHelp({text}:{text:string}){
 const [open,setOpen]=React.useState(false),[position,setPosition]=React.useState({left:12,top:12});const id=React.useId();const trigger=React.useRef<HTMLButtonElement>(null),popup=React.useRef<HTMLSpanElement>(null);
 React.useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!trigger.current?.contains(e.target as Node)&&!popup.current?.contains(e.target as Node))setOpen(false)};const close=()=>setOpen(false);document.addEventListener('pointerdown',outside);window.addEventListener('resize',close);return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',close)}},[open]);
 const toggle=()=>{const r=trigger.current?.getBoundingClientRect();if(r)setPosition({left:Math.max(12,Math.min(r.left-30,window.innerWidth-Math.min(310,window.innerWidth-24)-12)),top:r.bottom+180<window.innerHeight?r.bottom+8:Math.max(12,r.top-170)});setOpen(!open)};
 return <span className="fieldHelp"><button ref={trigger} type="button" aria-label="Пояснение к полю" aria-expanded={open} aria-controls={id} onClick={toggle} onKeyDown={e=>{if(e.key==='Escape'&&open){e.preventDefault();e.stopPropagation();setOpen(false)}}}><CircleHelp size={15}/></button>{open&&createPortal(<span className="fieldHelpPopover" ref={popup} id={id} role="note" style={position}>{text}</span>,document.body)}</span>;
}
