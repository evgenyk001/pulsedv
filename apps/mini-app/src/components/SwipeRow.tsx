import React from 'react';
import {MoreHorizontal} from 'lucide-react';
import styles from './SwipeRow.module.css';
type Action={label:string;icon:React.ReactNode;danger?:boolean;run:()=>void|Promise<unknown>};
type Gesture={id:number;x:number;y:number;start:number;horizontal:boolean;vertical:boolean;armed:boolean};
const reducedMotion=()=>window.matchMedia('(prefers-reduced-motion:reduce)').matches;
export function SwipeRow({id,label,children,actions,fullSwipe=false}:{id:string;label:string;children:React.ReactNode;actions:Action[];fullSwipe?:boolean}){
 const [open,setOpen]=React.useState(false),[offset,setOffset]=React.useState(0),[dragging,setDragging]=React.useState(false),[settling,setSettling]=React.useState(false),[armed,setArmed]=React.useState(false),[busy,setBusy]=React.useState(false),[failed,setFailed]=React.useState(false);
 const root=React.useRef<HTMLDivElement>(null),gesture=React.useRef<Gesture|null>(null),swiped=React.useRef(false),position=React.useRef(0),locked=React.useRef(false),settleTimer=React.useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const width=actions.length*76;
 const reveal=React.useCallback((value:boolean)=>{
  clearTimeout(settleTimer.current);setSettling(true);setOpen(value);setArmed(false);
  position.current=value?-width:0;setOffset(position.current);
  settleTimer.current=setTimeout(()=>setSettling(false),reducedMotion()?0:420);
  if(value)window.dispatchEvent(new CustomEvent('pulse:swipe-open',{detail:id}));
 },[id,width]);
 React.useEffect(()=>()=>clearTimeout(settleTimer.current),[]);
 React.useEffect(()=>{
  const close=(event:Event)=>{if((event as CustomEvent).detail!==id&&!locked.current&&(position.current!==0||gesture.current)){gesture.current=null;setDragging(false);reveal(false)}};
  window.addEventListener('pulse:swipe-open',close);return()=>window.removeEventListener('pulse:swipe-open',close);
 },[id,reveal]);
 const perform=async(action:Action)=>{
  if(locked.current)return;locked.current=true;setBusy(true);setFailed(false);setArmed(false);
  try{
   if(fullSwipe){
    setSettling(true);position.current=-(root.current?.clientWidth??320);setOffset(position.current);
    if(!reducedMotion())await new Promise(resolve=>setTimeout(resolve,180));
   }
   await action.run();reveal(false);
  }catch{setFailed(true);reveal(true)}finally{locked.current=false;setBusy(false)}
 };
 const threshold=()=>Math.max((root.current?.clientWidth??320)*.56,width*1.35);
 const finish=(pointerId:number,cancelled=false)=>{
  const g=gesture.current;if(!g||g.id!==pointerId)return;gesture.current=null;setDragging(false);setArmed(false);
  if(cancelled||!g.horizontal){reveal(open);return}
  if(fullSwipe&&-position.current>=threshold()){void perform(actions[0]);return}
  reveal(position.current<-(open?width*.7:width*.35));
 };
 const exposed=Math.max(0,-offset),progress=Math.min(1,exposed/width);
 return <div ref={root} className={styles.row} data-swipe-row={id} data-open={open||undefined} data-dragging={dragging||undefined} data-revealed={open||dragging||settling||busy||undefined} data-armed={armed||undefined} data-busy={busy||undefined} style={{'--swipe-progress':progress,'--swipe-fill':actions[0]?.danger?'var(--primary,#f00920)':'#69758b'} as React.CSSProperties}>
  <div className={styles.actions} aria-hidden={!open&&!dragging}>
   <div className={styles.buttons} style={{width:exposed,transition:dragging||!settling?'none':undefined}}>{actions.map(action=><button key={action.label} type="button" className={action.danger?styles.danger:styles.action} tabIndex={open?0:-1} aria-label={action.label+' — '+label} disabled={busy} onClick={()=>void perform(action)}>{action.icon}<span>{action.label}</span></button>)}</div>
  </div>
  <div className={styles.content} style={{transform:`translateX(${offset}px)`,transition:dragging||!settling?'none':undefined}} onDragStart={e=>e.preventDefault()} onPointerDown={e=>{
   if(locked.current||e.button!==0||!e.isPrimary||(e.target as Element).closest('[data-swipe-toggle]'))return;
   // Grabbing a spring mid-flight starts at its visible position, not its destination.
   if(settling){
    try{position.current=new DOMMatrixReadOnly(getComputedStyle(e.currentTarget).transform).m41}catch{/* Use the last tracked position. */}
    clearTimeout(settleTimer.current);setSettling(false);setOffset(position.current);
   }
   gesture.current={id:e.pointerId,x:e.clientX,y:e.clientY,start:position.current,horizontal:false,vertical:false,armed:false};swiped.current=false;
  }} onPointerMove={e=>{
   const g=gesture.current;if(!g||g.id!==e.pointerId||g.vertical)return;
   const dx=e.clientX-g.x,dy=e.clientY-g.y;
   if(!g.horizontal){
    if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){g.vertical=true;return}
    if(Math.abs(dx)<10||Math.abs(dx)<Math.abs(dy)*1.3)return;
    g.horizontal=true;swiped.current=true;setDragging(true);clearTimeout(settleTimer.current);
    e.currentTarget.setPointerCapture(e.pointerId);window.dispatchEvent(new CustomEvent('pulse:swipe-open',{detail:id}));
   }
   e.stopPropagation();
   const distance=Math.max(0,-(g.start+dx)),limit=fullSwipe?(root.current?.clientWidth??320):width;
   // Direct tracking until the actions are open, then progressively resist over-pull.
   const stretch=distance>limit?limit+28*(1-Math.exp(-(distance-limit)/80)):distance;
   position.current=-stretch;setOffset(position.current);
   const nextArmed=fullSwipe&&stretch>=threshold();
   if(nextArmed!==g.armed){g.armed=nextArmed;setArmed(nextArmed);if(nextArmed)try{window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light')}catch{/* Haptics are optional. */}}
  }} onPointerUp={e=>finish(e.pointerId)} onPointerCancel={e=>finish(e.pointerId,true)} onLostPointerCapture={e=>{if(e.target===e.currentTarget&&gesture.current)finish(e.pointerId,true)}} onClickCapture={e=>{
   if(swiped.current){e.preventDefault();e.stopPropagation();swiped.current=false}
   else if(open&&!(e.target as Element).closest('[data-swipe-toggle]')){e.preventDefault();e.stopPropagation();reveal(false)}
  }} onKeyDown={e=>{if(e.key==='Escape'){reveal(false);root.current?.querySelector<HTMLButtonElement>('[data-swipe-toggle]')?.focus()}}}>
   {children}<button data-swipe-toggle className={styles.toggle} type="button" aria-label={'Действия — '+label} aria-expanded={open} disabled={busy} onClick={()=>reveal(!open)}><MoreHorizontal size={18}/></button>
  </div>{failed&&<small role="alert" className={styles.error}>Не удалось сохранить. Попробуйте ещё раз.</small>}
 </div>;
}
