import {pageIsLeaving} from '../pulse-data/pageLifecycle';
/** Refresh on returning to the app, not on a timer. Coalesce native and browser events. */
export function subscribePartnerReturn(refresh:()=>void){
 let last=-Infinity;
 const active=()=>{if(pageIsLeaving()||document.visibilityState==='hidden'||Date.now()-last<300)return;last=Date.now();refresh()};
 const pageshow=(e:PageTransitionEvent)=>{if(e.persisted)active()};
 const tg=(window as any).Telegram?.WebApp;
 document.addEventListener('visibilitychange',active);window.addEventListener('focus',active);window.addEventListener('pageshow',pageshow);
 if(tg?.isVersionAtLeast?.('8.0'))tg.onEvent?.('activated',active);
 return()=>{document.removeEventListener('visibilitychange',active);window.removeEventListener('focus',active);window.removeEventListener('pageshow',pageshow);if(tg?.isVersionAtLeast?.('8.0'))tg.offEvent?.('activated',active)};
}
