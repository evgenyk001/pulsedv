import React from 'react';
import {Bell,Download,LogOut,RefreshCw,WifiOff,UserRound,Check,ArrowUpRight,MessageCircle} from 'lucide-react';
import {SafariShare,SafariAddHome} from './InstallationIcons';
import {useClientNotifications} from '../helpers/useClientNotifications';
import {useQuery} from '@tanstack/react-query';
import {GroupedMenu,MenuToggle,MenuButton,MenuInfo,MenuExternalLink} from '../components/GroupedMenu';
import {appleDevice,standalone,install,canInstall,enablePush,disablePush,logoutPwa,pwaConfig,isPwa} from './client';
import {runtime,visitorApi} from '../../../../packages/pulse-data/runtime';
import './pwa.css';
export function PwaStatus(){
 const [online,setOnline]=React.useState(navigator.onLine),[update,setUpdate]=React.useState(false),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
 React.useEffect(()=>{const on=()=>setOnline(navigator.onLine),up=()=>setUpdate(true);window.addEventListener('online',on);window.addEventListener('offline',on);window.addEventListener('pulse:pwa-update',up);return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',on);window.removeEventListener('pulse:pwa-update',up)}},[]);
 const apply=async()=>{setBusy(true);try{const r=await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);if(!r?.waiting){location.reload();return;}navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});r.waiting.postMessage({type:'PULSE_ACTIVATE'})}catch{setError('Не удалось обновить. Попробуйте позже.');setBusy(false)}};
 if(!isPwa||online&&!update)return null;
 return <aside className="pwaStatus" role="status">{!online?<><WifiOff size={18}/><span>Нет интернета. Действия не отправляются.</span></>:<><RefreshCw size={18}/><span>{error||'Доступна новая версия. Сохраните ввод перед обновлением.'}</span><button disabled={busy} onClick={()=>void apply()}>{busy?'Обновляем…':'Обновить'}</button></>}</aside>;
}
export function PwaPreferences(){
 const [enabled,setEnabled]=React.useState(false),[supported,setSupported]=React.useState(false),[ready,setReady]=React.useState(false),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
 React.useEffect(()=>{if(!isPwa)return;setSupported('PushManager' in window&&'Notification' in window);void pwaConfig().then(c=>setReady(c.push),()=>{});void navigator.serviceWorker?.getRegistration(import.meta.env.BASE_URL).then(async r=>setEnabled(!!await r?.pushManager.getSubscription())).catch(()=>{})},[]);
 if(!isPwa)return null;
 const toggle=async()=>{if(busy)return;setBusy(true);setError('');try{if(enabled)await disablePush();else await enablePush();setEnabled(!enabled)}catch(e){setError(e instanceof Error?e.message:'Не удалось изменить уведомления')}finally{setBusy(false)}};
 const logout=async()=>{setBusy(true);setError('');try{await logoutPwa()}catch{setError('Не удалось выйти. Проверьте интернет и повторите.');setBusy(false)}};
 return <GroupedMenu title="Приложение" caption={error||undefined}>
  <MenuToggle icon={<Bell/>} title="Системные уведомления" description={enabled?'На этом устройстве':!supported?'Доступны в установленном приложении':!ready?'Пока недоступны':runtime.publicPreview?'Ответы менеджера':'Сообщения, показы и новости'} checked={enabled} disabled={busy||!supported||(!ready&&!enabled)} onCheckedChange={()=>void toggle()}/>
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
