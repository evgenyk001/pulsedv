import {dismissLaunchScreen} from '../helpers/launchScreen';
import React from 'react';
import {InstallationScreen} from './InstallationScreen';
import {appleDevice,standalone,install,canInstall,isPwa} from './client';
import './pwa.css';
export function InstallGate({children}:{children:React.ReactNode}){
 const [,redraw]=React.useReducer(n=>n+1,0);const [error,setError]=React.useState('');
 React.useEffect(()=>{dismissLaunchScreen();const changed=()=>redraw();const mode=matchMedia('(display-mode: standalone)');mode.addEventListener('change',changed);window.addEventListener('appinstalled',changed);window.addEventListener('pulse:install-available',changed);window.addEventListener('hashchange',changed);return()=>{mode.removeEventListener('change',changed);window.removeEventListener('appinstalled',changed);window.removeEventListener('pulse:install-available',changed);window.removeEventListener('hashchange',changed)}},[]);
 const path=(location.hash.slice(1)||'/').split('?')[0];
 const mobile=appleDevice()||/Android/i.test(navigator.userAgent);
 if(!isPwa||standalone()||!mobile||['/privacy','/personal-data-consent'].includes(path))return children;
 const platform=appleDevice()?'ios':/Android/i.test(navigator.userAgent)?'android':'desktop';
 return <InstallationScreen platform={platform} installAvailable={canInstall()} onInstall={()=>void install().catch(()=>setError('Откройте меню браузера и выберите установку приложения.'))} inApp={/Telegram|FBAN|FBAV|Instagram/i.test(navigator.userAgent)} error={error}/>;
}
