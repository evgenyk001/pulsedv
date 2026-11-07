import {dismissLaunchScreen} from '../helpers/launchScreen';
import React from 'react';
import {SafariShare,SafariAddHome,AndroidMenu,AndroidInstall} from './InstallationIcons';
import {appleDevice,standalone,install,canInstall,isPwa} from './client';
import './pwa.css';
export function InstallGate({children}:{children:React.ReactNode}){
 const [,redraw]=React.useReducer(n=>n+1,0);const [error,setError]=React.useState('');
 React.useEffect(()=>{dismissLaunchScreen();const changed=()=>redraw();const mode=matchMedia('(display-mode: standalone)');mode.addEventListener('change',changed);window.addEventListener('appinstalled',changed);window.addEventListener('pulse:install-available',changed);window.addEventListener('hashchange',changed);return()=>{mode.removeEventListener('change',changed);window.removeEventListener('appinstalled',changed);window.removeEventListener('pulse:install-available',changed);window.removeEventListener('hashchange',changed)}},[]);
 const path=(location.hash.slice(1)||'/').split('?')[0];
 if(!isPwa||standalone()||['/privacy','/personal-data-consent'].includes(path))return children;
 const ios=appleDevice();
 return <main className="pwaInstall">
  <div className="pwaInstall__phone" aria-hidden="true"><span className="pwaInstall__island"/><div className="pwaInstall__grid">{Array.from({length:16},(_,i)=><span key={i}/>)}</div><img src={import.meta.env.BASE_URL+'pulse-app-180-v3.png'} alt=""/></div>
  <h1>Добавьте PULSEDV.RU<br/>{ios?'на экран «Домой»':'на главный экран'}</h1>
  <ol className="pwaInstall__steps">{ios?<><li><span>1.</span><span>В меню Safari нажмите <strong><SafariShare/> «Поделиться»</strong></span></li><li><span>2.</span><span>Выберите <strong><SafariAddHome/> Добавить на экран «Домой»</strong></span></li></>:<><li><span>1.</span><span>{canInstall()?<>Нажмите <AndroidInstall/> «Установить приложение»</>:<>Откройте меню <AndroidMenu/> браузера</>}</span></li><li><span>2.</span><span>{canInstall()?'Подтвердите установку':<>Выберите <AndroidInstall/> «Установить приложение» или «Добавить на главный экран»</>}</span></li></>}</ol>
  {!ios&&canInstall()&&<button className="pwaButton" onClick={()=>void install().catch(()=>setError('Откройте меню браузера и выберите установку приложения.'))}>Установить приложение <AndroidInstall/></button>}
  <p className="pwaInstall__hint">Затем откройте приложение с новой иконки.</p>
  {ios&&/Telegram|FBAN|FBAV|Instagram/i.test(navigator.userAgent)&&<p className="pwaInstall__tip">Для установки откройте эту страницу в Safari.</p>}
  {error&&<p className="pwaError" role="alert">{error}</p>}
 </main>;
}
