import React from 'react';
import styles from './SegmentedControl.module.css';
export type SegmentOption<T extends string>={value:T;label:React.ReactNode};
export function SegmentedControl<T extends string>({value,options,onChange,ariaLabel,className=''}:{value:T;options:SegmentOption<T>[];onChange:(value:T)=>void;ariaLabel?:string;className?:string}){
 const root=React.useRef<HTMLDivElement>(null);const drag=React.useRef<{id:number;start:number;offset:number;moved:boolean}|null>(null);const suppress=React.useRef(false);
 const [width,setWidth]=React.useState(0);const [dragX,setDragX]=React.useState<number|null>(null);
 const count=Math.max(1,options.length);const index=Math.max(0,options.findIndex(x=>x.value===value));
 React.useLayoutEffect(()=>{const node=root.current;if(!node)return;const measure=()=>setWidth(Math.max(0,node.clientWidth-8)/count);measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();},[count]);
 const commit=(next:number)=>{if(next!==index){onChange(options[next].value);window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light');}};
 const end=(event:React.PointerEvent<HTMLDivElement>,cancel=false)=>{const current=drag.current;if(!current)return;drag.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);if(current.moved&&!cancel){const rect=event.currentTarget.getBoundingClientRect();const x=event.clientX-rect.left-4-current.offset;commit(Math.max(0,Math.min(count-1,Math.round(x/width))));suppress.current=true;window.setTimeout(()=>{suppress.current=false;},0);}setDragX(null);};
 return <div ref={root} className={styles.root+' '+className} role="tablist" aria-label={ariaLabel} style={{gridTemplateColumns:`repeat(${count},minmax(0,1fr))`}}
  onPointerDown={event=>{if(event.button!==0||!width)return;const x=event.clientX-event.currentTarget.getBoundingClientRect().left-4;if(x<index*width||x>(index+1)*width)return;drag.current={id:event.pointerId,start:event.clientX,offset:x-index*width,moved:false};}}
  onPointerMove={event=>{const current=drag.current;if(!current||current.id!==event.pointerId)return;if(!current.moved&&Math.abs(event.clientX-current.start)<5)return;current.moved=true;event.currentTarget.setPointerCapture(event.pointerId);const x=event.clientX-event.currentTarget.getBoundingClientRect().left-4-current.offset;setDragX(Math.max(0,Math.min((count-1)*width,x)));}}
  onPointerUp={e=>end(e)} onPointerCancel={e=>end(e,true)} onLostPointerCapture={()=>{drag.current=null;setDragX(null);}}>
  <span className={styles.pill} aria-hidden="true" style={{width:width||`calc((100% - 8px) / ${count})`,transform:`translate3d(${dragX??index*width}px,0,0)`,transition:dragX===null?undefined:'none'}}/>
  {options.map((option,i)=><button key={option.value} type="button" role="tab" aria-selected={i===index} tabIndex={i===index?0:-1} className={i===index?styles.active:''} onClick={()=>{if(!suppress.current)commit(i);}} onKeyDown={event=>{let next=i;if(event.key==='ArrowRight')next=(i+1)%count;else if(event.key==='ArrowLeft')next=(i+count-1)%count;else if(event.key==='Home')next=0;else if(event.key==='End')next=count-1;else return;event.preventDefault();commit(next);root.current?.querySelectorAll('button')[next]?.focus();}}>{option.label}</button>)}
 </div>;
}
