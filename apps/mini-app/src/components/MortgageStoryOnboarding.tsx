import React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { recordPulseEvent } from "../../../../packages/pulse-data";
import styles from "./MortgageStoryOnboarding.module.css";

export const MORTGAGE_STORY_VERSION="mortgage_intro_v3";
export const MORTGAGE_STORY_STORAGE="pulse_mortgage_intro_version";

const BASE_URL=(import.meta.env.BASE_URL||"/").replace(/\/$/,"");
const asset=(path:string)=>`${BASE_URL}${path}`;

type Slide={
  image:string;
  alt:string;
};

const slides:Slide[]=[
  {
    image:asset("/_cdn/static/mortgage-onboarding-01.png"),
    alt:"Ипотека без хаоса — расчёт и сравнение ипотечных сценариев в PULSE.DV",
  },
  {
    image:asset("/_cdn/static/mortgage-onboarding-02.png"),
    alt:"Актуальные ипотечные программы в одном разделе PULSE.DV",
  },
  {
    image:asset("/_cdn/static/mortgage-onboarding-03.png"),
    alt:"Живой ипотечный расчёт с изменением стоимости, взноса и срока",
  },
];

export function MortgageStoryOnboarding({onDone}:{onDone:()=>void}){
  const [index,setIndex]=React.useState(0);
  const [paused,setPaused]=React.useState(false);
  const [cycle,setCycle]=React.useState(0);
  const press=React.useRef<{x:number;at:number}|null>(null);
  const slide=slides[index];

  const finish=React.useCallback((eventType:"mortgage_intro_complete"|"mortgage_intro_skip")=>{
    try{localStorage.setItem(MORTGAGE_STORY_STORAGE,MORTGAGE_STORY_VERSION)}catch{}
    recordPulseEvent({eventType,entityType:"onboarding",entityId:MORTGAGE_STORY_VERSION});
    onDone();
  },[onDone]);

  const goTo=React.useCallback((nextIndex:number)=>{
    const safe=Math.max(0,Math.min(slides.length-1,nextIndex));
    if(safe===index){setCycle(value=>value+1);return}
    setIndex(safe);
    setCycle(value=>value+1);
    recordPulseEvent({eventType:"mortgage_intro_slide",entityType:"onboarding",entityId:String(safe+1)});
  },[index]);

  const next=React.useCallback(()=>{
    if(index===slides.length-1){finish("mortgage_intro_complete");return}
    goTo(index+1);
  },[finish,goTo,index]);

  const previous=React.useCallback(()=>{if(index>0)goTo(index-1)},[goTo,index]);

  React.useEffect(()=>{
    slides.forEach(({image})=>{
      const preload=new Image();
      preload.src=image;
    });
  },[]);

  React.useEffect(()=>{
    recordPulseEvent({eventType:"mortgage_intro_open",entityType:"onboarding",entityId:MORTGAGE_STORY_VERSION});
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    window.dispatchEvent(new CustomEvent("pulse:story-overlay",{detail:{open:true}}));
    return()=>{
      document.body.style.overflow=previousOverflow;
      window.dispatchEvent(new CustomEvent("pulse:story-overlay",{detail:{open:false}}));
    };
  },[]);

  const pointerDown=(event:React.PointerEvent<HTMLButtonElement>)=>{
    press.current={x:event.clientX,at:performance.now()};
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setPaused(true);
  };

  const pointerUp=(side:"left"|"right")=>(event:React.PointerEvent<HTMLButtonElement>)=>{
    const start=press.current;
    press.current=null;
    setPaused(false);
    if(!start)return;
    const delta=event.clientX-start.x;
    const held=performance.now()-start.at;
    if(Math.abs(delta)>42){delta<0?next():previous();return}
    if(held<280){side==="right"?next():previous()}
  };

  const story=<section className={styles.overlay} aria-label="Знакомство с ипотекой">
    <div className={styles.stage}>
      <img
        key={index}
        className={styles.screen}
        src={slide.image}
        alt={slide.alt}
        draggable={false}
        fetchPriority="high"
      />

      <div className={styles.progress} aria-label={"Экран "+(index+1)+" из "+slides.length}>
        {slides.map((_,i)=><span key={i} className={i<index?styles.progressDone:i===index?styles.progressCurrent:styles.progressFuture}>
          {i===index&&<i
            key={index+"-"+cycle}
            style={{animationPlayState:paused?"paused":"running"}}
            onAnimationEnd={next}
          />}
        </span>)}
      </div>

      <button
        className={styles.close}
        type="button"
        aria-label="Закрыть знакомство с ипотекой"
        onClick={()=>finish("mortgage_intro_skip")}
      ><X size={18} strokeWidth={1.9}/></button>

      <button
        type="button"
        className={`${styles.tapZone} ${styles.tapLeft}`}
        aria-label="Предыдущая история"
        onPointerDown={pointerDown}
        onPointerUp={pointerUp("left")}
        onPointerCancel={()=>{press.current=null;setPaused(false)}}
      />
      <button
        type="button"
        className={`${styles.tapZone} ${styles.tapRight}`}
        aria-label="Следующая история"
        onPointerDown={pointerDown}
        onPointerUp={pointerUp("right")}
        onPointerCancel={()=>{press.current=null;setPaused(false)}}
      />
    </div>
  </section>;

  return createPortal(story,document.body);
}
