import React from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {useQueryClient} from '@tanstack/react-query';
import {KeyRound,ShieldCheck,Plus,ScanFace} from 'lucide-react';
import {getPasskeySettings,enrollPasskey,setPwaCabinetLock,passkeysSupported,PasskeyConfirmationStopped,type PasskeySettings} from '../../../../packages/partners/passkeys';
import {unlockPartner,lockPartner,partnerIsUnlocked} from '../../../../packages/partners/biometrics';
import {ApiError,runtime,visitorApi} from '../../../../packages/pulse-data/runtime';
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from '../components/Sheet';
import {Input} from '../components/Input';
import {MenuToggle,MenuButton} from '../components/GroupedMenu';
import {IconTile} from '../components/IconTile';
import {logoutPwa,startPwaTelegramLogin} from './client';
import './pwaPartnerSecurity.css';
function Setup({legacy,busy,run}:{legacy:boolean;busy:boolean;run:(fn:()=>Promise<unknown>)=>void}){
 const [code,setCode]=React.useState('');
 return <>{legacy&&<label className="pwaKeyCode">Код подключения из Telegram<Input aria-label="Код подключения PWA" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,8))} inputMode="numeric" autoComplete="off" maxLength={8}/><small>В защищённом кабинете Telegram откройте «Подключить PWA».</small></label>}<button className="pwaKeyPrimary" disabled={busy||!passkeysSupported()||(legacy&&code.length!==8)} onClick={()=>run(()=>enrollPasskey(legacy?code:undefined))}><KeyRound size={18}/>Создать ключ доступа</button></>;
}
export function PwaPartnerGate({children}:{children:React.ReactNode}){
 const navigate=useNavigate();
 const cache=useQueryClient(),[state,setState]=React.useState<PasskeySettings|null>(null),[open,setOpen]=React.useState(false),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
 const [account,setAccount]=React.useState<{authenticated:boolean;registered:boolean;botUsername:string}|null>(null);
 const [reauthenticate,setReauthenticate]=React.useState(false);
 const unlocked=React.useRef(false),locked=React.useRef(false),autoAttempted=React.useRef(false);
 const clear=()=>{cache.removeQueries({queryKey:['partner-cabinet']});cache.removeQueries({queryKey:['partner-referral']})};
 const load=async()=>{
  if(runtime.publicPreview){
   const result=await visitorApi<{authenticated:boolean;registered:boolean;botUsername:string}>('/me/account');
   setAccount(result);
   if(!result.authenticated||!result.registered)return;
  }
  const s=await getPasskeySettings();
  setState(s);
  if(s.optional&&!s.enabled){unlocked.current=false;setOpen(false);return}
  unlocked.current=s.enabled&&partnerIsUnlocked()&&!document.hidden;
  if(s.enabled&&!unlocked.current&&partnerIsUnlocked())void lockPartner();
  setOpen(unlocked.current);
 };
 const run=async(fn:()=>Promise<unknown>)=>{
  if(locked.current)return;
  locked.current=true;setBusy(true);setError('');setReauthenticate(false);
  try{await fn();if(fn!==load&&fn!==startPwaTelegramLogin)await load()}
  catch(e){
   if(e instanceof PasskeyConfirmationStopped){navigate('/profile',{replace:true});return}
   setReauthenticate(e instanceof ApiError&&e.status===428);
   setError(e instanceof Error?e.message:'Повторите действие');
  }
  finally{locked.current=false;setBusy(false)}
 };
 React.useEffect(()=>{
  void run(load);
  const close=()=>{unlocked.current=false;setOpen(false);clear();void lockPartner()};
  const hide=()=>{if(document.hidden&&unlocked.current)close()};
  document.addEventListener('visibilitychange',hide);window.addEventListener('pulse:partner-locked',close);
  return()=>{unlocked.current=false;document.removeEventListener('visibilitychange',hide);window.removeEventListener('pulse:partner-locked',close);clear();if(partnerIsUnlocked()||locked.current)void lockPartner()};
 },[]);
 React.useEffect(()=>{
  if(!state?.enabled||open||busy||locked.current||autoAttempted.current||!passkeysSupported())return;
  autoAttempted.current=true;
  void run(()=>unlockPartner());
 },[state?.enabled,open,busy]);
 React.useEffect(()=>{if(!open)return;const timer=setTimeout(()=>{unlocked.current=false;setOpen(false);clear();void lockPartner()},9*60000);return()=>clearTimeout(timer)},[open]);
 if(open||state?.optional&&!state.enabled)return <>{children}</>;
 if(!error&&((!state&&(!account||account.registered))||(state?.enabled&&passkeysSupported()&&(!autoAttempted.current||busy)))){
  return <div className="screenLoadState" role="status">Подтверждаем вход…</div>;
 }
 return <section className="pwaKeyGate">
  <IconTile as="div" className="pwaKeyHero"><ShieldCheck/></IconTile>
  <h1>Партнёрский кабинет</h1>
  <p>{account&&!account.authenticated?'Войдите в аккаунт PULSEDV.RU':account&&!account.registered?'Подтвердите номер телефона в мини-аппе PULSEDV.RU':state?.enabled?'Подтвердите вход ключом доступа':'Защитите клиентов и выплаты ключом доступа'}</p>
  {error&&<p role="alert" className="pwaKeyError">{error}</p>}
  {reauthenticate?<button className="pwaKeyPrimary" disabled={busy} onClick={()=>void run(runtime.publicPreview?startPwaTelegramLogin:logoutPwa)}>{runtime.publicPreview?'Подтвердить вход через Telegram':'Подтвердить номер'}</button>
   :account&&!account.authenticated?<button className="pwaKeyPrimary" disabled={busy} onClick={()=>void run(startPwaTelegramLogin)}>Войти через Telegram</button>
   :account&&!account.registered?<>{account.botUsername&&<a className="pwaKeyPrimary" href={'https://t.me/'+account.botUsername+'?startapp=profile'} target="_blank" rel="noopener noreferrer">Открыть мини-апп</a>}<button className="pwaKeySecondary" disabled={busy} onClick={()=>void run(load)}>Я подтвердил номер</button></>
   :!state?<button className="pwaKeyPrimary" disabled={busy} onClick={()=>void run(load)}>{busy?'Проверяем…':'Повторить'}</button>
   :state.enabled?<button className="pwaKeyPrimary" disabled={busy} onClick={()=>void run(()=>unlockPartner())}><KeyRound size={18}/>{busy?'Подтверждаем…':error?'Повторить подтверждение':'Открыть ключом доступа'}</button>
   :<Setup legacy={state.legacyApprovalRequired} busy={busy} run={fn=>void run(fn)}/>}
  {!passkeysSupported()&&<p>Откройте приложение в браузере с поддержкой ключей доступа.</p>}
  <Link to="/profile" className="pwaKeySecondary">Вернуться в профиль</Link>
 </section>;
}
export function PwaSecurityPreferences(){
 const [state,setState]=React.useState<PasskeySettings|null>(null),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[sheet,setSheet]=React.useState(false);
 const lock=React.useRef(false);
 const load=async()=>setState(await getPasskeySettings());
 const run=async(fn:()=>Promise<unknown>)=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await fn();await load()}catch(e){setError(e instanceof Error?e.message:'Повторите действие')}finally{lock.current=false;setBusy(false)}};
 React.useEffect(()=>{void run(load)},[]);
 const toggle=(checked:boolean)=>{
  if(!state)return;
  if(state.keys.length){
   void run(async()=>{if(!checked)await unlockPartner();await setPwaCabinetLock(checked)});
  }else if(checked&&state.optional){
   void run(()=>enrollPasskey());
  }else if(checked){
   setError('');setSheet(true);
  }
 };
 return <>
  <MenuToggle className="pwaAppToggle" icon={<ScanFace/>} title="Face ID или отпечаток" description={!passkeysSupported()?'Ключи доступа недоступны в этом браузере':error&&!sheet?error:'Защита входа в партнёрский кабинет'} label="Защитить партнёрский кабинет в PWA" checked={!!state?.enabled} disabled={busy||!state||!passkeysSupported()} onCheckedChange={toggle}/>
  {runtime.publicPreview&&error.includes('подтвердите вход через Telegram')&&!sheet&&<MenuButton icon={<KeyRound/>} title="Подтвердить вход через Telegram" onClick={()=>void run(startPwaTelegramLogin)}/>}
  {!state&&!busy&&<MenuButton icon={<Plus/>} title="Повторить проверку" onClick={()=>void run(load)}/>}
 <Sheet open={sheet} onOpenChange={v=>{if(!busy)setSheet(v)}}><SheetContent side="bottom" className="pwaKeySheet"><SheetHeader><SheetTitle>Подключить ключ доступа</SheetTitle><SheetDescription>Подтвердите действие через Face ID, отпечаток или код устройства.</SheetDescription></SheetHeader>
  {error&&<p role="alert" className="pwaKeyError">{error}</p>}
  {error.includes('подтвердите номер')&&<button className="pwaKeyPrimary" onClick={()=>void (runtime.publicPreview?run(startPwaTelegramLogin):logoutPwa())}>{runtime.publicPreview?'Подтвердить вход через Telegram':'Подтвердить номер'}</button>}
  {runtime.publicPreview&&error.includes('подтвердите вход через Telegram')&&<button className="pwaKeyPrimary" onClick={()=>void run(startPwaTelegramLogin)}>Подтвердить вход через Telegram</button>}
  <Setup legacy={!!state?.legacyApprovalRequired} busy={busy} run={fn=>void run(async()=>{await fn();setSheet(false)})}/>
 </SheetContent></Sheet></>;
}
