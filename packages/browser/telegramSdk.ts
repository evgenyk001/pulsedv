import {safeSessionStorage} from './storage';
let pending:Promise<void>|null=null;
const message='Не удалось подключить Telegram. Повторите загрузку.';

function telegramLaunchExpected(){
 const params=new URLSearchParams(window.location.search);
 const hash=new URLSearchParams(window.location.hash.replace(/^#(?:\/?\?)?/,''));
 if(['tgWebAppData','tgWebAppVersion','tgWebAppPlatform'].some(key=>params.has(key)||hash.has(key)))return true;
 // Telegram itself caches its launch parameters before a HashRouter navigation/reload.
 try{if(JSON.parse(safeSessionStorage.getItem('__telegram__initParams')||'null')?.tgWebAppData)return true}catch{}
 const host=window as any;
 return !!host.TelegramWebviewProxy||typeof host.external?.notify==='function';
}

// Public API reads may start immediately. Wait only before binding the Telegram identity.
export function loadTelegramSdk():Promise<void>{
 if(typeof document==='undefined')return Promise.resolve();
 const existing=document.getElementById('pulse-telegram-sdk') as HTMLScriptElement|null;
 if((window as any).Telegram?.WebApp||existing?.dataset.state==='ready')return Promise.resolve();
 // Ordinary browser visits do not require Telegram or wait for its CDN.
 if(!telegramLaunchExpected())return Promise.resolve();
 if(pending)return pending;
 pending=new Promise<void>((resolve,reject)=>{
  let script=existing;
  if(!script||script.dataset.state==='error'){
   script?.remove();script=document.createElement('script');script.id='pulse-telegram-sdk';
   script.src='https://telegram.org/js/telegram-web-app.js'+(existing?'?pulse_retry='+Date.now():'');script.async=true;
  }
  const target=script;
  const clean=()=>{window.clearTimeout(timer);target.removeEventListener('load',loaded);target.removeEventListener('error',failed)};
  const loaded=()=>{clean();target.dataset.state='ready';window.dispatchEvent(new Event('pulse:telegram-sdk-ready'));resolve()};
  const failed=()=>{clean();target.dataset.state='error';reject(new Error(message))};
  const timer=window.setTimeout(failed,8000);
  target.addEventListener('load',loaded,{once:true});target.addEventListener('error',failed,{once:true});
  if(!target.isConnected)document.head.append(target);
 });
 const current=pending;
 void current.then(()=>{pending=null},()=>{pending=null});
 return current;
}
