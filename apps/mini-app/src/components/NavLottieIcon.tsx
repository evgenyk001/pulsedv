import React from 'react';
import Lottie, {type LottieRefCurrentProps} from 'lottie-react';
import {Building2,Heart,Home,Sparkles} from 'lucide-react';
import homeAnimation from '../assets/nav-lottie/home.json';
import catalogAnimation from '../assets/nav-lottie/catalog.json';
import selectionAnimation from '../assets/nav-lottie/selection.json';
import heartAnimation from '../assets/nav-lottie/heart.json';

// Ready-made Lottie assets by useAnimations.com (CC BY 4.0): https://useanimations.com/
type Kind='home'|'building'|'sparkles'|'heart';
type LottieData=Record<string,any>;

const fallback={home:Home,building:Building2,sparkles:Sparkles,heart:Heart};
const source:Record<Kind,LottieData>={
  home:homeAnimation as LottieData,
  building:catalogAnimation as LottieData,
  sparkles:selectionAnimation as LottieData,
  heart:heartAnimation as LottieData,
};
const speed:Record<Kind,number>={
  home:1.4,
  building:1.1,
  sparkles:2,
  heart:1.2,
};

function recolor(data:LottieData,color:number[]){
  const clone=JSON.parse(JSON.stringify(data)) as LottieData;
  const walk=(node:any)=>{
    if(!node||typeof node!=='object')return;
    if((node.ty==='st'||node.ty==='fl')&&node.c&&typeof node.c==='object'){
      if(node.c.a===0&&Array.isArray(node.c.k))node.c.k=[...color,1];
      if(node.c.a===1&&Array.isArray(node.c.k)){
        for(const frame of node.c.k){
          if(Array.isArray(frame?.s))frame.s=[...color,1];
          if(Array.isArray(frame?.e))frame.e=[...color,1];
        }
      }
    }
    for(const value of Object.values(node)){
      if(Array.isArray(value))value.forEach(walk);
      else if(value&&typeof value==='object')walk(value);
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

export function NavLottieIcon({kind,active}:{kind:Kind;active:boolean}){
  const ref=React.useRef<LottieRefCurrentProps|null>(null);
  const Icon=fallback[kind];
  const [reduce,setReduce]=React.useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const data=React.useMemo(
    ()=>recolor(source[kind],active?[.949,.051,.114]:[.478,.529,.588]),
    [kind,active]
  );

  React.useEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync=()=>setReduce(media.matches);
    media.addEventListener('change',sync);
    return()=>media.removeEventListener('change',sync);
  },[]);

  const syncPlayer=React.useCallback(()=>{
    const player=ref.current;
    if(!player)return;
    player.setSpeed(speed[kind]);
    if(active&&!reduce){
      player.goToAndStop(0,true);
      player.play();
    }else{
      player.goToAndStop(0,true);
    }
  },[active,kind,reduce]);

  React.useEffect(()=>{syncPlayer();},[data,syncPlayer]);

  const staticIcon=<Icon size={22} strokeWidth={1.8}/>;

  return <span aria-hidden="true" style={{display:'grid',placeItems:'center',width:24,height:24}}>
    {reduce?staticIcon:<IconBoundary fallback={staticIcon}>
      <Lottie
        lottieRef={ref}
        animationData={data}
        autoplay={false}
        loop={false}
        onDOMLoaded={syncPlayer}
        rendererSettings={{preserveAspectRatio:'xMidYMid meet'}}
        style={{width:24,height:24}}
      />
    </IconBoundary>}
  </span>;
}
