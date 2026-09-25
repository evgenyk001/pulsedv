import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { NavLottieIcon } from "./NavLottieIcon";
import styles from "./BottomNav.module.css";

const items=[
  {path:"/",label:"Главная",icon:"home" as const},
  {path:"/catalog",label:"Каталог",icon:"building" as const},
  {path:"/selection",label:"Подбор",icon:"sparkles" as const},
  {path:"/favorites",label:"Избранное",icon:"heart" as const},
];

export function BottomNav(){
  const location=useLocation();
  const navigate=useNavigate();
  const dockRef=React.useRef<HTMLDivElement>(null);
  const dragRef=React.useRef({
    lastX:0,
    lastT:0,
    velocity:0,
    grabOffset:0,
    moved:false,
    previewIndex:0,
  });
  const [segmentWidth,setSegmentWidth]=React.useState(0);
  const [pillX,setPillX]=React.useState(0);
  const [dragging,setDragging]=React.useState(false);
  const [velocity,setVelocity]=React.useState(0);
  const [morphing,setMorphing]=React.useState(false);
  const [morphDirection,setMorphDirection]=React.useState(0);
  const morphTimer=React.useRef<number|undefined>(undefined);

  const activeIndex=React.useMemo(()=>{
    const index=items.findIndex(({path})=>path==="/"?location.pathname==="/":location.pathname.startsWith(path));
    return index<0?0:index;
  },[location.pathname]);

  const progress=segmentWidth>0?pillX/segmentWidth:activeIndex;

  React.useLayoutEffect(()=>{
    const dock=dockRef.current;
    if(!dock)return;
    const measure=()=>{
      const width=Math.max(0,dock.getBoundingClientRect().width-8);
      const segment=width/items.length;
      setSegmentWidth(segment);
      if(!dragging)setPillX(segment*activeIndex);
    };
    measure();
    const observer=new ResizeObserver(measure);
    observer.observe(dock);
    return()=>observer.disconnect();
  },[activeIndex,dragging]);

  React.useEffect(()=>{
    if(!dragging&&segmentWidth>0)setPillX(activeIndex*segmentWidth);
  },[activeIndex,segmentWidth,dragging]);

  React.useEffect(()=>()=>{if(morphTimer.current)window.clearTimeout(morphTimer.current)},[]);

  const haptic=()=>window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
  const triggerMorph=(direction:number)=>{
    setMorphing(false);
    setMorphDirection(direction);
    window.requestAnimationFrame(()=>{
      setMorphing(true);
      if(morphTimer.current)window.clearTimeout(morphTimer.current);
      morphTimer.current=window.setTimeout(()=>setMorphing(false),390);
    });
  };

  const beginDrag=(event:React.PointerEvent<HTMLDivElement>)=>{
    if(event.button!==0||segmentWidth<=0)return;
    const rect=event.currentTarget.getBoundingClientRect();
    const localX=event.clientX-rect.left-4;
    const pillLeft=pillX;
    const pillRight=pillX+segmentWidth;
    if(localX<pillLeft-5||localX>pillRight+5)return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current={
      lastX:event.clientX,
      lastT:performance.now(),
      velocity:0,
      grabOffset:localX-pillX,
      moved:false,
      previewIndex:Math.round(progress),
    };
    setDragging(true);
    setVelocity(0);
  };

  const moveDrag=(event:React.PointerEvent<HTMLDivElement>)=>{
    if(!dragging||segmentWidth<=0)return;
    event.preventDefault();
    const rect=event.currentTarget.getBoundingClientRect();
    const maxX=segmentWidth*(items.length-1);
    const rawX=event.clientX-rect.left-4-dragRef.current.grabOffset;
    const edgeResistance=10;
    const nextX=rawX<0
      ? Math.max(-edgeResistance,rawX*.18)
      : rawX>maxX
        ? Math.min(maxX+edgeResistance,maxX+(rawX-maxX)*.18)
        : rawX;
    const now=performance.now();
    const dx=event.clientX-dragRef.current.lastX;
    const dt=Math.max(5,now-dragRef.current.lastT);
    const instantVelocity=dx/dt;
    const filteredVelocity=dragRef.current.velocity*.64+instantVelocity*.36;
    if(Math.abs(event.clientX-dragRef.current.lastX)>1.2)dragRef.current.moved=true;
    dragRef.current.lastX=event.clientX;
    dragRef.current.lastT=now;
    dragRef.current.velocity=filteredVelocity;
    setPillX(nextX);
    setVelocity(filteredVelocity);

    const preview=Math.max(0,Math.min(items.length-1,Math.round(nextX/segmentWidth)));
    if(preview!==dragRef.current.previewIndex){
      dragRef.current.previewIndex=preview;
      haptic();
    }
  };

  const finishDrag=(event:React.PointerEvent<HTMLDivElement>)=>{
    if(!dragging||segmentWidth<=0)return;
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    const maxX=segmentWidth*(items.length-1);
    const clampedX=Math.max(0,Math.min(maxX,pillX));
    const projectedX=Math.max(0,Math.min(maxX,clampedX+dragRef.current.velocity*92));
    let index=Math.max(0,Math.min(items.length-1,Math.round(projectedX/segmentWidth)));
    if(Math.abs(dragRef.current.velocity)>.48){
      const current=Math.round(clampedX/segmentWidth);
      index=Math.max(0,Math.min(items.length-1,current+(dragRef.current.velocity>0?1:-1)));
    }
    setDragging(false);
    setVelocity(dragRef.current.velocity*.22);
    setPillX(index*segmentWidth);
    if(index!==dragRef.current.previewIndex)haptic();
    if(items[index].path!==location.pathname)navigate(items[index].path);
    window.setTimeout(()=>setVelocity(0),240);
    window.setTimeout(()=>{dragRef.current.moved=false},90);
  };

  const selectItem=(index:number)=>{
    if(dragRef.current.moved)return;
    const currentIndex=segmentWidth>0?Math.round(pillX/segmentWidth):activeIndex;
    const direction=index-currentIndex;
    const sign=direction===0?0:Math.sign(direction);
    triggerMorph(sign);
    setVelocity(sign*.18);
    window.setTimeout(()=>{
      setPillX(index*segmentWidth);
      haptic();
      if(items[index].path!==location.pathname)navigate(items[index].path);
    },52);
    window.setTimeout(()=>setVelocity(0),260);
  };

  const stretch=Math.min(.095,Math.abs(velocity)*.065);
  const tilt=Math.max(-1.35,Math.min(1.35,velocity*.82));

  return <nav className={styles.wrap} aria-label="Основная навигация">
    <div
      ref={dockRef}
      className={`${styles.glassDock} ${dragging?styles.dragging:""}`}
      onPointerDown={beginDrag}
      onPointerMove={moveDrag}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
      <span
        className={styles.glassPill}
        aria-hidden="true"
        style={{
          width:segmentWidth? `${segmentWidth}px` : "25%",
          transform:`translate3d(${pillX}px,0,0) scaleX(${1+stretch}) scaleY(${1-stretch*.24}) skewX(${tilt}deg)`
        }}
      >
        <span
          className={`${styles.pillSurface} ${morphing?styles.pillDrop:""}`}
          style={{
            "--drop-shift":`${morphDirection*5}px`,
            "--drop-origin":morphDirection<0?"100% 50%":morphDirection>0?"0% 50%":"50% 50%",
          } as React.CSSProperties}
        >
          <span className={styles.pillHighlight}/>
          <span className={styles.pillRefraction}/>
          <span className={styles.pillCaustic}/>
        </span>
      </span>
      {items.map(({path,label,icon},index)=>{
        const strength=Math.max(0,1-Math.abs(index-progress));
        const active=strength>.5;
        const iconScale=.96+strength*.08;
        const lift=-strength*.9;
        const base=[122,135,150];
        const accent=[242,13,29];
        const mix=(a:number,b:number)=>Math.round(a+(b-a)*strength);
        const color=`rgb(${mix(base[0],accent[0])} ${mix(base[1],accent[1])} ${mix(base[2],accent[2])})`;
        return <button
          key={path}
          type="button"
          className={`${styles.item} ${active?styles.active:""}`}
          aria-current={index===activeIndex?"page":undefined}
          onClick={()=>selectItem(index)}
          style={{color}}
        >
          <span className={styles.icon} style={{transform:`translateY(${lift}px) scale(${iconScale})`}}><NavLottieIcon kind={icon} active={index===activeIndex}/></span>
          <span className={styles.label} style={{opacity:.66+strength*.34,transform:`translateY(${-strength*.35}px)`}}>{label}</span>
        </button>
      })}
    </div>
  </nav>
}
