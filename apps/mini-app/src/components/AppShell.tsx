import {BrandLoading} from "./BrandLoading";
import {standalone} from '../pwa/client';
import {runtime} from '../../../../packages/pulse-data/runtime';
import {safeLocalStorage,safeSessionStorage} from '../../../../packages/browser/storage';
import {prepareTelegramWindow} from '../helpers/telegramWindow';
import {FavoriteSync} from "../helpers/useFavoriteIds";
import {attribution} from '../../../../packages/journey/attribution';
import React from "react";
import {BackLink} from './BackLink';
import {NavigationMemory,useAppBack} from "../helpers/navigationMemory";
import { useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { Onboarding } from "./Onboarding";
import { usePulseControlState } from "../helpers/usePulseControlState";
import { recordPulseEvent } from "../../../../packages/pulse-data";
import styles from "./AppShell.module.css";

declare global { interface Window { Telegram?: { WebApp?: { ready?:()=>void; expand?:()=>void; disableVerticalSwipes?:()=>void; setHeaderColor?:(color:string)=>void; setBackgroundColor?:(color:string)=>void; HapticFeedback?:{impactOccurred?:(style:string)=>void} } } } }

function ContextBack(){
 const location=useLocation(),{canGoBack}=useAppBack();
 const hasOwnBack=location.pathname.startsWith('/property/')||['/giveaway','/compare','/partners','/partner-offer','/partner-invite','/privacy','/personal-data-consent','/my-search','/journey'].includes(location.pathname);
 return canGoBack&&!hasOwnBack&&location.pathname!=='/'&&!location.state?.tabRoot?<nav data-app-back-row className={styles.contextBack} aria-label="Возврат"><BackLink to="/" aria-label="Назад к предыдущему экрану"/><span>Назад</span></nav>:null;
}

export function AppShell({children}:{children:React.ReactNode}){
  const location=useLocation();
  const control=usePulseControlState();
  const [showOnboarding,setShowOnboarding]=React.useState(()=>control.content.onboardingEnabled&&safeLocalStorage.getItem("pulse_onboarding_version")!==control.content.onboardingVersion);
  const [startupSettled,setStartupSettled]=React.useState(()=>!runtime.browserMode);
  const [storyOverlayOpen,setStoryOverlayOpen]=React.useState(false);
  const chatRoute=location.pathname==="/journey"&&(new URLSearchParams(location.search).has("lead")||new URLSearchParams(location.search).has("compose"));
  const propertyRoute=location.pathname.startsWith("/property/");
  const legalRoute=['/privacy','/personal-data-consent'].includes(location.pathname);
  const hideNav=propertyRoute||chatRoute;
  const onboardingRequested=showOnboarding&&!['/privacy','/personal-data-consent'].includes(location.pathname)&&!hideNav&&location.pathname!=="/mortgage"&&control.content.onboardingEnabled;
  const onboardingPending=onboardingRequested&&!startupSettled;
  const onboardingVisible=startupSettled&&onboardingRequested;

  React.useEffect(()=>{
    if(!runtime.browserMode)return;
    const viewport=window.visualViewport;
    let timer:number;
    const settle=()=>setStartupSettled(true);
    const schedule=()=>{
      window.clearTimeout(timer);
      timer=window.setTimeout(settle,350);
    };
    const deadline=window.setTimeout(settle,1200);
    viewport?.addEventListener("resize",schedule);
    window.addEventListener("resize",schedule);
    schedule();
    return ()=>{
      window.clearTimeout(timer);
      window.clearTimeout(deadline);
      viewport?.removeEventListener("resize",schedule);
      window.removeEventListener("resize",schedule);
    };
  },[]);

  React.useEffect(()=>{
    const version=control.content.onboardingVersion;
    setShowOnboarding(control.content.onboardingEnabled&&safeLocalStorage.getItem("pulse_onboarding_version")!==version);
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
    if(!safeSessionStorage.getItem("pulse.attribution.v1")){recordPulseEvent({eventType:"attribution",metadata:attribution(window.location.search||window.location.hash.split("?")[1]||"",document.referrer,window.location.origin)});safeSessionStorage.setItem("pulse.attribution.v1","1");}
    const tg=window.Telegram?.WebApp;
    prepareTelegramWindow(tg);
  },[]);

  React.useEffect(()=>{
    if(runtime.browserMode&&!standalone())return;
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

  return <NavigationMemory><div className={styles.viewport} inert={onboardingPending} style={onboardingPending?{visibility:"hidden"}:undefined}>{!legalRoute&&<FavoriteSync/>}
    <div className={styles.ambientOne}/><div className={styles.ambientTwo}/>
    <main className={`${styles.shell} ${hideNav?styles.fullPage:""}`}>
      <ContextBack/><div key={location.pathname} className={`${styles.routeFrame} ${chatRoute?styles.chatRoute:propertyRoute?styles.propertyFrame:""}`}>{!onboardingVisible&&children}</div>
    </main>
    {!hideNav&&!legalRoute&&!storyOverlayOpen&&<BottomNav/>}
    {onboardingVisible&&<Onboarding onDone={()=>setShowOnboarding(false)}/>}
  </div>{onboardingPending&&<BrandLoading fullScreen/>}</NavigationMemory>
}
