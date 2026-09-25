import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Building2, Percent, Sparkles, X, type LucideIcon } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "./Carousel";
import Autoplay from "embla-carousel-autoplay";
import { usePromoBanners } from "../helpers/usePromoBanners";
import styles from "./PromoCarousel.module.css";

type Slide={
  id:string;
  image:string;
  eyebrow:string;
  title:string;
  text:string;
  cta:string;
  to:string;
  icon:LucideIcon;
};

const asset=(path:string)=>`${import.meta.env.BASE_URL}${path.startsWith("/")?path.slice(1):path}`;

const fallbackSlides:Slide[] = [
  { id:"projects",image:asset("/_cdn/static/938f9be1-5061-411a-ac1d-f1362819f38b.png"),eyebrow:"Новостройки Приморья",title:"Квартира, которую хочется показывать друзьям",text:"Проекты Владивостока, Артёма и Уссурийска в одном каталоге.",cta:"Смотреть проекты",to:"/catalog",icon:Building2 },
  { id:"mortgage",image:asset("/_cdn/static/2f66fed6-2933-4ec7-8a98-583896cd9e5f.png"),eyebrow:"Семейная ипотека",title:"Сначала платёж. Потом — подходящие квартиры",text:"Подберём проекты под комфортный ежемесячный платёж.",cta:"Рассчитать",to:"/mortgage",icon:Percent },
  { id:"select",image:asset("/_cdn/static/7493f319-d413-4d3d-90e4-66b4a2ee6ecd.png"),eyebrow:"PULSE Select",title:"Не листайте сотни квартир вручную",text:"Ответьте на несколько вопросов — покажем подходящие ЖК.",cta:"Начать подбор",to:"/selection",icon:Sparkles }
];

function BannerLink({to,className,children,label}:{to:string;className:string;children:React.ReactNode;label:string}){
  if(/^https?:\/\//i.test(to))return <a href={to} target="_blank" rel="noreferrer" className={className} aria-label={label}>{children}</a>;
  return <Link to={to||"/catalog"} className={className} aria-label={label}>{children}</Link>;
}

export function PromoCarousel(){
  const {data:managed=[]}=usePromoBanners();
  const [hidden,setHidden]=React.useState(()=>sessionStorage.getItem("pulse_promo_hidden")==="1");
  const slides=React.useMemo<Slide[]>(()=>managed.length?managed.map((banner,index)=>({
    id:banner.id,
    image:banner.imageUrl||fallbackSlides[index%fallbackSlides.length].image,
    eyebrow:banner.city||banner.audience||"PULSE.DV",
    title:banner.title,
    text:banner.body,
    cta:banner.ctaLabel||"Подробнее",
    to:banner.actionUrl||"/catalog",
    icon:Sparkles,
  })):fallbackSlides,[managed]);

  const [api,setApi]=React.useState<CarouselApi>();
  const [selected,setSelected]=React.useState(0);
  const autoplay=React.useRef(Autoplay({delay:5200,stopOnInteraction:false,stopOnMouseEnter:true}));

  React.useEffect(()=>{
    if(!api)return;
    const sync=()=>setSelected(api.selectedScrollSnap());
    sync();api.on("select",sync);api.on("reInit",sync);
    return ()=>{api.off("select",sync);api.off("reInit",sync)};
  },[api]);

  React.useEffect(()=>{
    if(selected>=slides.length)setSelected(0);
  },[slides.length,selected]);

  const dismiss=()=>{
    sessionStorage.setItem("pulse_promo_hidden","1");
    setHidden(true);
  };

  if(hidden)return null;

  return <div className={styles.wrap}>
    <button type="button" className={styles.dismiss} onClick={dismiss} aria-label="Скрыть баннеры на эту сессию"><X size={15}/></button>
    <Carousel opts={{loop:slides.length>1,align:"start",duration:30}} plugins={[autoplay.current]} setApi={setApi} className={styles.carousel}>
      <CarouselContent>
        {slides.map(({id,image,eyebrow,title,text,cta,to,icon:Icon},index)=><CarouselItem key={id} className={styles.slide}>
          <BannerLink to={to} className={styles.bannerLink} label={title}>
            <article className={styles.banner+" "+(selected===index?styles.bannerActive:"")}>
              <img src={image} alt=""/>
              <div className={styles.overlay}/>
              <div className={styles.glow}/>
              <div className={styles.content}>
                <div className={styles.eyebrow}><span><Icon size={13}/></span>{eyebrow}</div>
                <h1>{title}</h1>
                <p>{text}</p>
                <div className={styles.cta}>{cta}<ArrowUpRight size={16}/></div>
              </div>
              <div className={styles.index}>{String(index+1).padStart(2,"0")}<span>/</span>{String(slides.length).padStart(2,"0")}</div>
            </article>
          </BannerLink>
        </CarouselItem>)}
      </CarouselContent>
    </Carousel>
    {slides.length>1&&<div className={styles.dots} aria-label="Слайды">
      {slides.map((slide,index)=><button key={slide.id} onClick={()=>api?.scrollTo(index)} className={index===selected?styles.active:""} aria-label={"Слайд "+(index+1)}/>)}
    </div>}
  </div>
}
   94