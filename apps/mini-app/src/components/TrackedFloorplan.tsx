import React from 'react';
import type { PulseProperty } from '../../../../packages/pulse-data/model';
import { recordPulseEvent } from '../../../../packages/pulse-data';
/** Count a plan only after it is substantially visible in an active tab for one second. */
export function TrackedFloorplan({property,plan,children,className}:{property:PulseProperty;plan:PulseProperty['floorplans'][number];children:React.ReactNode;className:string}){
 const ref=React.useRef<HTMLElement>(null);
 React.useEffect(()=>{
  const node=ref.current;if(!node||typeof IntersectionObserver==='undefined')return;
  let visible=false,recorded=false;let timer:ReturnType<typeof setTimeout>|undefined;
  const update=()=>{
   clearTimeout(timer);
   if(!visible||document.hidden||recorded)return;
   timer=setTimeout(()=>{if(document.hidden||!visible||recorded)return;recorded=true;recordPulseEvent({eventType:'floorplan_view',entityType:'property',entityId:property.id,metadata:{propertyName:property.name,city:property.city,floorplanId:plan.id||null,rooms:plan.roomLabel,price:plan.priceFrom===null?null:Math.round(plan.priceFrom*1_000_000),areaFrom:plan.areaFrom,areaTo:plan.areaTo}})},1000);
  };
  const observer=new IntersectionObserver(entries=>{visible=entries.some(e=>e.isIntersecting&&e.intersectionRatio>=.6);update()},{threshold:[0,.6]});
  observer.observe(node);document.addEventListener('visibilitychange',update);
  return()=>{observer.disconnect();clearTimeout(timer);document.removeEventListener('visibilitychange',update)};
 },[property.id,plan.id,plan.roomLabel]);
 return <article ref={ref} className={className}>{children}</article>;
}
