import React from 'react';
import {Bell,Download,LogOut,WifiOff,UserRound,MessageCircle,Send,KeyRound} from 'lucide-react';
import {SafariShare,SafariAddHome} from './InstallationIcons';
import {useClientNotifications} from '../helpers/useClientNotifications';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {GroupedMenu,MenuToggle,MenuButton,MenuInfo,MenuExternalLink} from '../components/GroupedMenu';
import {appleDevice,standalone,install,canInstall,enablePush,disablePush,logoutPwa,pwaConfig,isPwa,startPwaTelegramLogin} from './client';
import {runtime,visitorApi} from '../../../../packages/pulse-data/runtime';
import {loginWithPasskey,passkeysSupported} from '../../../../packages/partners/passkeys';
import {PwaSecurityPreferences} from './PwaPartnerSecurity';
import './pwa.css';
export function PwaStatus(){
 const [online,setOnline]=React.useState(navigator.onLine);
 React.useEffect(()=>{
  const sync=()=>setOnline(navigator.onLine);
  window.addEventListener('online',sync);
  window.addEventListener('offline',sync);
  return()=>{
   window.removeEventListener('online',sync);
   window.removeEventListener('offline',sync);
  };
 },[]);
 if(!isPwa||online)return null;
 return <aside className="pwaStatus" role="status"><WifiOff size={18}/><span>Нет интернета. Действия не отправляются.</span></aside>;
}
function usePwaTelegramAccount(){
 const config=useQuery({queryKey:['pwa-login-config'],queryFn:pwaConfig,enabled:isPwa&&runtime.publicPreview});
 const account=useQuery({queryKey:['pwa-login-account'],queryFn:()=>visitorApi<{authenticated:boolean;registered:boolean;name:string|null}>('/me/account'),enabled:!!config.data?.telegramLogin});
 return {config,account};
}
export function PwaPreferences(){
 const {account}=usePwaTelegramAccount();
 const [enabled,setEnabled]=React.useState(false),[supported,setSupported]=React.useState(false),[ready,setReady]=React.useState(false),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
 React.useEffect(()=>{if(!isPwa)return;setSupported('PushManager' in window&&'Notification' in window);void pwaConfig().then(c=>setReady(c.push),()=>{});void navigator.serviceWorker?.getRegistration(import.meta.env.BASE_URL).then(async r=>setEnabled(!!await r?.pushManager.getSubscription())).catch(()=>{})},[]);
 if(!isPwa)return null;
 const toggle=async()=>{if(busy)return;setBusy(true);setError('');try{if(enabled)await disablePush();else await enablePush();setEnabled(!enabled)}catch(e){setError(e instanceof Error?e.message:'Не удалось изменить уведомления')}finally{setBusy(false)}};
 const logout=async()=>{setBusy(true);setError('');try{await logoutPwa()}catch{setError('Не удалось выйти. Проверьте интернет и повторите.');setBusy(false)}};
 return <GroupedMenu title="Приложение" caption={error||undefined}>
  <MenuToggle className="pwaAppToggle" icon={<Bell/>} title="Системные уведомления" description={!supported?'Доступны в установленном приложении':!ready?'Пока недоступны':'Сообщения, показы, новые ЖК и обновления'} checked={enabled} disabled={busy||!supported||(!ready&&!enabled)} onCheckedChange={()=>void toggle()}/>
  {(!runtime.publicPreview||account.data?.authenticated&&account.data.registered)&&<PwaSecurityPreferences/>}
  {!standalone()&&<MenuButton icon={<Download/>} title="Добавить на главный экран" description={appleDevice()?'Поделиться → На экран «Домой»':'Установка приложения'} onClick={()=>{if(canInstall())void install().catch(()=>setError('Откройте меню браузера и выберите установку'));else setError(appleDevice()?'В Safari нажмите «Поделиться» → «На экран Домой»':'В меню браузера выберите «Установить приложение»')}}/>}
  {!runtime.publicPreview&&<MenuButton icon={<LogOut/>} title="Выйти из аккаунта" disabled={busy} onClick={()=>void logout()}/>}{error&&<span className="sr-only" role="alert">{error}</span>}
 </GroupedMenu>;
}

export function PwaBadge(){
 const notices=useClientNotifications();
 React.useEffect(()=>{if(!isPwa||!notices.data)return;const n=navigator as Navigator&{setAppBadge?:(n:number)=>Promise<void>;clearAppBadge?:()=>Promise<void>};void(notices.data.unreadCount?n.setAppBadge?.(notices.data.unreadCount):n.clearAppBadge?.())?.catch(()=>{})},[notices.data?.unreadCount]);
 return null;
}
export function PwaAccount(){
 const account=useQuery({queryKey:['pwa-account'],queryFn:()=>visitorApi<{name:string;phone:string;telegramLinked:boolean;botUsername:string}>('/me/account'),enabled:isPwa,refetchOnWindowFocus:true});
 if(!isPwa||!account.data)return null;
 const a=account.data;
 return <GroupedMenu title="Ваш аккаунт">
  <MenuInfo icon={<UserRound/>} title={a.name==='Клиент'?'Покупатель PULSEDV.RU':a.name} description={a.phone+' · подтверждён'}/>
  <MenuExternalLink icon={<MessageCircle/>} title={a.telegramLinked?'Telegram подключён':'Подключить Telegram'} description={a.telegramLinked?'Открыть бота':'Войдите с тем же номером'} href={'https://t.me/'+a.botUsername+'?startapp=profile'} target="_blank" rel="noopener noreferrer"/>
 </GroupedMenu>;
}

export function PwaTelegramAccount(){
 const cache=useQueryClient();
 const {config,account}=usePwaTelegramAccount();
 const [busy,setBusy]=React.useState(false);
 const [message,setMessage]=React.useState<string>(()=>history.state?.telegramLoginMessage||'');
 React.useEffect(()=>{
  if(history.state?.telegramLoginMessage)history.replaceState({...history.state,telegramLoginMessage:undefined},'');
 },[]);
 if(!config.data?.telegramLogin&&!message)return null;
 const authenticated=account.data?.authenticated;
 const act=async()=>{
  setBusy(true);setMessage('');
  try{if(authenticated)await logoutPwa();else await startPwaTelegramLogin()}
  catch(error){setMessage(error instanceof Error?error.message:'Попробуйте ещё раз.');setBusy(false)}
 };
 const byKey=async()=>{
  setBusy(true);setMessage('');
  try{await loginWithPasskey();await cache.invalidateQueries({queryKey:['pwa-login-account']})}
  catch(error){setMessage(error instanceof Error?error.message:'Не удалось войти с ключом.')}
  finally{setBusy(false)}
 };
 return <section className="pwaLoginCard" aria-label="Аккаунт PULSEDV.RU">
  <span className="pwaLoginCard__icon"><UserRound size={22}/></span>
  <div className="pwaLoginCard__copy">
   <h2>{authenticated?account.data?.name||'Ваш аккаунт':'Ваш аккаунт'}</h2>
   <p>{authenticated?'Избранное и обращения доступны в PWA и мини-аппе.':'Сохраните избранное и переписку в одном аккаунте с мини-аппом.'}</p>
  </div>
  {config.data?.telegramLogin&&<button type="button" disabled={busy||account.isPending} onClick={()=>void act()}>
   {authenticated?<LogOut size={18}/>:<Send size={18}/>}
   {busy?'Подождите…':authenticated?'Выйти':'Войти через Telegram'}
  </button>}
  {!authenticated&&!account.isPending&&passkeysSupported()&&<button type="button" disabled={busy} onClick={()=>void byKey()}><KeyRound size={18}/>Войти с ключом доступа</button>}
  {message&&<p className="pwaLoginCard__status" role="status">{message}</p>}
 </section>;
}
