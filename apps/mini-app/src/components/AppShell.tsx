import React from "react";
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
  const hideNav=location.pathname.startsWith("/property/");

  React.useEffect(()=>{
    const version=control.content.onboardingVersion;
    setShowOnboarding(control.content.onboardingEnabled&&localStorage.getItem("pulse_onboarding_version")!==version);
  },[control.content.onboardingEnabled,control.content.onboardingVersion]);

  React.useEffect(()=>{
    const replay=()=>control.content.onboardingEnabled&&setShowOnboarding(true);
    window.addEventListener("pulse:show-onboarding",replay);
    return()=>window.removeEventListener("pulse:show-onboarding",replay);
  },[control.content.onboardingEnabled]);

  React.useEffect(()=>{
    const tg=window.Telegram?.WebApp;
    tg?.ready?.(); tg?.expand?.(); tg?.disableVerticalSwipes?.(); tg?.setHeaderColor?.("#F3F5F8"); tg?.setBackgroundColor?.("#F3F5F8");
  },[]);

  React.useEffect(()=>{
    window.scrollTo({top:0,behavior:"instant" as ScrollBehavior});
    recordPulseEvent({eventType:"page_view",entityType:"route",entityId:location.pathname,metadata:{search:location.search}});
  },[location.pathname,location.search]);

  return <div className={styles.viewport}>
    <div className={styles.ambientOne}/><div className={styles.ambientTwo}/>
    <main className={`${styles.shell} ${hideNav?styles.fullPage:""}`}>
      <div key={location.pathname} className={styles.routeFrame}>{children}</div>
    </main>
    {!hideNav&&<BottomNav/>}
    {showOnboarding&&!hideNav&&control.content.onboardingEnabled&&<Onboarding onDone={()=>setShowOnboarding(false)}/>}
  </div>
}
