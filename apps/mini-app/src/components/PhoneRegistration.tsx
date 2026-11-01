import React from 'react';
import {runtime,visitorApi} from '../../../../packages/pulse-data/runtime';
import {prepareTelegramWindow} from '../helpers/telegramWindow';
import './phoneRegistration.css';
export function PhoneRegistration({onRegistered}:{onRegistered:()=>void}){
 const [busy,setBusy]=React.useState(false),[consent,setConsent]=React.useState(false),[error,setError]=React.useState('');
 const active=React.useRef(true);
 React.useEffect(()=>()=>{active.current=false},[]);
 const submit=async()=>{
  if(busy||!consent)return;
  const tg=(window as any).Telegram?.WebApp;
  if(!tg?.initData||typeof tg.requestContact!=='function'){setError('Откройте PULSEDV.RU через бота в мобильном Telegram.');return;}
  setBusy(true);setError('');
  try{
   await visitorApi('/me/account/contact-request',{method:'POST',body:JSON.stringify({consent:true,consentVersion:runtime.consentVersion})});
   const sent=await new Promise<boolean>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Запрос номера не завершён. Попробуйте ещё раз.')),60000);try{tg.requestContact((ok:boolean)=>{clearTimeout(timer);resolve(ok)})}catch(e){clearTimeout(timer);reject(e)}});
   for(let i=0;i<(sent?20:1);i++){
    const account=await visitorApi<{registered:boolean}>('/me/account');
    if(account.registered){onRegistered();return;}
    if(!active.current)return;
    if(sent)await new Promise(r=>setTimeout(r,1000));
   }
   throw Error(sent?'Номер ещё обрабатывается. Нажмите кнопку повторно через несколько секунд.':'Без передачи своего номера вход недоступен.');
  }catch(e){if(active.current)setError(e instanceof Error?e.message:'Не удалось подтвердить номер')}finally{if(active.current)setBusy(false)}
 };
 React.useEffect(()=>{active.current=true;prepareTelegramWindow((window as any).Telegram?.WebApp)},[]);
 const tg=(window as any).Telegram?.WebApp;
 return <main className="phoneRegistration"><section aria-labelledby="phone-entry-title"><header><img src={import.meta.env.BASE_URL+'pulse-app-180-v3.png'} alt=""/><span>PULSEDV.RU<small>Новостройки Приморья</small></span></header><div className="phoneRegistrationBadge">Ваш личный аккаунт</div><h1 id="phone-entry-title">Ваш новый дом<br/>начинается здесь</h1><p>Подтвердите номер в Telegram, чтобы войти в PULSE.</p><ul className="phoneRegistrationBenefits"><li>Подборки и избранное всегда под рукой</li><li>Общение с менеджером в одном месте</li></ul><div className="phoneRegistrationAction"><label><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/><span>Соглашаюсь на обработку персональных данных для регистрации и связи по моим обращениям.</span></label>{error&&<p role="alert">{error}</p>}{tg?.initData?<button disabled={busy||!consent} onClick={()=>void submit()}>{busy?'Подтверждаем номер…':'Поделиться номером и войти'}</button>:<a className="phoneRegistrationOpen" href="https://t.me/pulsedvbot">Открыть в Telegram</a>}<p className="phoneRegistrationHint">Номер передаст Telegram после вашего подтверждения.</p></div><nav aria-label="Документы"><a href="#/personal-data-consent">Условия обработки данных</a><a href="#/privacy">Политика конфиденциальности</a></nav></section></main>;
}
