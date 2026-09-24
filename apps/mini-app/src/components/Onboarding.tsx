import React from "react";
import { Building2, Check, Heart, MapPin, Search, Sparkles } from "lucide-react";
import styles from "./Onboarding.module.css";

const slides=[
  {
    eyebrow:"Новостройки Приморья",
    title:"Всё важное — в одном месте",
    text:"Проекты, цены, районы и сроки сдачи без десятков вкладок и лишнего шума.",
    scene:"catalog",
  },
  {
    eyebrow:"PULSE Select",
    title:"Короткий подбор вместо длинной анкеты",
    text:"Задайте основу и мягкие приоритеты — PULSE покажет, почему один вариант подходит лучше другого.",
    scene:"select",
  },
  {
    eyebrow:"От выбора к сделке",
    title:"Сохраняйте, сравнивайте, спрашивайте",
    text:"Избранное и связь с PULSE.DV остаются рядом, когда вы готовы перейти к следующему шагу.",
    scene:"deal",
  },
] as const;

export function Onboarding({onDone}:{onDone:()=>void}){
  const [index,setIndex]=React.useState(0);
  const startX=React.useRef<number|null>(null);
  const slide=slides[index];

  const finish=()=>{
    localStorage.setItem("pulse_onboarding_version","7");
    onDone();
  };
  const next=()=>index===slides.length-1?finish():setIndex(value=>value+1);

  return <section
    className={styles.overlay}
    aria-label="Знакомство с PULSE.DV"
    onTouchStart={event=>startX.current=event.touches[0]?.clientX??null}
    onTouchEnd={event=>{
      if(startX.current===null)return;
      const delta=(event.changedTouches[0]?.clientX??startX.current)-startX.current;
      if(delta<-42&&index<slides.length-1)setIndex(value=>value+1);
      if(delta>42&&index>0)setIndex(value=>value-1);
      startX.current=null;
    }}
  >
    <div className={styles.inner}>
      <button className={styles.skip} type="button" onClick={finish}>Пропустить</button>

      <div className={styles.art} data-scene={slide.scene}>
        <div className={styles.artGlow}/>
        {slide.scene==="catalog"&&<>
          <div className={styles.phoneCard}>
            <div className={styles.miniSearch}><Search size={14}/><span>ЖК, район, застройщик</span></div>
            <div className={styles.buildings}><Building2 size={29}/><Building2 size={24}/><Building2 size={20}/></div>
          </div>
          <div className={styles.pin}><MapPin size={17}/></div>
        </>}
        {slide.scene==="select"&&<>
          <div className={styles.selectMark}><Sparkles size={29}/></div>
          <div className={styles.selectStack}>
            <span><Check size={13}/>Бюджет</span>
            <span><Check size={13}/>2 комнаты</span>
            <span><Check size={13}/>Ближе к морю</span>
          </div>
          <div className={styles.match}>92%</div>
        </>}
        {slide.scene==="deal"&&<>
          <div className={styles.dealHouse}><Building2 size={35}/></div>
          <div className={styles.heart}><Heart size={22} fill="currentColor"/></div>
          <div className={styles.message}><span/><span/><span/></div>
        </>}
        <strong className={styles.wordmark}>PULSE.DV</strong>
      </div>

      <div className={styles.copy} key={index}>
        <span>{slide.eyebrow}</span>
        <h1>{slide.title}</h1>
        <p>{slide.text}</p>
      </div>

      <button className={styles.primary} type="button" onClick={next}>{index===slides.length-1?"Начать":"Продолжить"}</button>
      <div className={styles.dots}>{slides.map((_,dot)=><button type="button" key={dot} className={dot===index?styles.dotActive:""} onClick={()=>setIndex(dot)} aria-label={"Экран "+(dot+1)}/>)}</div>
    </div>
  </section>;
}
