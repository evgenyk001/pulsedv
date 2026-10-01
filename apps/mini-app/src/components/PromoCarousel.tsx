import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "./Carousel";
import Autoplay from "embla-carousel-autoplay";
import { usePromoBanners } from "../helpers/usePromoBanners";
import { recordPulseEvent } from "../../../../packages/pulse-data";
import styles from "./PromoCarousel.module.css";

type Slide={
  id:string;
  image:string;
  eyebrow:string;
  title:string;
  text:string;
  cta:string;
  to:string|null;
  kind:"promo"|"giveaway"|"partner";
};

const asset=(path:string)=>`${import.meta.env.BASE_URL}${path.startsWith("/")?path.slice(1):path}`;

const fallbackSlides:Slide[] = [
  { id:"projects",image:asset("/_cdn/static/938f9be1-5061-411a-ac1d-f1362819f38b.png"),eyebrow:"Приморье",title:"Квартира, которую хочется показывать друзьям",text:"Проекты Владивостока, Артёма и Уссурийска в одном каталоге.",cta:"Смотреть проекты",to:"/catalog",kind:"promo" },
  { id:"mortgage",image:asset("/_cdn/static/2f66fed6-2933-4ec7-8a98-583896cd9e5f.png"),eyebrow:"Ипотека",title:"Сначала платёж. Потом — подходящие квартиры",text:"Подберём проекты под комфортный ежемесячный платёж.",cta:"Рассчитать",to:"/mortgage",kind:"promo" },
  { id:"select",image:asset("/_cdn/static/7493f319-d413-4d3d-90e4-66b4a2ee6ecd.png"),eyebrow:"PULSE Select",title:"Не листайте сотни квартир вручную",text:"Ответьте на несколько вопросов — покажем подходящие ЖК.",cta:"Начать подбор",to:"/selection",kind:"promo" }
];

function visibleIndicatorIndexes(total:number,selected:number,maxVisible=5){
  if(total<=maxVisible)return Array.from({length:total},(_,index)=>index);
  const half=Math.floor(maxVisible/2);
  let start=Math.max(0,selected-half);
  start=Math.min(start,total-maxVisible);
  return Array.from({length:maxVisible},(_,index)=>start+index);
}

function BannerLink({to,className,children,label,onActivate}:{to:string|null;className:string;children:React.ReactNode;label:string;onActivate:()=>void}){
  if(!to)return <div className={className} aria-label={label}>{children}</div>;
  if(/^https?:\/\//i.test(to))return <a href={to} target="_blank" rel="noreferrer" className={className} aria-label={label} onClick={onActivate}>{children}</a>;
  return <Link to={to} className={className} aria-label={label} onClick={onActivate}>{children}</Link>;
}

export function PromoCarousel(){
  const {data:managed=[]}=usePromoBanners();
  const slides=React.useMemo<Slide[]>(()=>managed.length?managed.map((banner,index)=>({
    id:banner.id,
    image:banner.imageUrl||fallbackSlides[index%fallbackSlides.length].image,
    eyebrow:banner.eyebrow||banner.city||banner.audience||(banner.kind==="partner"?"Партнёр PULSE.DV":banner.kind==="giveaway"?"Специальное предложение":"PULSE.DV"),
    title:banner.title,
    text:banner.body,
    cta:banner.ctaLabel||"Подробнее",
    to:banner.actionUrl||null,
    kind:banner.kind||"promo",
  })):[],[managed]);

  const [api,setApi]=React.useState<CarouselApi>();
  const [selected,setSelected]=React.useState(0);
  const autoplay=React.useRef(Autoplay({delay:6000,stopOnInteraction:false,stopOnMouseEnter:true,playOnInit:false}));
  const [mediaReady,setMediaReady]=React.useState(false);
  const impressed=React.useRef(new Set<string>());

  React.useEffect(()=>{
    let active=true;
    if(!slides.length){setMediaReady(false);return()=>{active=false};}
    setMediaReady(false);
    Promise.all(slides.map(slide=>new Promise<void>(resolve=>{
      const image=new Image();
      image.src=slide.image;
      const done=()=>resolve();
      if(image.complete){
        if(typeof image.decode==="function")image.decode().catch(()=>{}).finally(done);
        else done();
      }else{
        image.onload=()=>{if(typeof image.decode==="function")image.decode().catch(()=>{}).finally(done);else done();};
        image.onerror=done;
      }
    }))).then(()=>{if(active)setMediaReady(true)});
    return()=>{active=false};
  },[slides]);

  React.useEffect(()=>{
    if(!api||!mediaReady||slides.length<2)return;
    const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if(reduced)return;
    autoplay.current.play();
    return()=>autoplay.current.stop();
  },[api,mediaReady,slides.length]);

  React.useEffect(()=>{
    if(!api)return;
    const sync=()=>setSelected(api.selectedScrollSnap());
    sync();api.on("select",sync);api.on("reInit",sync);
    return ()=>{api.off("select",sync);api.off("reInit",sync)};
  },[api]);

  React.useEffect(()=>{
    if(selected>=slides.length)setSelected(0);
  },[slides.length,selected]);

  React.useEffect(()=>{
    const slide=slides[selected];if(!slide||impressed.current.has(slide.id))return;
    impressed.current.add(slide.id);
    recordPulseEvent({eventType:"banner_impression",entityType:"banner",entityId:slide.id,metadata:{kind:slide.kind,position:selected+1}});
  },[selected,slides]);

  if(!slides.length)return null;

  const indicatorIndexes=visibleIndicatorIndexes(slides.length,selected);
  const hasBefore=indicatorIndexes.length>0&&indicatorIndexes[0]>0;
  const hasAfter=indicatorIndexes.length>0&&indicatorIndexes[indicatorIndexes.length-1]<slides.length-1;

  return <div className={styles.wrap}>
    <Carousel opts={{loop:slides.length>1,align:"start",duration:26,slidesToScroll:1}} plugins={[autoplay.current]} setApi={setApi} className={styles.carousel}>
      <CarouselContent>
        {slides.map(({id,image,eyebrow,title,text,cta,to,kind},index)=><CarouselItem key={id} className={styles.slide}>
          <BannerLink to={to} className={styles.bannerLink} label={title} onActivate={()=>recordPulseEvent({eventType:"banner_click",entityType:"banner",entityId:id,metadata:{kind,position:index+1,target:to}})}>
            <article className={styles.banner+" "+styles[kind]+" "+(selected===index?styles.bannerActive:"")}>
              <img src={image} alt="" loading="eager" decoding="async" fetchPriority={index===0?"high":"auto"}/>
              <div className={styles.scrim}/>
              <div className={styles.ambient}/>
              <div className={styles.edge}/>
              <div className={styles.content}>
                <div className={styles.eyebrow}>{eyebrow}</div>
                <h1>{title}</h1>
                <p>{text}</p>
                {to&&<div className={styles.cta}><span>{cta}</span><ArrowUpRight size={15}/></div>}
              </div>
            </article>
          </BannerLink>
        </CarouselItem>)}
      </CarouselContent>
    </Carousel>
    {slides.length>1&&<div className={styles.pagination} role="tablist" aria-label="Баннеры">
      {indicatorIndexes.map((slideIndex,slotIndex)=>{
        const active=slideIndex===selected;
        const edgeBefore=hasBefore&&slotIndex===0;
        const edgeAfter=hasAfter&&slotIndex===indicatorIndexes.length-1;
        return <button
          key={slideIndex}
          type="button"
          role="tab"
          aria-selected={active}
          aria-label={`Баннер ${slideIndex+1} из ${slides.length}`}
          className={styles.dot+" "+(active?styles.dotActive:"")+" "+((edgeBefore||edgeAfter)&&!active?styles.dotEdge:"")}
          onClick={()=>{
            api?.scrollTo(slideIndex);
            autoplay.current.reset();
          }}
        />;
      })}
    </div>}
  </div>;
}
