import {FavoriteSync} from "../helpers/useFavoriteIds";
import {attribution} from '../../../../packages/journey/attribution';
import React from "react";
import {NavigationMemory} from "../helpers/navigationMemory";
import { useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { Onboarding } from "./Onboarding";
import { usePulseControlState } from "../helpers/usePulseControlState";
import { recordPulseEvent } from "../../../../packages/pulse-data";
import styles from "./AppShell.module.css";

declare global { interface Window { Telegram?: { WebApp?: { ready?:()=>void; expand?:()=>void; disableVerticalSwipes?:()=>void; setHeaderColor?:(color:string)=>void; setBackgroundColor?:(color:string)=>void; HapticFeedback?:{impactOccurred?:(style:string)=>void} } } } }

export function AppShell({children}:{children:React.ReactNode}){
  const location=useLocation();
  const control=usePulseControlState();
  const [showOnboarding,setShowOnboarding]=React.useState(false);
  const [storyOverlayOpen,setStoryOverlayOpen]=React.useState(false);
  const chatRoute=location.pathname==="/journey"&&new URLSearchParams(location.search).has("lead");
  const hideNav=location.pathname.startsWith("/property/")||chatRoute;

  React.useEffect(()=>{
    const version=control.content.onboardingVersion;
    setShowOnboarding(control.content.onboardingEnabled&&localStorage.getItem("pulse_onboarding_version")!==version);
  },[control.content.onboardingEnabled,control.content.onboardingVersion]);

  React.useEffect(()=>{
    const replay=()=>control.content.onboardingEnabled&&setShowOnboarding(true);
    window.addEventListener("pulse:show-onboarding",replay);
    return()=>window.removeEventListener("pulse:show-onboarding",replay);
  },[control.content.onboardingEnabled]);

  React.useLayoutEffect(()=>{
    const handleStoryOverlay=(event:Event)=>{
      const detail=(event as CustomEvent<{open?:boolean}>).detail;
      setStoryOverlayOpen(Boolean(detail?.open));
    };
    window.addEventListener("pulse:story-overlay",handleStoryOverlay);
    return()=>window.removeEventListener("pulse:story-overlay",handleStoryOverlay);
  },[]);

  React.useEffect(()=>{
    if(!sessionStorage.getItem("pulse.attribution.v1")){recordPulseEvent({eventType:"attribution",metadata:attribution(window.location.search||window.location.hash.split("?")[1]||"")});sessionStorage.setItem("pulse.attribution.v1","1");}
    const tg=window.Telegram?.WebApp;
    tg?.ready?.(); tg?.expand?.(); tg?.disableVerticalSwipes?.(); tg?.setHeaderColor?.("#F3F5F8"); tg?.setBackgroundColor?.("#F3F5F8");
  },[]);

  React.useEffect(()=>{
    const preventPageGesture=(event:Event)=>{
      const target=event.target instanceof Element?event.target:null;
      if(target?.closest('[data-allow-pinch-zoom="true"]'))return;
      event.preventDefault();
    };
    document.addEventListener("gesturestart",preventPageGesture,{passive:false});
    document.addEventListener("gesturechange",preventPageGesture,{passive:false});
    document.addEventListener("gestureend",preventPageGesture,{passive:false});
    return()=>{
      document.removeEventListener("gesturestart",preventPageGesture);
      document.removeEventListener("gesturechange",preventPageGesture);
      document.removeEventListener("gestureend",preventPageGesture);
    };
  },[]);

  React.useEffect(()=>{

    recordPulseEvent({eventType:"page_view",entityType:"route",entityId:location.pathname,metadata:{search:location.search}});
  },[location.pathname,location.search]);

  return <div className={styles.viewport}><NavigationMemory/><FavoriteSync/>
    <div className={styles.ambientOne}/><div className={styles.ambientTwo}/>
    <main className={`${styles.shell} ${hideNav?styles.fullPage:""}`}>
      <div key={location.pathname} className={`${styles.routeFrame} ${chatRoute?styles.chatRoute:""}`}>{children}</div>
    </main>
    {!hideNav&&!storyOverlayOpen&&<BottomNav/>}
    {showOnboarding&&!hideNav&&location.pathname!=="/mortgage"&&control.content.onboardingEnabled&&<Onboarding onDone={()=>setShowOnboarding(false)}/>}
  </div>
}
