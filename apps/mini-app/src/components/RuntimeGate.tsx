import {prepareTelegramWindow} from '../helpers/telegramWindow';
import {referralCodeFromStart} from '../../../../packages/partners/model';
import {PhoneRegistration} from './PhoneRegistration';
import {BrandLoading} from './BrandLoading';
import {dismissLaunchScreen} from '../helpers/launchScreen';
import {pageIsLeaving} from '../../../../packages/pulse-data/pageLifecycle';
import React from 'react';
import {initializePublicState,connectPublicIdentity,runtime,visitorApi} from '../../../../packages/pulse-data/runtime';
import './telegramConnection.css';
const publicRoute=(path:string)=>/^\/?tgWebApp(?:Data|Version|Platform)=/.test(path)||['/','/catalog','/map','/mortgage','/privacy','/personal-data-consent'].includes(path)||/^\/property\/[^/]+$/.test(path);
export function RuntimeGate({children}:{children:React.ReactNode}){
 const startApplied=React.useRef(false),active=React.useRef(true),identityTask=React.useRef<Promise<void>|null>(null);
 const [ready,setReady]=React.useState(!runtime.enabled),[registered,setRegistered]=React.useState(false),[connected,setConnected]=React.useState(!runtime.enabled);
 const [error,setError]=React.useState(''),[connectionError,setConnectionError]=React.useState('');
 const [,routeChanged]=React.useReducer(n=>n+1,0);
 React.useEffect(()=>{active.current=true;prepareTelegramWindow((window as any).Telegram?.WebApp);dismissLaunchScreen();const changed=()=>routeChanged();window.addEventListener('hashchange',changed);return()=>{active.current=false;window.removeEventListener('hashchange',changed)}},[]);
 const connect=React.useCallback(()=>{
  if(identityTask.current)return identityTask.current;
  setConnectionError('');setConnected(false);
  const task=(async()=>{try{
   await connectPublicIdentity();prepareTelegramWindow((window as any).Telegram?.WebApp);
   const account=runtime.requiresPhone?await visitorApi<{registered:boolean}>('/me/account'):{registered:true};
   if(!active.current)return;
   setRegistered(account.registered);setConnected(true);
   if(!startApplied.current){
    startApplied.current=true;
    // Routing hints never authenticate: the API has already verified initData.
    const start=(window as any).Telegram?.WebApp?.initDataUnsafe?.start_param||new URLSearchParams(window.location.search).get('tgWebAppStartParam');
    const referral=referralCodeFromStart(start);
    if(referral)window.location.hash='/partner-invite?code='+encodeURIComponent(referral);
    else if(start==='partners')window.location.hash='/partners';
   }
   window.dispatchEvent(new Event('pulse:identity-ready'));
  }catch(e){if(active.current)setConnectionError(e instanceof Error?e.message:'Не удалось подключить аккаунт')}
  })();
  identityTask.current=task;void task.finally(()=>{identityTask.current=null});return task;
 },[]);
 const load=React.useCallback(async()=>{setError('');try{await initializePublicState();if(!active.current)return;setReady(true);void connect()}catch(e){if(active.current)setError(e instanceof Error?e.message:'Не удалось загрузить приложение')}},[connect]);
 React.useEffect(()=>{if(runtime.enabled)void load()},[load]);
 React.useEffect(()=>{
  if(!runtime.enabled)return;
  const retry=()=>{if(pageIsLeaving()||document.visibilityState!=='visible')return;if(!ready)void load();else if(!connected)void connect();else void initializePublicState().catch(()=>{})};
  window.addEventListener('online',retry);document.addEventListener('visibilitychange',retry);
  const sdk=()=>{prepareTelegramWindow((window as any).Telegram?.WebApp);if(ready&&!connected)void connect()};window.addEventListener('pulse:telegram-sdk-ready',sdk);
  return()=>{window.removeEventListener('online',retry);document.removeEventListener('visibilitychange',retry);window.removeEventListener('pulse:telegram-sdk-ready',sdk)};
 },[ready,connected,connect,load]);
 const path=(window.location.hash.slice(1)||'/').split('?')[0],isPublic=publicRoute(path);
 if(!ready)return <BrandLoading fullScreen error={error} onRetry={()=>void load()}/>;
 const notice=<section className="telegramConnectionNotice" role={connectionError?'alert':'status'} aria-label="Подключение аккаунта"><p>{connectionError?'Не удалось подключить аккаунт. Каталог доступен — попробуйте подключиться ещё раз.':'Подключаем аккаунт. Каталог уже доступен.'}</p>{connectionError&&<button onClick={()=>void connect()}>Повторить подключение</button>}{!isPublic&&<a href="#/catalog">Перейти в каталог</a>}</section>;
 if(runtime.enabled&&!connected)return isPublic?<>{notice}{children}</>:notice;
 if(runtime.enabled&&runtime.requiresPhone&&!registered&&!['/privacy','/personal-data-consent'].includes(path))return isPublic?<><section className="telegramConnectionNotice"><p>Подтвердите номер, чтобы сохранять подборки и общаться с менеджером.</p><a href="#/profile">Войти в аккаунт</a></section>{children}</>:<PhoneRegistration onRegistered={()=>setRegistered(true)}/>;
 return children;
}
