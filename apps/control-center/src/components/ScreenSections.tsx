import React from 'react';
/** In-page navigation follows rendered sections, including asynchronously loaded panels. */
export function ScreenSections({flow,screen}:{flow:React.RefObject<HTMLDivElement|null>;screen:string}){
 const [sections,setSections]=React.useState<{id:string;label:string;node:HTMLElement}[]>([]),[active,setActive]=React.useState('');
 const prefix=React.useId().replace(/:/g,'');
 React.useEffect(()=>{
  const host=flow.current;if(!host)return;let scheduled=0;
  const collect=()=>{const panels=Array.from(host.querySelectorAll<HTMLElement>('section.panel,article.pulseChartCard,.catalogWorkspace,.mortgageProgram')).filter(panel=>!panel.parentElement?.closest('section.panel,.catalogWorkspace,.mortgageProgram'));const next=panels.flatMap((node,index)=>{const heading=node.querySelector('h2');const label=heading?.textContent?.trim();if(!label)return [];const id=node.id||prefix+'-section-'+index;node.id=id;node.style.scrollMarginTop='120px';return [{id,label:label.length>65?label.slice(0,62)+'…':label,node}]});setSections(current=>current.length===next.length&&current.every((item,index)=>item.id===next[index].id&&item.label===next[index].label&&item.node===next[index].node)?current:next)};
  collect();const observer=new MutationObserver(()=>{cancelAnimationFrame(scheduled);scheduled=requestAnimationFrame(collect)});observer.observe(host,{childList:true,subtree:true,characterData:true});return()=>{observer.disconnect();cancelAnimationFrame(scheduled)};
 },[flow,screen,prefix]);
 React.useEffect(()=>{if(sections.length<3)return;let scheduled=0;const update=()=>{cancelAnimationFrame(scheduled);scheduled=requestAnimationFrame(()=>{let next=sections[0].id;for(const section of sections){if(section.node.getBoundingClientRect().top<=180)next=section.id}setActive(next)})};update();window.addEventListener('scroll',update,{passive:true});return()=>{window.removeEventListener('scroll',update);cancelAnimationFrame(scheduled)}},[sections]);
 if(sections.length<3)return null;
 return <nav className="screenSections" aria-label="Разделы текущего экрана">{sections.map(section=><button type="button" key={section.id} aria-current={active===section.id?'location':undefined} onClick={()=>{section.node.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});setActive(section.id)}}>{section.label}</button>)}</nav>;
}
