import React from "react";
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
  const finish=()=>{const version=getPulseState().content.onboardingVersion;localStorage.setItem("pulse_onboarding_version",version);recordPulseEvent({eventType:"onboarding_complete",entityType:"onboarding",entityId:version});onDone()};
  const next=()=>index===slides.length-1?finish():setIndex(index+1);

  React.useEffect(()=>{
    if(loaded!==slides[index]||!slides[index+1])return;
    const image=new Image();
    image.decoding="async";
    image.fetchPriority="low";
    image.src=slides[index+1];
  },[index,loaded]);

  return <section
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
      <img className={styles.screen} src={slides[index]} alt="" draggable={false} fetchPriority="high" loading="eager" decoding="async" width={941} height={1672} onLoad={e=>setLoaded(e.currentTarget.getAttribute('src'))}/>
      <button type="button" className={styles.skipHotspot} onClick={finish} aria-label="Пропустить онбординг"/>
      <button type="button" className={styles.primaryHotspot} onClick={next} aria-label={index===0?"Продолжить":"Начать"}/>
      <div className={styles.dotHotspots} aria-label="Страницы онбординга">
        {slides.map((_,i)=><button key={i} type="button" onClick={()=>setIndex(i)} aria-label={"Экран "+(i+1)}/>)}
      </div>
    </div>
  </section>;
}
