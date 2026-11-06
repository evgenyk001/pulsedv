import React from 'react';
import {giveawayCountdown} from '../../../../packages/giveaway';
export function GiveawayCountdown({deadline,serverNow,observedAt}:{deadline:string;serverNow:string;observedAt?:number}){
 const anchor=React.useRef({server:Date.parse(serverNow),local:observedAt??performance.now()});
 const [now,setNow]=React.useState(()=>Date.parse(serverNow));
 React.useEffect(()=>{anchor.current={server:Date.parse(serverNow),local:observedAt??performance.now()};const tick=()=>setNow(anchor.current.server+performance.now()-anchor.current.local);tick();const timer=window.setInterval(tick,1000);const resume=()=>{if(!document.hidden)tick()};document.addEventListener('visibilitychange',resume);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',resume)}},[serverNow,observedAt]);
 const remaining=giveawayCountdown(deadline,now);
 return <span className="giveawayCountdown" aria-label="Обратный отсчёт">{Object.entries(remaining).map(([key,value],index)=><span key={key}><b>{String(value).padStart(2,'0')}</b><small>{['дней','часов','минут','секунд'][index]}</small></span>)}</span>;
}
