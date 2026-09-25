import React from "react";
import styles from "./Onboarding.module.css";

const slides=[
  "/_cdn/static/fbe56ba1-f7be-4c7e-a604-dd6a20ae71c8-onboarding-final-01.png",
  "/_cdn/static/ef1a2854-7dc1-45d9-8e6d-6a7de5a9ffa3-onboarding-final-02.png"
];

export function Onboarding({onDone}:{onDone:()=>void}){
  const [index,setIndex]=React.useState(0);
  const startX=React.useRef<number|null>(null);
  const finish=()=>{localStorage.setItem("pulse_onboarding_version","6");onDone()};
  const next=()=>index===slides.length-1?finish():setIndex(index+1);

  React.useEffect(()=>{
    slides.forEach(src=>{
      const image=new Image();
      image.src=src;
    });
  },[]);

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
      <img className={styles.screen} src={slides[index]} alt="" draggable={false} fetchPriority="high"/>
      <button type="button" className={styles.skipHotspot} onClick={finish} aria-label="Пропустить онбординг"/>
      <button type="button" className={styles.primaryHotspot} onClick={next} aria-label={index===0?"Продолжить":"Начать"}/>
      <div className={styles.dotHotspots} aria-label="Страницы онбординга">
        {slides.map((_,i)=><button key={i} type="button" onClick={()=>setIndex(i)} aria-label={"Экран "+(i+1)}/>)}
      </div>
    </div>
  </section>;
}