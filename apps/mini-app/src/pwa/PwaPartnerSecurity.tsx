import React from 'react';
import {Link} from 'react-router-dom';
import {useQueryClient} from '@tanstack/react-query';
import {KeyRound,ShieldCheck,Plus,Trash2} from 'lucide-react';
import {getPasskeySettings,enrollPasskey,removePasskey,passkeysSupported,type PasskeySettings} from '../../../../packages/partners/passkeys';
import {unlockPartner,lockPartner,partnerIsUnlocked} from '../../../../packages/partners/biometrics';
import {GroupedMenu} from '../components/GroupedMenu';
import {IconTile} from '../components/IconTile';
import {logoutPwa} from './client';
import './pwaPartnerSecurity.css';
function Setup({legacy,busy,run}:{legacy:boolean;busy:boolean;run:(fn:()=>Promise<unknown>)=>void}){
 const [code,setCode]=React.useState('');
 return <>{legacy&&<label className="pwaKeyCode">Код подключения из Telegram<input aria-label="Код подключения PWA" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,8))} inputMode="numeric" autoComplete="off" maxLength={8}/><small>В защищённом кабинете Telegram откройте «Подключить PWA».</small></label>}<button className="pwaKeyPrimary" disabled={busy||!passkeysSupported()||(legacy&&code.length!==8)} onClick={()=>run(()=>enrollPasskey(legacy?code:undefined))}><KeyRound size={18}/>Создать ключ доступа</button></>;
}
export function PwaPartnerGate({children}:{children:React.ReactNode}){
 const cache=useQueryClient(),[state,setState]=React.useState<PasskeySettings|null>(null),[open,setOpen]=React.useState(false),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
 const clear=()=>{cache.removeQueries({queryKey:['partner-cabinet']});cache.removeQueries({queryKey:['partner-referral']})};
 const load=async()=>{const s=await getPasskeySettings();setState(s);setOpen(s.enabled&&partnerIsUnlocked())};
 const run=async(fn:()=>Promise<unknown>)=>{if(busy)return;setBusy(true);setError('');try{await fn();await load()}catch(e){setError(e instanceof Error?e.message:'Повторите действие')}finally{setBusy(false)}};
 React.useEffect(()=>{void run(load);const close=()=>{setOpen(false);clear();void lockPartner()};const hide=()=>{if(document.hidden)close()};document.addEventListener('visibilitychange',hide);window.addEventListener('pulse:partner-locked',close);return()=>{document.removeEventListener('visibilitychange',hide);window.removeEventListener('pulse:partner-locked',close);clear();void lockPartner()}},[]);
 React.useEffect(()=>{if(!open)return;const timer=setTimeout(()=>{setOpen(false);clear();void lockPartner()},9*60000);return()=>clearTimeout(timer)},[open]);
 if(open)return <>{children}</>;
 return <section className="pwaKeyGate"><div className="pwaKeyHero"><ShieldCheck size={34}/></div><h1>Партнёрский кабинет</h1><p>{state?.enabled?'Подтвердите вход ключом доступа':'Защитите клиентов и выплаты ключом доступа'}</p>{error&&<p role="alert" className="pwaKeyError">{error}</p>}{!state?<button className="pwaKeyPrimary" disabled={busy} onClick={()=>void run(load)}>{busy?'Проверяем…':'Повторить'}</button>:state.enabled?<button className="pwaKeyPrimary" disabled={busy} onClick={()=>void run(()=>unlockPartner())}><KeyRound size={18}/>{busy?'Подтверждаем…':'Открыть кабинет'}</button>:<Setup legacy={state.legacyApprovalRequired} busy={busy} run={fn=>void run(fn)}/>}{!passkeysSupported()&&<p>Откройте приложение в Safari или Chrome с поддержкой ключей доступа.</p>}{error.includes('SMS')&&<button className="pwaKeySecondary" onClick={()=>void logoutPwa()}>Войти заново по SMS</button>}<Link to="/profile" className="pwaKeySecondary">Вернуться в профиль</Link></section>;
}
export function PwaSecurityPreferences(){
 const [state,setState]=React.useState<PasskeySettings|null>(null),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[remove,setRemove]=React.useState<string|null>(null);
 const load=async()=>setState(await getPasskeySettings());
 const run=async(fn:()=>Promise<unknown>)=>{if(busy)return;setBusy(true);setError('');try{await fn();await load()}catch(e){setError(e instanceof Error?e.message:'Повторите действие')}finally{setBusy(false)}};
 React.useEffect(()=>{void run(load)},[]);
 return <GroupedMenu title="Ключи доступа" caption={error||'Вход и защита кабинета через Face ID, отпечаток или код устройства.'}><div className="pwaKeySettings">{error&&<span role="alert" className="sr-only">{error}</span>}{error.includes('SMS')&&<button className="pwaKeySecondary" onClick={()=>void logoutPwa()}>Войти заново по SMS</button>}{!state?<button disabled={busy} className="pwaKeySecondary" onClick={()=>void run(load)}>Обновить</button>:<>{state.keys.map((k,i)=><div className="pwaKeyRow" key={k.id}><IconTile><KeyRound size={20}/></IconTile><span><b>Ключ доступа {i+1}</b><small>{new Date(k.createdAt).toLocaleDateString('ru-RU')}</small></span><button className="pwaKeyDelete" disabled={busy} aria-label={'Удалить ключ '+(i+1)} onClick={()=>setRemove(k.id)}><Trash2 size={18}/></button></div>)}{remove&&<div className="pwaKeyRemoval" role="alert"><p>Удалить ключ? Для следующего входа останутся другие ключи или SMS.</p><button disabled={busy} onClick={()=>void run(async()=>{await unlockPartner();await removePasskey(remove);setRemove(null)})}>Удалить</button><button disabled={busy} onClick={()=>setRemove(null)}>Отмена</button></div>}{state.enabled?<button className="pwaKeySecondary" disabled={busy||state.keys.length>=5} onClick={()=>void run(async()=>{await unlockPartner();await enrollPasskey()})}><Plus size={17}/>Добавить ключ</button>:<Setup legacy={state.legacyApprovalRequired} busy={busy} run={fn=>void run(fn)}/>}</>}</div></GroupedMenu>;
}
