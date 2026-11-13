import {safeLocalStorage} from '../../../../packages/browser/storage';
import React from "react";
import {createPortal} from "react-dom";
import {isPwa} from "../pwa/client";
import {ArrowRight} from "lucide-react";
import { getPulseState, recordPulseEvent } from "../../../../packages/pulse-data";
import styles from "./Onboarding.module.css";

const asset=(path:string)=>`${import.meta.env.BASE_URL}${path.startsWith("/")?path.slice(1):path}`;
const slides=[
  asset("/_cdn/static/fbe56ba1-f7be-4c7e-a604-dd6a20ae71c8-onboarding-final-01.webp"),
  asset("/_cdn/static/ef1a2854-7dc1-45d9-8e6d-6a7de5a9ffa3-onboarding-final-02.webp")
];

export function Onboarding({onDone}:{onDone:()=>void}){
  const [index,setIndex]=React.useState(0);
  const [loaded,setLoaded]=React.useState<string|null>(null);
  const startX=React.useRef<number|null>(null);
  const finish=()=>{const version=getPulseState().content.onboardingVersion;safeLocalStorage.setItem("pulse_onboarding_version",version);recordPulseEvent({eventType:"onboarding_complete",entityType:"onboarding",entityId:version});onDone()};
  const next=()=>index===slides.length-1?finish():setIndex(index+1);

  React.useEffect(()=>{
    if(loaded!==slides[index]||!slides[index+1])return;
    const image=new Image();
    image.decoding="async";
    image.fetchPriority="low";
    image.src=slides[index+1];
  },[index,loaded]);

  React.useLayoutEffect(()=>{
    if(!isPwa)return;
    const root=document.documentElement;
    const theme=document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previous=theme?.content;
    const viewport=window.visualViewport;
    const syncViewport=()=>{
      const height=viewport?.height||window.innerHeight;
      root.style.setProperty("--onboarding-viewport-height",`${height}px`);
    };
    syncViewport();
    viewport?.addEventListener("resize",syncViewport);
    window.addEventListener("resize",syncViewport);
    root.classList.add(styles.onboardingOpen);
    if(theme)theme.content="#ffffff";
    return ()=>{
      viewport?.removeEventListener("resize",syncViewport);
      window.removeEventListener("resize",syncViewport);
      root.style.removeProperty("--onboarding-viewport-height");
      root.classList.remove(styles.onboardingOpen);
      if(theme&&previous!==undefined)theme.content=previous;
    };
  },[]);

  const skip=<button type="button" className={styles.skip} onClick={finish} aria-label="Пропустить онбординг"><span>Пропустить</span></button>;
  const footer=<div className={styles.footer}>
       <button type="button" className={styles.primary} onClick={next}><span>{index===0?"Продолжить":"Начать"}</span><ArrowRight aria-hidden="true" size={22} strokeWidth={1.8}/></button>
       <div className={styles.pagination} role="group" aria-label="Страницы онбординга">
        <span className={styles.activePill} style={{transform:`translateX(${index*32}px)`}} aria-hidden="true"/>
        {slides.map((_,i)=><button key={i} type="button" onClick={()=>setIndex(i)} aria-label={"Экран "+(i+1)} aria-current={i===index?"step":undefined}><span/></button>)}
       </div>
      </div>;

  const overlay=<section
    className={styles.overlay}
    aria-label="Онбординг PULSEDV"
    onTouchStart={e=>startX.current=e.touches[0]?.clientX??null}
    onTouchEnd={e=>{
      if(startX.current===null)return;
      const delta=(e.changedTouches[0]?.clientX??startX.current)-startX.current;
      if(delta<-42&&index<slides.length-1)setIndex(index+1);
      if(delta>42&&index>0)setIndex(index-1);
      startX.current=null;
    }}
  >
    <div className={styles.stage}>
     {isPwa&&<div className={styles.topControls}>{skip}</div>}
     <div className={styles.canvas}>
      <img className={styles.screen} src={slides[index]} alt="" draggable={false} fetchPriority="high" loading="eager" decoding="async" width={941} height={1672} onLoad={e=>setLoaded(e.currentTarget.getAttribute('src'))}/>
      {/* Artwork stays intact; cover its baked-in controls with a shared UI layer. */}
      <div className={styles.skipCover}>{!isPwa&&skip}</div>
      {!isPwa&&footer}
     </div>
     {isPwa&&footer}
    </div>
  </section>;
  return isPwa?createPortal(overlay,document.body):overlay;
}
