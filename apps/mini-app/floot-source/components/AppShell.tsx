import React from "react";
import { useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { Onboarding } from "./Onboarding";
import styles from "./AppShell.module.css";

declare global { interface Window { Telegram?: { WebApp?: { ready?:()=>void; expand?:()=>void; disableVerticalSwipes?:()=>void; setHeaderColor?:(color:string)=>void; setBackgroundColor?:(color:string)=>void; HapticFeedback?:{impactOccurred?:(style:string)=>void} } } } }

export function AppShell({children}:{children:React.ReactNode}){
  const location=useLocation();
  const [showOnboarding,setShowOnboarding]=React.useState(false);
  const hideNav=location.pathname.startsWith("/property/")||location.pathname.startsWith("/admin")||location.pathname==="/login";
  React.useEffect(()=>{setShowOnboarding(localStorage.getItem("pulse_onboarding_version")!=="5")},[]);
  React.useEffect(()=>{
    const tg=window.Telegram?.WebApp;
    tg?.ready?.(); tg?.expand?.(); tg?.disableVerticalSwipes?.(); tg?.setHeaderColor?.("#F3F5F8"); tg?.setBackgroundColor?.("#F3F5F8");
  },[]);
  React.useEffect(()=>{window.scrollTo({top:0,behavior:"instant" as ScrollBehavior})},[location.pathname]);
  return <div className={styles.viewport}>
    <div className={styles.ambientOne}/><div className={styles.ambientTwo}/>
    <main className={`${styles.shell} ${hideNav?styles.fullPage:""}`}>
      <div key={location.pathname} className={styles.routeFrame}>{children}</div>
    </main>
    {!hideNav&&<BottomNav/>}
    {showOnboarding&&!hideNav&&<Onboarding onDone={()=>setShowOnboarding(false)}/>}
  </div>
}