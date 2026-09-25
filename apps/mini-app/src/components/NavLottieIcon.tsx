import React from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import { makeNavAnimation, type NavAnimationKind } from "./navAnimations";

export type NavIconKind=NavAnimationKind;

export function NavLottieIcon({kind,active}:{kind:NavIconKind;active:boolean}){
  const ref=React.useRef<LottieRefCurrentProps>(null);
  const data=React.useMemo(()=>makeNavAnimation(kind,active),[kind,active]);
  React.useEffect(()=>{
    if(active)ref.current?.goToAndPlay(0,true);
    else ref.current?.goToAndStop(0,true);
  },[active]);
  return <Lottie lottieRef={ref} animationData={data} autoplay={active} loop={false} style={{width:26,height:26}}/>;
}
