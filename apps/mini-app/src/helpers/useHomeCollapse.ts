import React from 'react';

const clamp=(value:number)=>Math.max(0,Math.min(1,value));

/** Stable document geometry: only paint changes while the native page scrolls. */
export function useHomeCollapse(){
  const intro=React.useRef<HTMLDivElement>(null);
  const header=React.useRef<HTMLElement>(null);

  React.useLayoutEffect(()=>{
    const content=intro.current,bar=header.current;
    if(!content||!bar)return;
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame=0;
    const paint=()=>{
      frame=0;
      const scroll=Math.max(0,window.scrollY);
      // Read untransformed wrappers together, before writing their children's paint styles.
      // Fresh rectangles also cover Safari layout changes when a sheet or keyboard closes.
      const barBottom=bar.getBoundingClientRect().bottom;
      const clip=Math.max(-12,barBottom+12-content.getBoundingClientRect().top);
      const blocks=Array.from(content.querySelectorAll<HTMLElement>('[data-home-collapse]')).map(element=>{
        const rect=element.getBoundingClientRect();
        return {element,progress:clamp((barBottom+12-rect.top)/Math.max(1,rect.height))};
      });
      bar.style.setProperty('--header-progress',String(clamp(scroll/80)));
      content.style.setProperty('--intro-clip',`${clip}px`);
      for(const {element,progress} of blocks){
        const visual=element.firstElementChild as HTMLElement|null;
        if(visual){
          // Write directly to the composited child so WebKit restores its layer on reverse scroll.
          visual.style.transform=motion.matches?'none':`scale(${1-progress*.18})`;
          visual.style.opacity=String(motion.matches?1:1-progress);
        }
        element.inert=progress===1&&!element.contains(document.activeElement);
      }
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(paint)};
    schedule();
    const observer=new ResizeObserver(schedule);
    observer.observe(content);
    window.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',schedule);
    window.addEventListener('focusin',schedule);
    window.visualViewport?.addEventListener('resize',schedule);
    motion.addEventListener('change',schedule);
    return()=>{
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll',schedule);
      window.removeEventListener('resize',schedule);
      window.removeEventListener('focusin',schedule);
      window.visualViewport?.removeEventListener('resize',schedule);
      motion.removeEventListener('change',schedule);
    };
  },[]);
  return {intro,header};
}
