import React from 'react';
import {SafariShare,SafariAddHome,AndroidMenu,AndroidInstall} from './InstallationIcons';
import './pwa.css';
export type InstallationPlatform='ios'|'android'|'desktop';
export function InstallationScreen({platform,installAvailable=false,onInstall,error='',inApp=false}:{platform:InstallationPlatform;installAvailable?:boolean;onInstall?:()=>void;error?:string;inApp?:boolean}){
 const ios=platform==='ios';
 return <main className="pwaInstall" data-install-platform={platform}>
  <div className="pwaInstall__phone" aria-hidden="true"><span className="pwaInstall__island"/><div className="pwaInstall__grid">{Array.from({length:16},(_,i)=><span key={i}/>)}</div><img src={import.meta.env.BASE_URL+'pulse-app-180-v3.png'} alt=""/></div>
  <h1>Добавьте PULSEDV.RU<br/>{ios?'на экран «Домой»':'на главный экран'}</h1>
  <ol className="pwaInstall__steps">{ios?<><li><span>1.</span><span>В меню Safari нажмите <strong><SafariShare/> «Поделиться»</strong></span></li><li><span>2.</span><span>Выберите <strong className="pwaInstall__action"><SafariAddHome/><span>«Добавить на экран Домой»</span></strong></span></li></>:<><li><span>1.</span><span>{installAvailable?<>Нажмите <AndroidInstall/> «Установить приложение»</>:<>Откройте меню <AndroidMenu/> браузера</>}</span></li><li><span>2.</span><span>{installAvailable?'Подтвердите установку':<>Выберите <AndroidInstall/> «Установить приложение» или «Добавить на главный экран»</>}</span></li></>}</ol>
  {!ios&&installAvailable&&<button className="pwaButton" onClick={onInstall}>Установить приложение <AndroidInstall/></button>}
  {inApp&&<p className="pwaInstall__tip">Для установки откройте эту страницу {ios?'в Safari':'во внешнем браузере'}.</p>}
  {error&&<p className="pwaError" role="alert">{error}</p>}
 </main>;
}
