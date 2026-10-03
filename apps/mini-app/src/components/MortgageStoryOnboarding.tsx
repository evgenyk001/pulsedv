import React from "react";
import { ArrowRight, Check, X } from "lucide-react";
import { recordPulseEvent } from "../../../../packages/pulse-data";
import styles from "./MortgageStoryOnboarding.module.css";

export const MORTGAGE_STORY_VERSION="mortgage_intro_v1";
export const MORTGAGE_STORY_STORAGE="pulse_mortgage_intro_version";

type Slide={
  eyebrow:string;
  title:string;
  body:string;
  art:React.ReactNode;
};

function MortgageHouseArt(){
  return <div className={styles.houseScene} aria-hidden="true">
    <div className={styles.sceneGlow}/>
    <svg className={styles.houseDrawing} viewBox="0 0 360 300" fill="none">
      <path d="M88 161.5 180 84l92 77.5" className={styles.sketchStrong}/>
      <path d="M111 149v91h138v-91" className={styles.sketchStrong}/>
      <path d="M146 240v-56h68v56M133 166h31v30h-31zm63 0h31v30h-31z" className={styles.sketch}/>
      <path d="M74 246c54 11 158 11 213-2" className={styles.sketchFaint}/>
      <path d="M249 108c21 9 34 22 42 39" className={styles.redSketch}/>
      <path d="m286 135 5 12-13-2" className={styles.redSketch}/>
    </svg>
    <div className={styles.rateCard}><small>Семейная</small><strong>от 6%</strong><span><Check size={11}/> сценарий готов</span></div>
    <div className={styles.paymentCard}><small>Платёж</small><strong>52 840 ₽</strong><span>в месяц</span></div>
    <div className={styles.sceneCaption}>Один расчёт вместо таблиц и заметок</div>
  </div>;
}

function MortgageProgramsArt(){
  return <div className={styles.programScene} aria-hidden="true">
    <div className={styles.programHalo}/>
    <div className={`${styles.programCard} ${styles.programBack}`}>
      <div><span>IT</span><b>от 6%</b></div><small>Льготный сценарий</small>
    </div>
    <div className={`${styles.programCard} ${styles.programMiddle}`}>
      <div><span>Дальневосточная</span><b>от 2%</b></div><small>Приморский край</small>
    </div>
    <div className={`${styles.programCard} ${styles.programFront}`}>
      <div><span>Семейная</span><b>2–10%</b></div>
      <small>Ставка зависит от сценария семьи</small>
      <div className={styles.programMeta}><span>ПВ от 20,1%</span><span>до 30 лет</span></div>
    </div>
    <svg className={styles.programScribble} viewBox="0 0 160 70" fill="none">
      <path d="M8 53c33-29 75-39 133-28" className={styles.redSketch}/>
      <path d="m132 18 12 7-10 8" className={styles.redSketch}/>
    </svg>
    <div className={styles.programCaption}>Условия собраны в одном месте</div>
  </div>;
}

function MortgageCalculatorArt(){
  return <div className={styles.calcScene} aria-hidden="true">
    <div className={styles.calcMock}>
      <div className={styles.calcMockHead}><span>Расчёт</span><b>Семейная · 6%</b></div>
      <div className={styles.calcField}>
        <span>Стоимость недвижимости</span><strong>9 000 000 ₽</strong>
        <i><em style={{width:"46%"}}/></i>
      </div>
      <div className={styles.calcField}>
        <span>Первоначальный взнос</span><strong>2 000 000 ₽</strong>
        <i><em style={{width:"22%"}}/></i>
      </div>
      <div className={styles.calcMiniRow}><span>15 лет</span><span>6%</span></div>
      <div className={styles.calcResult}>
        <small>Ежемесячный платёж</small><strong>59 072 ₽</strong><span>предварительный расчёт</span>
      </div>
    </div>
    <div className={styles.calcFloat}><span>Изменили ПВ</span><b>−4 860 ₽ / мес</b></div>
    <svg className={styles.calcScribble} viewBox="0 0 120 90" fill="none">
      <path d="M12 13c13 30 35 45 77 50" className={styles.redSketch}/>
      <path d="m82 54 9 10-12 5" className={styles.redSketch}/>
    </svg>
  </div>;
}

const slides:Slide[]=[
  {
    eyebrow:"PULSE · ИПОТЕКА",
    title:"Ипотека без хаоса",
    body:"Считайте платёж, сравнивайте программы и сразу понимайте, какой сценарий подходит клиенту.",
    art:<MortgageHouseArt/>,
  },
  {
    eyebrow:"ВСЁ В ОДНОМ МЕСТЕ",
    title:"Актуальные программы",
    body:"Семейная, Дальневосточная, IT и базовый сценарий собраны в одном разделе — с понятными условиями и ограничениями.",
    art:<MortgageProgramsArt/>,
  },
  {
    eyebrow:"ЖИВОЙ РАСЧЁТ",
    title:"Меняйте параметры — результат обновится сразу",
    body:"Стоимость, первоначальный взнос и срок влияют на платёж в реальном времени. PULSE сразу показывает ставку, лимиты и ограничения программы.",
    art:<MortgageCalculatorArt/>,
  },
];

export function MortgageStoryOnboarding({onDone}:{onDone:()=>void}){
  const [index,setIndex]=React.useState(0);
  const [paused,setPaused]=React.useState(false);
  const [cycle,setCycle]=React.useState(0);
  const press=React.useRef<{x:number;at:number}|null>(null);
  const slide=slides[index];

  const markSeen=(eventType:"mortgage_intro_complete"|"mortgage_intro_skip")=>{
    try{localStorage.setItem(MORTGAGE_STORY_STORAGE,MORTGAGE_STORY_VERSION);}catch{}
    recordPulseEvent({eventType,entityType:"onboarding",entityId:MORTGAGE_STORY_VERSION});
    onDone();
  };

  const goTo=(nextIndex:number)=>{
    const safe=Math.max(0,Math.min(slides.length-1,nextIndex));
    if(safe===index){setCycle(value=>value+1);return;}
    setIndex(safe);
    setCycle(value=>value+1);
    recordPulseEvent({eventType:"mortgage_intro_slide",entityType:"onboarding",entityId:String(safe+1)});
  };

  const next=()=>index===slides.length-1?markSeen("mortgage_intro_complete"):goTo(index+1);
  const previous=()=>goTo(index-1);

  React.useEffect(()=>{
    recordPulseEvent({eventType:"mortgage_intro_open",entityType:"onboarding",entityId:MORTGAGE_STORY_VERSION});
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return()=>{document.body.style.overflow=previousOverflow};
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
    if(Math.abs(delta)>42){delta<0?next():previous();return;}
    if(held<280){side==="right"?next():previous();}
  };

  return <section className={styles.overlay} aria-label="Знакомство с ипотекой">
    <div className={styles.stage}>
      <div className={styles.progress} aria-label={"Экран "+(index+1)+" из "+slides.length}>
        {slides.map((_,i)=><span key={i} className={i<index?styles.progressDone:i===index?styles.progressCurrent:styles.progressFuture}>
          {i===index&&<i
            key={index+"-"+cycle}
            style={{animationPlayState:paused?"paused":"running"}}
            onAnimationEnd={()=>{if(index<slides.length-1)goTo(index+1)}}
          />}
        </span>)}
      </div>

      <button className={styles.skip} type="button" onClick={()=>markSeen("mortgage_intro_skip")}>Пропустить <X size={15}/></button>

      <button
        type="button"
        className={`${styles.tapZone} ${styles.tapLeft}`}
        aria-label="Предыдущая история"
        onPointerDown={pointerDown}
        onPointerUp={pointerUp("left")}
        onPointerCancel={()=>{press.current=null;setPaused(false)}}
        onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();previous()}}}
      />
      <button
        type="button"
        className={`${styles.tapZone} ${styles.tapRight}`}
        aria-label="Следующая история"
        onPointerDown={pointerDown}
        onPointerUp={pointerUp("right")}
        onPointerCancel={()=>{press.current=null;setPaused(false)}}
        onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();next()}}}
      />

      <div key={index} className={styles.slide}>
        <div className={styles.art}>{slide.art}</div>
        <div className={styles.copy}>
          <span className={styles.eyebrow}>{slide.eyebrow}</span>
          <h2>{slide.title}</h2>
          <p>{slide.body}</p>
        </div>
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.primary} onClick={next}>
          <span>{index===slides.length-1?"Открыть калькулятор":"Далее"}</span><ArrowRight size={18}/>
        </button>
        <small>{index===slides.length-1?"Расчёт предварительный — финальные условия подтверждает банк.":"Можно листать касанием по краям экрана"}</small>
      </div>
    </div>
  </section>;
}
