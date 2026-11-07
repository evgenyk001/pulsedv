import React from 'react';
import {Bell,Download,LogOut,RefreshCw,WifiOff,UserRound,Check,ArrowUpRight} from 'lucide-react';
import {SafariShare,SafariAddHome} from './InstallationIcons';
import {useClientNotifications} from '../helpers/useClientNotifications';
import {useQuery} from '@tanstack/react-query';
import {GroupedMenu} from '../components/GroupedMenu';
import {appleDevice,standalone,install,canInstall,enablePush,disablePush,logoutPwa,pwaConfig,isPwa} from './client';
import {visitorApi} from '../../../../packages/pulse-data/runtime';
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
 return <GroupedMenu title="Приложение"><div className="pwaPreference"><Bell size={21}/><div><strong>Системные уведомления</strong><p>{enabled?'Включены на этом устройстве':!supported?'Откройте установленную PWA в поддерживаемом браузере':!ready?'Пока недоступны':'Ответы менеджера, показы и важные обновления'}</p></div><button disabled={busy||!supported||(!ready&&!enabled)} onClick={()=>void toggle()}>{enabled?'Отключить':'Включить'}</button></div>
  {!standalone()&&<div className="pwaPreference"><Download size={21}/><div><strong>Добавить на главный экран</strong><p>{appleDevice()?<>Меню <SafariShare/> → <SafariAddHome/> «На экран “Домой”»</>:'Выберите установку в меню браузера'}</p></div>{canInstall()&&<button onClick={()=>void install()}>Добавить</button>}</div>}
  <button className="pwaLogout" disabled={busy} onClick={()=>void logout()}><LogOut size={17}/> Выйти на этом устройстве</button>{error&&<p className="pwaError" role="alert">{error}</p>}
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
 return <GroupedMenu title="Ваш аккаунт"><div className="pwaPreference"><UserRound size={21}/><div><strong>{a.name==='Клиент'?'Покупатель PULSEDV.RU':a.name}</strong><p>{a.phone} · номер подтверждён</p></div><Check size={18}/></div><div className="pwaAccountLink"><strong>{a.telegramLinked?'Telegram подключён':'Подключить Telegram'}</strong>{!a.telegramLinked&&<p>Подтвердите тот же номер в Telegram.</p>}<a href={'https://t.me/'+a.botUsername+'?startapp=profile'} target="_blank" rel="noreferrer">{a.telegramLinked?'Открыть Telegram':'Подключить бота'}<ArrowUpRight size={16}/></a></div></GroupedMenu>;
}
