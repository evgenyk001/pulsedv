import {useLayoutEffect,useRef} from 'react';

/** Keep the photo still while the sheet covers it, without a fixed/sticky Safari tint candidate. */
export function usePropertyHeroMotion(propertyId:string|undefined){
  const ref=useRef<HTMLElement>(null);
  useLayoutEffect(()=>{
    const hero=ref.current;
    if(!hero)return;
    const native=CSS.supports('animation-timeline','scroll(root block)')&&CSS.supports('animation-range','0px 100px');
    hero.dataset.heroMotion=native?'native':'fallback';
    if(native)return()=>{delete hero.dataset.heroMotion};

    // Older browsers use one compositor transform per frame, without React state updates.
    let frame=0,height=hero.offsetHeight,last=-1;
    const paint=()=>{
      frame=0;
      const y=Math.min(Math.max(window.scrollY,0),height);
      if(y===last)return;
      last=y;
      hero.style.transform=`translate3d(0,${y}px,0)`;
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(paint)};
    const observer=new ResizeObserver(()=>{height=hero.offsetHeight;schedule()});
    observer.observe(hero);
    window.addEventListener('scroll',schedule,{passive:true});
    paint();
    return()=>{
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll',schedule);
      hero.style.removeProperty('transform');
      delete hero.dataset.heroMotion;
    };
  },[propertyId]);
  return ref;
}
