import {LoadRecovery} from './LoadRecovery';
import React from 'react';
import {Link} from 'react-router-dom';
import {useQueryClient} from '@tanstack/react-query';
import {ScanFace,ShieldCheck} from 'lucide-react';
import {biometricManager,securitySettings,enablePartnerBiometrics,disablePartnerBiometrics,unlockPartner,lockPartner,partnerIsUnlocked} from '../../../../packages/partners/biometrics';
import {visitorApi} from '../../../../packages/pulse-data/runtime';
import {ensureAnnouncementWriteAccess} from '../../../../packages/broadcasts/telegramPermission';
import {GroupedMenu} from './GroupedMenu';
import {IconTile} from './IconTile';
import {Switch} from './Switch';
import './announcementPreferences.css';
export function PartnerSecurityPreferences(){
 const [state,setState]=React.useState({enabled:false,authenticated:false,available:false}),[busy,setBusy]=React.useState(true),[error,setError]=React.useState(''),[loadFailed,setLoadFailed]=React.useState(false),[attempt,setAttempt]=React.useState(0);
 React.useEffect(()=>{let active=true;setBusy(true);setLoadFailed(false);Promise.all([securitySettings(),biometricManager()]).then(([s,m])=>{if(active)setState({...s,available:!!m?.isBiometricAvailable})}).catch(()=>{if(active)setLoadFailed(true)}).finally(()=>{if(active)setBusy(false)});return()=>{active=false}},[attempt]);
 const change=async(enabled:boolean)=>{setBusy(true);setError('');try{if(enabled){await ensureAnnouncementWriteAccess((window as any).Telegram?.WebApp).catch(()=>{throw Error('Для восстановления доступа разрешите боту писать вам в Telegram')});await enablePartnerBiometrics()}else await disablePartnerBiometrics();setState(v=>({...v,enabled}))}catch(e){setError(e instanceof Error?e.message:'Не удалось изменить настройку')}finally{setBusy(false)}};
 return <GroupedMenu title="Защита партнёрского кабинета" caption={error||(!state.authenticated||!state.available?'Face ID или отпечаток доступны в мобильном Telegram на поддерживаемом устройстве.':'Проверка при входе в кабинет и изменении данных для выплаты.')}>
  <div className="announcementPreference"><IconTile><ScanFace size={20}/></IconTile><span className="announcementPreferenceCopy"><b>Face ID или отпечаток</b><small>Клиенты и выплаты под защитой</small></span><Switch aria-label="Защитить партнёрский кабинет" checked={state.enabled} disabled={busy||!state.authenticated||!state.available} onCheckedChange={v=>void change(v)}/></div>
  {loadFailed&&<LoadRecovery label="Обновить настройку защиты" onRetry={()=>setAttempt(v=>v+1)}/>}
 </GroupedMenu>;
}
export function PartnerSecurityGate({children}:{children:React.ReactNode}){
 const cache=useQueryClient(),[ready,setReady]=React.useState(false),[enabled,setEnabled]=React.useState(false),[open,setOpen]=React.useState(false),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[recovery,setRecovery]=React.useState(false),[code,setCode]=React.useState('');
 const autoAttempt=React.useRef(false);
 const [autoBusy,setAutoBusy]=React.useState(false);
 const enabledRef=React.useRef(enabled);enabledRef.current=enabled;
 const clearCache=()=>{cache.removeQueries({queryKey:['partner-cabinet']});cache.removeQueries({queryKey:['partner-referral']})};
 const load=async()=>{setError('');try{const s=await securitySettings();setEnabled(s.enabled);setOpen(!s.enabled||partnerIsUnlocked());setReady(true)}catch{setError('Попробуйте открыть кабинет ещё раз.')}};
 React.useEffect(()=>{void load();const hide=()=>{if(document.visibilityState==='hidden'&&enabledRef.current){setOpen(false);clearCache();void lockPartner();}};const expired=()=>{setOpen(false);clearCache()};document.addEventListener('visibilitychange',hide);window.addEventListener('pulse:partner-locked',expired);return()=>{document.removeEventListener('visibilitychange',hide);window.removeEventListener('pulse:partner-locked',expired);clearCache();void lockPartner()}},[]);
 React.useEffect(()=>{if(!open||!enabled)return;const id=setTimeout(()=>{setOpen(false);clearCache();void lockPartner()},9*60000);return()=>clearTimeout(id)},[open,enabled]);
 const run=async(fn:()=>Promise<unknown>)=>{setBusy(true);setError('');try{await fn()}catch(e){setError(e instanceof Error?e.message:'Не удалось подтвердить действие')}finally{setBusy(false)}};
 React.useEffect(()=>{
  if(!ready||!enabled||open||autoAttempt.current)return;
  autoAttempt.current=true;setAutoBusy(true);setError('');
  void unlockPartner().then(()=>setOpen(true)).catch(e=>setError(e instanceof Error?e.message:'Не удалось подтвердить вход')).finally(()=>setAutoBusy(false));
 },[ready,enabled,open]);
 if(ready&&open)return <>{children}</>;
 if(!ready||autoBusy||(enabled&&!autoAttempt.current))return <div className="screenLoadState" role="status">Подтверждаем вход…</div>;
 return <section className="partnerSecurityGate" aria-label="Защита партнёрского кабинета"><IconTile><ShieldCheck size={24}/></IconTile><h1>Партнёрский кабинет</h1><p>{ready?'Подтвердите вход, чтобы открыть клиентов и выплаты.':'Проверяем защиту…'}</p>{error&&<p role="alert">{error}</p>}
  {!ready?<button disabled={busy} onClick={()=>void run(load)}>Повторить проверку</button>:<><button disabled={busy} onClick={()=>void run(async()=>{await unlockPartner();setOpen(true)})}>{busy?'Подтверждаем…':'Войти по Face ID или отпечатку'}</button><button className="partnerSecuritySecondary" disabled={busy} onClick={()=>void run(async()=>{await visitorApi('/me/partner-security/recovery',{method:'POST',body:'{}'});setRecovery(true)})}>Восстановить доступ через Telegram</button>
  {recovery&&<form onSubmit={e=>{e.preventDefault();void run(async()=>{await visitorApi('/me/partner-security/recover',{method:'POST',body:JSON.stringify({code})});setEnabled(false);setOpen(true)})}}><p>Запрос кода принят. Дождитесь сообщения от бота. Код отключит защиту кабинета — её можно включить снова в профиле.</p><label>Код из Telegram<input aria-label="Код восстановления" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></label><button disabled={busy||code.length!==6}>Подтвердить восстановление</button></form>}</>}
  <Link to="/profile">Вернуться в профиль</Link>
 </section>;
}
