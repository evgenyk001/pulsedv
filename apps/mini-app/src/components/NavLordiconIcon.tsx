import React from "react";
import Lottie,{type LottieRefCurrentProps} from "lottie-react";
import {NavPhosphorIcon,type NavIconKind} from "./NavPhosphorIcon";
import homeAnimation from "../assets/nav-lordicon/home.json";
import catalogAnimation from "../assets/nav-lordicon/catalog.json";
import selectionAnimation from "../assets/nav-lordicon/selection.json";
import heartAnimation from "../assets/nav-lordicon/heart.json";

type LottieData=Record<string,any>;
type Tone="base"|"active";

const source:Record<NavIconKind,LottieData>={
  home:homeAnimation as LottieData,
  building:catalogAnimation as LottieData,
  sparkles:selectionAnimation as LottieData,
  heart:heartAnimation as LottieData,
};

const speed:Record<NavIconKind,number>={
  home:1.25,
  building:1.35,
  sparkles:1.35,
  heart:1.25,
};

const toneColor:Record<Tone,number[]>={
  base:[17/255,24/255,39/255],
  active:[242/255,13/255,29/255],
};

function recolor(data:LottieData,color:number[]){
  const clone=JSON.parse(JSON.stringify(data)) as LottieData;
  const paint=(value:any)=>{
    if(!value||typeof value!=="object")return;
    if(value.a===0&&Array.isArray(value.k)&&value.k.length>=3){
      value.k=[color[0],color[1],color[2],value.k.length>3?value.k[3]:1];
    }else if(value.a===1&&Array.isArray(value.k)){
      for(const frame of value.k){
        if(Array.isArray(frame?.s)&&frame.s.length>=3)frame.s=[color[0],color[1],color[2],frame.s.length>3?frame.s[3]:1];
        if(Array.isArray(frame?.e)&&frame.e.length>=3)frame.e=[color[0],color[1],color[2],frame.e.length>3?frame.e[3]:1];
      }
    }
  };
  const walk=(node:any)=>{
    if(!node||typeof node!=="object")return;
    if((node.ty==="st"||node.ty==="fl")&&node.c)paint(node.c);
    if(node.nm==="Color"&&node.v)paint(node.v);
    for(const value of Object.values(node)){
      if(Array.isArray(value))value.forEach(walk);
      else if(value&&typeof value==="object")walk(value);
    }
  };
  walk(clone);
  return clone;
}

class IconBoundary extends React.Component<{children:React.ReactNode;fallback:React.ReactNode},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?this.props.fallback:this.props.children;}
}

export function NavLordiconIcon({kind,active,tone}:{kind:NavIconKind;active:boolean;tone:Tone}){
  const ref=React.useRef<LottieRefCurrentProps|null>(null);
  const [reduce,setReduce]=React.useState(()=>window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const data=React.useMemo(()=>recolor(source[kind],toneColor[tone]),[kind,tone]);

  React.useEffect(()=>{
    const media=window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync=()=>setReduce(media.matches);
    media.addEventListener("change",sync);
    return()=>media.removeEventListener("change",sync);
  },[]);

  const syncPlayer=React.useCallback(()=>{
    const player=ref.current;
    if(!player)return;
    player.setSpeed(speed[kind]);
    player.goToAndStop(0,true);
    if(active&&!reduce)player.play();
  },[active,kind,reduce]);

  React.useEffect(()=>{syncPlayer();},[data,syncPlayer]);

  const fallback=<NavPhosphorIcon kind={kind}/>;
  if(reduce)return fallback;

  return <IconBoundary fallback={fallback}>
    <Lottie
      lottieRef={ref}
      animationData={data}
      autoplay={false}
      loop={false}
      onDOMLoaded={syncPlayer}
      rendererSettings={{preserveAspectRatio:"xMidYMid meet"}}
      style={{width:"100%",height:"100%"}}
    />
  </IconBoundary>;
}
