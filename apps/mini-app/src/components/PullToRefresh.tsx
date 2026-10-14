import React from 'react';
import {RefreshCw} from 'lucide-react';
import styles from './PullToRefresh.module.css';
export function PullToRefresh({children,onRefresh,className}:{children:React.ReactNode;onRefresh:()=>Promise<unknown>;className?:string}){
 const root=React.useRef<HTMLDivElement>(null),callback=React.useRef(onRefresh),busy=React.useRef(false);
 callback.current=onRefresh;
 const [distance,setDistance]=React.useState(0),[loading,setLoading]=React.useState(false),[failed,setFailed]=React.useState(false);
 React.useEffect(()=>{
  const node=root.current;if(!node)return;let start:{x:number;y:number}|null=null,pulled=0;
  const reset=()=>{start=null;pulled=0;if(!busy.current)setDistance(0)};
  const down=(e:TouchEvent)=>{const target=e.target as Element;if(busy.current||e.touches.length!==1||(document.scrollingElement?.scrollTop||0)>1||document.querySelector('[role=dialog]')||target.closest('input,textarea,select,[data-no-pull-refresh]'))return;start={x:e.touches[0].clientX,y:e.touches[0].clientY};pulled=0};
  const move=(e:TouchEvent)=>{if(!start||busy.current)return;if(e.touches.length!==1){reset();return}const dy=e.touches[0].clientY-start.y,dx=e.touches[0].clientX-start.x;if(dy<=0||Math.abs(dx)>Math.abs(dy)){reset();return}if(dy<10)return;if(e.cancelable)e.preventDefault();pulled=Math.min(72,dy*.5);setDistance(pulled)};
  const up=(e:TouchEvent)=>{if(!start)return;start=null;if(pulled<56){reset();return}if(e.cancelable)e.preventDefault();busy.current=true;setLoading(true);setFailed(false);setDistance(56);void Promise.resolve().then(()=>callback.current()).catch(()=>setFailed(true)).finally(()=>{busy.current=false;setLoading(false);setDistance(0);pulled=0})};
  node.addEventListener('touchstart',down,{passive:true});node.addEventListener('touchmove',move,{passive:false});node.addEventListener('touchend',up,{passive:false});node.addEventListener('touchcancel',reset,{passive:true});
  return()=>{node.removeEventListener('touchstart',down);node.removeEventListener('touchmove',move);node.removeEventListener('touchend',up);node.removeEventListener('touchcancel',reset)};
 },[]);
 return <div ref={root} className={[className,styles.root].filter(Boolean).join(' ')} style={{'--pull-distance':distance+'px'} as React.CSSProperties} data-refreshing={loading}>
  <div className={styles.indicator} aria-hidden={!distance} role="status"><RefreshCw size={17} className={loading?styles.spin:''} style={!loading?{transform:`rotate(${distance*4}deg)`}:undefined}/><span>{loading?'Обновляем…':distance>=56?'Отпустите для обновления':'Потяните вниз'}</span></div>
  {failed&&<p className={styles.error} role="alert">Не удалось обновить. Повторите жест или нажмите кнопку обновления.</p>}{children}
 </div>;
}
