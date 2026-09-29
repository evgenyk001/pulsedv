import React from 'react';
import { LogOut, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { runtime, subscribeRuntime, restoreLogin, login, verifyLogin, setMfa, logout, refreshControl, saveState, discardState, api } from '../../../packages/pulse-data/runtime';

export function useRuntime(){const [,render]=React.useReducer(x=>x+1,0);React.useEffect(()=>subscribeRuntime(render),[]);return runtime;}

export function RuntimeShell({children}:{children:React.ReactNode}){
 const current=useRuntime();const [checking,setChecking]=React.useState(current.enabled);const [busy,setBusy]=React.useState(false);const [error,setError]=React.useState('');
 const [showPassword,setShowPassword]=React.useState(false);const [currentPassword,setCurrentPassword]=React.useState('');const [newPassword,setNewPassword]=React.useState('');
 const [mfaPassword,setMfaPassword]=React.useState('');const [telegramId,setTelegramId]=React.useState('');
 const [email,setEmail]=React.useState('');const [password,setPassword]=React.useState('');
 const [challengeId,setChallengeId]=React.useState('');const [mfaCode,setMfaCode]=React.useState('');const [challengeExpires,setChallengeExpires]=React.useState('');

 React.useEffect(()=>{if(current.enabled)void restoreLogin().catch(()=>{}).finally(()=>setChecking(false));},[]);
 React.useEffect(()=>{if(!current.enabled||!current.member)return;const id=window.setInterval(()=>{if(!document.hidden)void refreshControl().catch(()=>{});},30000);return()=>window.clearInterval(id);},[current.member?.id]);
 React.useEffect(()=>{const guard=(event:BeforeUnloadEvent)=>{if(current.dirty){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[]);
 React.useEffect(()=>{if(showPassword)setTelegramId(current.member?.telegramUserId||'');},[showPassword,current.member?.telegramUserId]);

 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();setBusy(true);setError('');
  try{
   const result=await login(email,password);setPassword('');
   if(result?.mfaRequired&&result.challengeId){setChallengeId(result.challengeId);setChallengeExpires(result.expiresAt||'');setMfaCode('');}
  }catch(e){setError(e instanceof Error?e.message:'Не удалось войти');}
  finally{setBusy(false);}
 };
 const verify=async(e:React.FormEvent)=>{
  e.preventDefault();setBusy(true);setError('');
  try{await verifyLogin(challengeId,mfaCode);setChallengeId('');setChallengeExpires('');setMfaCode('');}
  catch(e){setError(e instanceof Error?e.message:'Не удалось подтвердить вход');}
  finally{setBusy(false);}
 };

 if(checking)return <div className="loginPage"><p>Подключаем PULSE Control…</p></div>;
 if(current.enabled&&!current.member&&challengeId)return <div className="loginPage"><form className="loginCard" onSubmit={verify}>
  <span className="loginMark"><ShieldCheck/></span><span className="kicker">PULSE.DV · 2FA</span><h1>Подтверждение входа</h1>
  <p>Шестизначный код отправлен в Telegram, привязанный к вашему аккаунту.{challengeExpires?' Код действует до '+new Date(challengeExpires).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})+'.':''}</p>
  <label className="controlField"><span>Код из Telegram</span><input inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} value={mfaCode} onChange={e=>setMfaCode(e.target.value.replace(/\D/g,'').slice(0,6))} required autoFocus/></label>
  {error&&<p className="errorNotice" role="alert">{error}</p>}
  <button className="primaryAction" disabled={busy||mfaCode.length!==6}>{busy?'Проверяем…':'Подтвердить'}</button>
  <button type="button" onClick={()=>{setChallengeId('');setChallengeExpires('');setMfaCode('');setError('');}}>Вернуться к входу</button>
 </form></div>;
 if(current.enabled&&!current.member)return <div className="loginPage"><form className="loginCard" onSubmit={submit}><span className="loginMark"><ShieldCheck/></span><span className="kicker">PULSE.DV</span><h1>Вход в Control</h1><p>Рабочее пространство вашей команды.</p><label className="controlField"><span>Электронная почта</span><input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label className="controlField"><span>Пароль</span><input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{error&&<p className="errorNotice" role="alert">{error}</p>}<button className="primaryAction" disabled={busy}>{busy?'Входим…':'Войти'}</button></form></div>;
 return <>
  <div className="runtimeBar">
   <span><i className={current.enabled?'liveDot':'previewDot'}/>{current.enabled?(current.member?.name+' · '+(current.member?.role==='owner'?'Владелец':current.member?.role==='admin'?'Администратор':'Менеджер')):'Демонстрация · данные только в этом браузере'}</span>
   <div>{current.enabled&&<><button style={{width:"auto",padding:"0 9px"}} onClick={()=>{setShowPassword(!showPassword);setError('');setMfaPassword('');}}>Защита</button><small>{current.lastSync?'Обновлено '+new Date(current.lastSync).toLocaleTimeString('ru-RU'):''}</small><button aria-label="Обновить данные" onClick={()=>void refreshControl().catch(()=>{})}><RefreshCw size={16}/></button><button aria-label="Выйти" onClick={()=>{if(!current.dirty||window.confirm('Выйти и потерять несохранённые настройки?'))void logout().catch(e=>setError(e.message));}}><LogOut size={16}/></button></>}</div>
  </div>
  {current.error&&<div className="runtimeError" role="alert">{current.error}</div>}
  {current.snapshot.limited&&<div className="runtimeError">Показаны последние записи. Статистика списка ограничена загруженной выборкой.</div>}
  {current.dirty&&<div className="saveBar"><div><b>Есть несохранённые настройки</b><small>Они появятся в мини‑аппе после сохранения.</small></div><button disabled={current.saving} onClick={()=>{if(window.confirm('Отменить несохранённые изменения?'))void discardState().catch(()=>{});}}>Отменить</button><button className="primaryAction" disabled={current.saving} onClick={()=>void saveState().catch(()=>{})}><Save size={16}/>{current.saving?'Сохраняем…':'Сохранить'}</button></div>}
  {showPassword&&<div className="drawerBackdrop"><div className="detailDrawer">
   <h2>Защита аккаунта</h2>
   <p>Пароль и двухэтапный вход управляются отдельно. Для изменения потребуется текущий пароль.</p>
   <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await api('/control/password',{method:'POST',body:JSON.stringify({currentPassword,newPassword})});setCurrentPassword('');setNewPassword('');setShowPassword(false);runtime.member=null;runtime.ready=false;}catch(err){setError(err instanceof Error?err.message:'Ошибка');}finally{setBusy(false);}}}>
    <h3>Сменить пароль</h3>
    <label className="controlField"><span>Текущий пароль</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} required/></label>
    <label className="controlField"><span>Новый пароль · от 14 символов</span><input type="password" autoComplete="new-password" value={newPassword} minLength={14} onChange={e=>setNewPassword(e.target.value)} required/></label>
    <button className="primaryAction" disabled={busy}>Сменить пароль</button>
   </form>
   <hr/>
   <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{const enable=!current.member?.mfaEnabled;await setMfa(enable,mfaPassword,enable?telegramId.trim():undefined);setMfaPassword('');setError(enable?'Двухэтапный вход включён. Следующий вход потребует код из Telegram.':'Двухэтапный вход выключен.');}catch(err){setError(err instanceof Error?err.message:'Ошибка');}finally{setBusy(false);}}}>
    <h3>Двухэтапный вход · {current.member?.mfaEnabled?'включён':'выключен'}</h3>
    <p>{current.member?.mfaEnabled?'После пароля потребуется одноразовый код из Telegram.':'Рекомендуется для владельца и администраторов с доступом к клиентским данным.'}</p>
    {!current.member?.mfaEnabled&&<label className="controlField"><span>Ваш Telegram ID</span><input inputMode="numeric" pattern="\d{1,16}" value={telegramId} onChange={e=>setTelegramId(e.target.value.replace(/\D/g,'').slice(0,16))} required/></label>}
    <label className="controlField"><span>Текущий пароль</span><input type="password" autoComplete="current-password" value={mfaPassword} onChange={e=>setMfaPassword(e.target.value)} required/></label>
    <button className="primaryAction" disabled={busy}>{current.member?.mfaEnabled?'Выключить 2FA':'Включить 2FA через Telegram'}</button>
   </form>
   {error&&<p className={error.includes('включён')||error.includes('выключен')?'':'errorNotice'} role="status">{error}</p>}
   <button type="button" onClick={()=>{setShowPassword(false);setError('');}}>Закрыть</button>
  </div></div>}
  {children}
 </>;
}
