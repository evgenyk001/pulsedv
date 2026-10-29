import React from 'react';
import {MoreHorizontal} from 'lucide-react';
import styles from './SwipeRow.module.css';
type Action={label:string;icon:React.ReactNode;danger?:boolean;run:()=>void|Promise<unknown>};
export function SwipeRow({id,label,children,actions,fullSwipe=false}:{id:string;label:string;children:React.ReactNode;actions:Action[];fullSwipe?:boolean}){
 const [open,setOpen]=React.useState(false),[offset,setOffset]=React.useState(0),[dragging,setDragging]=React.useState(false),[busy,setBusy]=React.useState(false),[failed,setFailed]=React.useState(false);
 const root=React.useRef<HTMLDivElement>(null),gesture=React.useRef<{id:number;x:number;y:number;start:number;horizontal:boolean;vertical:boolean}|null>(null),swiped=React.useRef(false),position=React.useRef(0);
 const width=actions.length*76;
 const reveal=(value:boolean)=>{setOpen(value);position.current=value?-width:0;setOffset(position.current);if(value)window.dispatchEvent(new CustomEvent('pulse:swipe-open',{detail:id}))};
 React.useEffect(()=>{const close=(event:Event)=>{if((event as CustomEvent).detail!==id){setOpen(false);position.current=0;setOffset(0)}};window.addEventListener('pulse:swipe-open',close);return()=>window.removeEventListener('pulse:swipe-open',close)},[id]);
 const perform=async(action:Action)=>{if(busy)return;setBusy(true);setFailed(false);try{await action.run();reveal(false)}catch{setFailed(true);reveal(true)}finally{setBusy(false)}};
 const finish=(cancelled=false)=>{const g=gesture.current;if(!g)return;gesture.current=null;setDragging(false);if(cancelled){reveal(open);return}if(!g.horizontal)return;
  if(fullSwipe&&position.current<-(root.current?.clientWidth??320)*.5){void perform(actions[0]);return}reveal(position.current<-(open?width*.7:width*.35));
 };
 return <div ref={root} className={styles.row} data-swipe-row={id} data-open={open||undefined} data-dragging={dragging||undefined}>
  <div className={styles.actions} style={{width}} aria-hidden={!open&&!dragging}>{actions.map(action=><button key={action.label} type="button" className={action.danger?styles.danger:styles.action} tabIndex={open?0:-1} aria-label={action.label+' — '+label} disabled={busy} onClick={()=>void perform(action)}>{action.icon}<span>{action.label}</span></button>)}</div>
  <div className={styles.content} style={{transform:`translateX(${offset}px)`,transition:dragging?'none':undefined}} onDragStart={e=>e.preventDefault()} onPointerDown={e=>{if(busy||e.button!==0||(e.target as HTMLElement).closest('[data-swipe-toggle]'))return;gesture.current={id:e.pointerId,x:e.clientX,y:e.clientY,start:open?-width:0,horizontal:false,vertical:false};swiped.current=false}}
   onPointerMove={e=>{const g=gesture.current;if(!g||g.id!==e.pointerId||g.vertical)return;const dx=e.clientX-g.x,dy=e.clientY-g.y;if(!g.horizontal){if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){g.vertical=true;return}if(Math.abs(dx)<10||Math.abs(dx)<Math.abs(dy)*1.3)return;g.horizontal=true;swiped.current=true;setDragging(true);e.currentTarget.setPointerCapture(e.pointerId);window.dispatchEvent(new CustomEvent('pulse:swipe-open',{detail:id}))}e.stopPropagation();position.current=Math.min(0,Math.max(-(fullSwipe?(root.current?.clientWidth??width):width),g.start+dx));setOffset(position.current)}}
   onPointerUp={()=>finish()} onPointerCancel={()=>finish(true)} onLostPointerCapture={e=>{if(e.target===e.currentTarget&&gesture.current)finish(true)}} onClickCapture={e=>{if(swiped.current){e.preventDefault();e.stopPropagation();swiped.current=false}else if(open&&!(e.target as Element).closest('[data-swipe-toggle]')){e.preventDefault();e.stopPropagation();reveal(false)}}} onKeyDown={e=>{if(e.key==='Escape'){reveal(false);root.current?.querySelector<HTMLButtonElement>('[data-swipe-toggle]')?.focus()}}}>
   {children}<button data-swipe-toggle className={styles.toggle} type="button" aria-label={'Действия — '+label} aria-expanded={open} disabled={busy} onClick={()=>reveal(!open)}><MoreHorizontal size={18}/></button>
  </div>{failed&&<small role="alert" className={styles.error}>Не удалось сохранить. Попробуйте ещё раз.</small>}
 </div>;
}
