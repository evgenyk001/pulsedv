import {prepareTelegramWindow} from '../helpers/telegramWindow';
import {referralCodeFromStart} from '../../../../packages/partners/model';
import {PhoneRegistration} from './PhoneRegistration';
import {BrandLoading} from './BrandLoading';
import {dismissLaunchScreen} from '../helpers/launchScreen';
import {pageIsLeaving} from '../../../../packages/pulse-data/pageLifecycle';
import React from 'react';
import { initializePublic, runtime,visitorApi } from '../../../../packages/pulse-data/runtime';
export function RuntimeGate({children}:{children:React.ReactNode}){
 const startApplied=React.useRef(false);
 React.useEffect(()=>{prepareTelegramWindow((window as any).Telegram?.WebApp);dismissLaunchScreen()},[]);
 const [ready,setReady]=React.useState(!runtime.enabled);
 const [registered,setRegistered]=React.useState(false);
 const [,routeChanged]=React.useReducer(n=>n+1,0);
 React.useEffect(()=>{const changed=()=>routeChanged();window.addEventListener('hashchange',changed);return()=>window.removeEventListener('hashchange',changed)},[]);
 const [error,setError]=React.useState('');
 const load=React.useCallback(async()=>{setError('');try{await initializePublic();
 if(!startApplied.current){
  startApplied.current=true;
  // Navigation hints never authenticate the visitor; the API already verified initData.
  const start=(window as any).Telegram?.WebApp?.initDataUnsafe?.start_param||new URLSearchParams(window.location.search).get('tgWebAppStartParam');
  const referral=referralCodeFromStart(start);
  if(referral)window.location.hash='/partner-invite?code='+encodeURIComponent(referral);
  else if(start==='partners')window.location.hash='/partners';
 }
 if(runtime.requiresPhone){const account=await visitorApi<{registered:boolean}>('/me/account');setRegistered(account.registered)}setReady(true);}catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить приложение');}},[]);
 React.useEffect(()=>{if(runtime.enabled)void load();},[load]);
 React.useEffect(()=>{if(!runtime.enabled||ready)return;const retry=()=>{void load()};window.addEventListener('online',retry);return()=>window.removeEventListener('online',retry)},[ready,load]);
 React.useEffect(()=>{if(!ready||!runtime.enabled)return;const refresh=()=>{if(!pageIsLeaving()&&document.visibilityState==='visible')void initializePublic().catch(()=>{});};window.addEventListener('online',refresh);document.addEventListener('visibilitychange',refresh);return()=>{window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',refresh);};},[ready]);
 React.useEffect(()=>{if(error||ready&&runtime.requiresPhone&&!registered)dismissLaunchScreen()},[error,ready,registered]);
 if(!ready)return <BrandLoading fullScreen error={error} onRetry={()=>void load()}/>;
 if(runtime.enabled&&runtime.requiresPhone&&!registered&&!['/privacy','/personal-data-consent'].includes(window.location.hash.slice(1).split('?')[0]))return <PhoneRegistration onRegistered={()=>setRegistered(true)}/>;
 return children;
}
