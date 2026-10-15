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
    let frame=0,top=0,barBottom=0;
    let blocks:{element:HTMLElement;top:number;height:number}[]=[];
    const paint=()=>{
      frame=0;
      const scroll=Math.max(0,window.scrollY);
      bar.style.setProperty('--header-progress',String(clamp(scroll/80)));
      content.style.setProperty('--intro-clip',`${Math.max(-12,scroll+barBottom+12-top)}px`);
      for(const block of blocks){
        const progress=clamp((scroll+barBottom+12-block.top)/block.height);
        // Reduced motion keeps ordinary scrolling and the pinned header, without scaling/fading.
        block.element.style.setProperty('--collapse-progress',String(motion.matches?0:progress));
        block.element.inert=progress===1&&!block.element.contains(document.activeElement);
      }
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(paint)};
    const measure=()=>{
      top=content.getBoundingClientRect().top+window.scrollY;
      barBottom=bar.getBoundingClientRect().bottom;
      blocks=Array.from(content.querySelectorAll<HTMLElement>('[data-home-collapse]')).map(element=>({
        element,top:element.getBoundingClientRect().top+window.scrollY,height:Math.max(1,element.offsetHeight),
      }));
      schedule();
    };
    measure();
    const observer=new ResizeObserver(measure);
    observer.observe(content);
    window.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',measure);
    window.visualViewport?.addEventListener('resize',measure);
    motion.addEventListener('change',schedule);
    return()=>{
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll',schedule);
      window.removeEventListener('resize',measure);
      window.visualViewport?.removeEventListener('resize',measure);
      motion.removeEventListener('change',schedule);
    };
  },[]);
  return {intro,header};
}
