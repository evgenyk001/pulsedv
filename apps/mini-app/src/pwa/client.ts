import {pwaStartRoute} from '../../../../packages/browser/pwaLinks';
import {api,visitorApi,replaceVisitorSession} from '../../../../packages/pulse-data/runtime';
export const isPwa=import.meta.env.VITE_APP_VARIANT==='pwa';
export type PwaConfiguration={phoneLogin:boolean;phoneChannel:'call'|'sms';push:boolean;pushPublicKey:string};
export const pwaConfig=()=>api<PwaConfiguration>('/public/pwa');
export function standalone(){return window.matchMedia('(display-mode: standalone)').matches||window.matchMedia('(display-mode: fullscreen)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;}
export function appleDevice(){return /iPhone|iPad|iPod/i.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;}
export type InstallPrompt=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
let installPrompt:InstallPrompt|null=null;
if(isPwa)window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event as InstallPrompt;window.dispatchEvent(new Event('pulse:install-available'))});
export async function install(){if(!installPrompt)return false;const prompt=installPrompt;installPrompt=null;await prompt.prompt();return (await prompt.userChoice).outcome==='accepted';}
export function canInstall(){return !!installPrompt;}
export async function registerPwa(){
 if(isPwa&&import.meta.env.VITE_PWA_PREVIEW!=='true'&&import.meta.env.VITE_PULSE_MODE==='api'){const route=pwaStartRoute(location.hash.slice(1));if(route!=='/'){const manifest=document.querySelector<HTMLLinkElement>('link[rel="manifest"]');if(manifest)manifest.href='/api/v1/public/pwa-manifest?route='+encodeURIComponent(route)}}
 if(!isPwa||!('serviceWorker' in navigator)||!window.isSecureContext)return;
 try{
  const registration=await navigator.serviceWorker.register(import.meta.env.BASE_URL+'sw.js',{scope:import.meta.env.BASE_URL,updateViaCache:'none'});
  if(import.meta.env.VITE_PWA_PREVIEW!=='true'){
   const notice=()=>{
    if(registration.active&&registration.waiting&&navigator.serviceWorker.controller){
     window.dispatchEvent(new Event('pulse:pwa-update'));
    }
   };
   const watchInstallation=()=>registration.installing?.addEventListener('statechange',notice);
   notice();
   watchInstallation();
   registration.addEventListener('updatefound',watchInstallation);
  }
  let lastUpdate=Date.now();document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastUpdate>60000){lastUpdate=Date.now();void registration.update().catch(()=>{})}});
  navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='PULSE_OPEN'){try{const url=new URL(e.data.url,location.origin);if(url.origin===location.origin&&url.pathname===import.meta.env.BASE_URL)location.hash=url.hash}catch{}}});
 }catch{window.dispatchEvent(new Event('pulse:pwa-unavailable'))}
}
export async function requestPhoneCode(phone:string,consentVersion:string,channel:'call'|'sms'='call'){return visitorApi<{challengeId:string;retryAfter:number;expiresIn:number;codeLength:number;channel:'call'|'sms'}>('/me/account/'+channel+'/request',{method:'POST',body:JSON.stringify({phone,consent:true,consentVersion})});}
export async function verifyPhoneCode(challengeId:string,code:string,channel:'call'|'sms'='call'){
 await resetPwaDevice();
 const session=await visitorApi<{sessionId:string;accessToken:string;expiresAt:string}>('/me/account/'+channel+'/verify',{method:'POST',body:JSON.stringify({challengeId,code})});
 replaceVisitorSession(session);window.dispatchEvent(new Event('pulse:identity-ready'));
}
function bytes(key:string){const padded=key.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(padded),c=>c.charCodeAt(0));}
const PUSH_ID='pulse.pwa.push-device:'+import.meta.env.BASE_URL;
const LEGACY_PUSH_ID='pulse.pwa.push-device';
export async function enablePush(){
 if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))throw Error('Этот браузер не поддерживает push. Откройте установленное приложение.');
 if(appleDevice()&&!standalone())throw Error('Сначала добавьте PULSEDV.RU на экран «Домой» и откройте с иконки.');
 // Called directly from a user click, before any asynchronous network request.
 const permission=await Notification.requestPermission();
 if(permission!=='granted')throw Error('Разрешение не включено. Его можно изменить в настройках устройства.');
 const config=await pwaConfig();if(!config.push)throw Error('Уведомления пока не подключены. Попробуйте позже.');
 const registration=await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
 if(!registration?.active)throw Error('Приложение ещё готовится. Перезапустите его с иконки и повторите.');
 const subscription=await registration.pushManager.getSubscription()??await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes(config.pushPublicKey)});
 const json=subscription.toJSON();
 try{const result=await visitorApi<{id:string}>('/me/push/subscribe',{method:'POST',body:JSON.stringify({endpoint:json.endpoint,keys:json.keys})});try{localStorage.setItem(PUSH_ID,result.id)}catch{}}
 catch(e){await subscription.unsubscribe();throw e}
}
export async function disablePush(){
 let id:string|null=null;try{id=localStorage.getItem(PUSH_ID)??(import.meta.env.VITE_PWA_PREVIEW==='true'?null:localStorage.getItem(LEGACY_PUSH_ID))}catch{}
 try{if(id)await visitorApi('/me/push/unsubscribe',{method:'POST',body:JSON.stringify({id})})}
 finally{
  try{if('serviceWorker' in navigator){const registration=await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);await (await registration?.pushManager.getSubscription())?.unsubscribe()}}
  finally{try{localStorage.removeItem(PUSH_ID);if(import.meta.env.VITE_PWA_PREVIEW!=='true')localStorage.removeItem(LEGACY_PUSH_ID)}catch{}}
 }
}
export function clearPwaPersonalCaches(){
 try{for(const key of ['pulse.dv.favorites.v1','pulse.favorite-changes.v2','pulse.favorites-imported.v2','pulse_selection_history'])localStorage.removeItem(key)}catch{}
 try{for(const key of Object.keys(sessionStorage))if(key.startsWith('pulse.new-conversation.')||key.startsWith('pulse.chat-context.'))sessionStorage.removeItem(key)}catch{}
}
export async function resetPwaDevice(){
 clearPwaPersonalCaches();
 try{localStorage.removeItem(PUSH_ID);const r=await navigator.serviceWorker?.getRegistration(import.meta.env.BASE_URL);await(await r?.pushManager.getSubscription())?.unsubscribe()}catch{}
}
export async function logoutPwa(){try{await disablePush()}catch{}await visitorApi('/me/account/logout',{method:'POST',body:'{}'});clearPwaPersonalCaches();replaceVisitorSession(null);void(navigator as Navigator&{clearAppBadge?:()=>Promise<void>}).clearAppBadge?.().catch(()=>{});location.reload();}
