import React from 'react';
import {createPortal} from 'react-dom';
import {Check,ChevronDown} from 'lucide-react';
type Props=React.SelectHTMLAttributes<HTMLSelectElement>;
type Choice={value:string;label:string;disabled:boolean};
const text=(node:React.ReactNode):string=>React.Children.toArray(node).map(x=>typeof x==='string'||typeof x==='number'?String(x):React.isValidElement<{children?:React.ReactNode}>(x)?text(x.props.children):'').join('');
const choices=(children:React.ReactNode,disabled=false):Choice[]=>React.Children.toArray(children).flatMap(child=>{
 if(!React.isValidElement<{value?:string|number;children?:React.ReactNode;disabled?:boolean}>(child))return[];
 if(child.type==='option')return[{value:String(child.props.value??text(child.props.children)),label:text(child.props.children),disabled:disabled||!!child.props.disabled}];
 return choices(child.props.children,disabled||!!child.props.disabled);
});
/** Styled listbox; the select remains for form semantics and existing value handlers. */
export function ControlSelect(props:Props){
 const {children,className,onChange,...rest}=props;const items=choices(children);const id=React.useId();
 const native=React.useRef<HTMLSelectElement>(null),trigger=React.useRef<HTMLButtonElement>(null),menu=React.useRef<HTMLDivElement>(null);
 const [open,setOpen]=React.useState(false),[active,setActive]=React.useState(0),[name,setName]=React.useState(props['aria-label']||'Выбрать значение');
 const [position,setPosition]=React.useState({left:0,top:0,width:240,maxHeight:280});
 const value=String(props.value??props.defaultValue??items[0]?.value??'');const selected=items.find(i=>i.value===value);
 React.useLayoutEffect(()=>{const label=native.current?.closest('label');const title=label?.querySelector(':scope > span:not(.controlSelect)')?.textContent?.trim()||Array.from(label?.childNodes??[]).filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join(' ').trim();setName(props['aria-label']||title||'Выбрать значение')},[props['aria-label']]);
 const measure=()=>{const r=trigger.current?.getBoundingClientRect();if(!r)return;const viewport=window.visualViewport;const height=viewport?.height??window.innerHeight,offset=viewport?.offsetTop??0;const width=Math.min(Math.max(r.width,220),window.innerWidth-24);const below=height+offset-r.bottom-12,above=r.top-offset-12;const h=Math.min(300,Math.max(below,above));setPosition({left:Math.max(12,Math.min(r.left,window.innerWidth-width-12)),top:below>=Math.min(200,above)?r.bottom+6:r.top-Math.min(h,items.length*42+12)-6,width,maxHeight:h})};
 const show=()=>{if(props.disabled)return;measure();setActive(Math.max(0,items.findIndex(i=>i.value===value)));setOpen(true)};
 const choose=(index:number)=>{const item=items[index];if(!item||item.disabled)return;const el=native.current;if(el){el.value=item.value;el.dispatchEvent(new Event('change',{bubbles:true}));}setOpen(false);trigger.current?.focus()};
 React.useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!trigger.current?.contains(e.target as Node)&&!menu.current?.contains(e.target as Node))setOpen(false)};const close=(e:Event)=>{if(e.type==='scroll'&&menu.current?.contains(e.target as Node))return;setOpen(false)};document.addEventListener('pointerdown',outside);window.addEventListener('resize',close);window.addEventListener('scroll',close,true);return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',close);window.removeEventListener('scroll',close,true)}},[open]);
 React.useEffect(()=>{if(open)menu.current?.querySelector<HTMLElement>('[data-active=true]')?.scrollIntoView({block:'nearest'})},[open,active]);
 const keyboard=(e:React.KeyboardEvent)=>{
  if(e.key==='Escape'&&open){e.preventDefault();e.stopPropagation();setOpen(false);return}
  if(e.key==='Tab'){setOpen(false);return}
  if(['ArrowDown','ArrowUp','Home','End','Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();if(!open){show();return}if(e.key==='Enter'||e.key===' '){choose(active);return}let next=e.key==='Home'?0:e.key==='End'?items.length-1:(active+(e.key==='ArrowUp'?-1:1)+items.length)%items.length;for(let n=0;n<items.length&&items[next]?.disabled;n++)next=(next+(e.key==='ArrowUp'?-1:1)+items.length)%items.length;setActive(next)}
  else if(e.key.length===1&&!e.metaKey&&!e.ctrlKey){const index=items.findIndex(i=>!i.disabled&&i.label.toLocaleLowerCase('ru').startsWith(e.key.toLocaleLowerCase('ru')));if(index>=0){e.preventDefault();if(!open)show();setActive(index)}}
 };
 return <span className={'controlSelect '+(className||'')}><select {...rest} className="selectSemantic" ref={native} aria-hidden="true" tabIndex={-1} onChange={onChange}>{children}</select><button ref={trigger} type="button" role="combobox" aria-label={name} aria-haspopup="listbox" aria-required={props.required||undefined} aria-invalid={props['aria-invalid']} aria-describedby={props['aria-describedby']} aria-expanded={open} aria-controls={open?id:undefined} aria-activedescendant={open?id+'-'+active:undefined} disabled={props.disabled} className="selectTrigger" onClick={()=>open?setOpen(false):show()} onKeyDown={keyboard}><span>{selected?.label||'Выберите значение'}</span><ChevronDown size={16}/></button>{open&&createPortal(<div ref={menu} role="listbox" id={id} aria-label={name} className="controlSelectMenu" style={position} onPointerDown={e=>e.preventDefault()}>{items.map((item,i)=><div role="option" aria-selected={item.value===value} aria-disabled={item.disabled} id={id+'-'+i} key={item.value} data-active={i===active} onPointerMove={()=>setActive(i)} onClick={()=>choose(i)}><span>{item.label}</span>{item.value===value&&<Check size={16}/>}</div>)}</div>,document.body)}</span>;
}
