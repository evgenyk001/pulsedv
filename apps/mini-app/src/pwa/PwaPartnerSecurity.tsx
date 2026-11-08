import React from 'react';
import {Link} from 'react-router-dom';
import {useQueryClient} from '@tanstack/react-query';
import {KeyRound,ShieldCheck,Plus,Trash2,ScanFace} from 'lucide-react';
import {getPasskeySettings,enrollPasskey,removePasskey,passkeysSupported,type PasskeySettings} from '../../../../packages/partners/passkeys';
import {unlockPartner,lockPartner,partnerIsUnlocked} from '../../../../packages/partners/biometrics';
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from '../components/Sheet';
import {Input} from '../components/Input';
import {GroupedMenu,MenuToggle,MenuButton} from '../components/GroupedMenu';
import {IconTile} from '../components/IconTile';
import {logoutPwa} from './client';
import './pwaPartnerSecurity.css';
function Setup({legacy,busy,run}:{legacy:boolean;busy:boolean;run:(fn:()=>Promise<unknown>)=>void}){
 const [code,setCode]=React.useState('');
 return <>{legacy&&<label className="pwaKeyCode">Код подключения из Telegram<Input aria-label="Код подключения PWA" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,8))} inputMode="numeric" autoComplete="off" maxLength={8}/><small>В защищённом кабинете Telegram откройте «Подключить PWA».</small></label>}<button className="pwaKeyPrimary" disabled={busy||!passkeysSupported()||(legacy&&code.length!==8)} onClick={()=>run(()=>enrollPasskey(legacy?code:undefined))}><KeyRound size={18}/>Создать ключ доступа</button></>;
}
export function PwaPartnerGate({children}:{children:React.ReactNode}){
 const cache=useQueryClient(),[state,setState]=React.useState<PasskeySettings|null>(null),[open,setOpen]=React.useState(false),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
 const clear=()=>{cache.removeQueries({queryKey:['partner-cabinet']});cache.removeQueries({queryKey:['partner-referral']})};
 const load=async()=>{const s=await getPasskeySettings();setState(s);setOpen(s.enabled&&partnerIsUnlocked())};
 const run=async(fn:()=>Promise<unknown>)=>{if(busy)return;setBusy(true);setError('');try{await fn();await load()}catch(e){setError(e instanceof Error?e.message:'Повторите действие')}finally{setBusy(false)}};
 React.useEffect(()=>{void run(load);const close=()=>{setOpen(false);clear();void lockPartner()};const hide=()=>{if(document.hidden)close()};document.addEventListener('visibilitychange',hide);window.addEventListener('pulse:partner-locked',close);return()=>{document.removeEventListener('visibilitychange',hide);window.removeEventListener('pulse:partner-locked',close);clear();void lockPartner()}},[]);
 React.useEffect(()=>{if(!open)return;const timer=setTimeout(()=>{setOpen(false);clear();void lockPartner()},9*60000);return()=>clearTimeout(timer)},[open]);
 if(open)return <>{children}</>;
 return <section className="pwaKeyGate"><IconTile as="div" className="pwaKeyHero"><ShieldCheck/></IconTile><h1>Партнёрский кабинет</h1><p>{state?.enabled?'Подтвердите вход ключом доступа':'Защитите клиентов и выплаты ключом доступа'}</p>{error&&<p role="alert" className="pwaKeyError">{error}</p>}{!state?<button className="pwaKeyPrimary" disabled={busy} onClick={()=>void run(load)}>{busy?'Проверяем…':'Повторить'}</button>:state.enabled?<button className="pwaKeyPrimary" disabled={busy} onClick={()=>void run(()=>unlockPartner())}><KeyRound size={18}/>{busy?'Подтверждаем…':'Открыть кабинет'}</button>:<Setup legacy={state.legacyApprovalRequired} busy={busy} run={fn=>void run(fn)}/>}{!passkeysSupported()&&<p>Откройте приложение в Safari или Chrome с поддержкой ключей доступа.</p>}{(error.includes('SMS')||error.includes('подтвердите номер'))&&<button className="pwaKeySecondary" onClick={()=>void logoutPwa()}>Подтвердить номер</button>}<Link to="/profile" className="pwaKeySecondary">Вернуться в профиль</Link></section>;
}
export function PwaSecurityPreferences(){
 const [state,setState]=React.useState<PasskeySettings|null>(null),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[remove,setRemove]=React.useState<string|null>(null),[sheet,setSheet]=React.useState(false);
 const lock=React.useRef(false);
 const load=async()=>setState(await getPasskeySettings());
 const run=async(fn:()=>Promise<unknown>)=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await fn();await load()}catch(e){setError(e instanceof Error?e.message:'Повторите действие')}finally{lock.current=false;setBusy(false)}};
 React.useEffect(()=>{void run(load)},[]);
 const open=()=>{setError('');setRemove(null);setSheet(true)};
 return <><GroupedMenu title="Защита партнёрского кабинета" caption={!passkeysSupported()?'Ключи доступа недоступны в этом браузере.':error&&!sheet?error:undefined}>
  <MenuToggle icon={<ScanFace/>} title="Face ID или отпечаток" description="Клиенты и выплаты под защитой" label="Защитить партнёрский кабинет в PWA" checked={!!state?.enabled} disabled={busy||!state||!passkeysSupported()} onCheckedChange={open}/>
  {state?.enabled&&<MenuButton icon={<KeyRound/>} title="Устройства и ключи" value={String(state.keys.length)} onClick={open} disabled={busy}/>}
  {!state&&!busy&&<MenuButton icon={<Plus/>} title="Повторить проверку" onClick={()=>void run(load)}/>}
 </GroupedMenu>
 <Sheet open={sheet} onOpenChange={v=>{if(!busy){setSheet(v);setRemove(null)}}}><SheetContent side="bottom" className="pwaKeySheet"><SheetHeader><SheetTitle>{remove?'Удалить ключ доступа?':state?.enabled?'Ключи доступа':'Защита кабинета'}</SheetTitle><SheetDescription>{remove?'Для следующего входа останутся другие ключи или подтверждение телефона.':'Подтвердите действие через Face ID, отпечаток или код устройства.'}</SheetDescription></SheetHeader>
  {error&&<p role="alert" className="pwaKeyError">{error}</p>}
  {(error.includes('SMS')||error.includes('подтвердите номер'))&&<button className="pwaKeyPrimary" onClick={()=>void logoutPwa()}>Подтвердить номер</button>}
  {remove?<div className="pwaKeySheetActions"><button className="pwaKeyPrimary" disabled={busy} onClick={()=>void run(async()=>{await unlockPartner();await removePasskey(remove);setRemove(null)})}>{busy?'Подтверждаем…':'Удалить ключ'}</button><button className="pwaKeySecondary" disabled={busy} onClick={()=>setRemove(null)}>Отмена</button></div>:state?.enabled?<><GroupedMenu>{state.keys.map((k,i)=><MenuButton key={k.id} icon={<KeyRound/>} title={'Ключ доступа '+(i+1)} description={'Добавлен '+new Date(k.createdAt).toLocaleDateString('ru-RU')} disabled={busy} onClick={()=>setRemove(k.id)}/>)}</GroupedMenu><button className="pwaKeyPrimary" disabled={busy||state.keys.length>=5} onClick={()=>void run(async()=>{await unlockPartner();await enrollPasskey()})}><Plus size={18}/>Добавить ключ</button></>:<Setup legacy={!!state?.legacyApprovalRequired} busy={busy} run={fn=>void run(async()=>{await fn();setSheet(false)})}/>}
 </SheetContent></Sheet></>;
}
