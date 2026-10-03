import React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { recordPulseEvent } from "../../../../packages/pulse-data";
import { mortgageStoryAsset1 } from "./mortgageStoryAsset1";
import { mortgageStoryAsset2 } from "./mortgageStoryAsset2";
import { mortgageStoryAsset3 } from "./mortgageStoryAsset3";
import styles from "./MortgageStoryOnboarding.module.css";

export const MORTGAGE_STORY_VERSION="mortgage_intro_v1";
export const MORTGAGE_STORY_STORAGE="pulse_mortgage_intro_version";

type Slide={
  eyebrow:string;
  title:string;
  body:string;
  image:string;
};

const slides:Slide[]=[
  {
    eyebrow:"PULSE · ИПОТЕКА",
    title:"Ипотека без хаоса",
    body:"Считайте платёж, сравнивайте программы и сразу понимайте, какой сценарий подходит клиенту.",
    image:mortgageStoryAsset1,
  },
  {
    eyebrow:"ВСЁ В ОДНОМ МЕСТЕ",
    title:"Актуальные программы",
    body:"Семейная, Дальневосточная, IT и базовый сценарий собраны в одном разделе — с понятными условиями и ограничениями.",
    image:mortgageStoryAsset2,
  },
  {
    eyebrow:"ЖИВОЙ РАСЧЁТ",
    title:"Меняйте параметры — результат сразу",
    body:"Стоимость, первоначальный взнос и срок влияют на платёж в реальном времени. PULSE показывает ставку, лимиты и ограничения программы.",
    image:mortgageStoryAsset3,
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
      ><X size={18}/></button>

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

      <div key={index} className={styles.slide}>
        <div className={styles.art}>
          <img className={styles.artImage} src={slide.image} alt="" draggable={false}/>
        </div>
        <div className={styles.copy}>
          <span className={styles.eyebrow}>{slide.eyebrow}</span>
          <h2>{slide.title}</h2>
          <p>{slide.body}</p>
        </div>
      </div>
    </div>
  </section>;

  return createPortal(story,document.body);
}

// CI probe: validate mortgage story onboarding v2.
