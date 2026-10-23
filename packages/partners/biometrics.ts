import {runtime,visitorApi} from '../pulse-data/runtime';
import {partnerGrant,setPartnerGrant} from './securityState';
export type BiometricManager={isInited:boolean;isBiometricAvailable:boolean;biometricType:string;isAccessGranted:boolean;isBiometricTokenSaved:boolean;deviceId:string;init:(callback:()=>void)=>unknown;requestAccess:(params:{reason:string},callback:(ok:boolean)=>void)=>unknown;authenticate:(params:{reason:string},callback:(ok:boolean,token?:string)=>void)=>unknown;updateBiometricToken:(token:string,callback:(ok:boolean)=>void)=>unknown;openSettings:()=>unknown};
export function biometricCall<T>(call:(finish:(v:T)=>void)=>unknown,timeout=45000):Promise<T>{return new Promise((resolve,reject)=>{let settled=false;const timer=setTimeout(()=>{settled=true;reject(Error('Telegram не подтвердил действие. Попробуйте ещё раз'))},timeout);try{call(value=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value)})}catch(e){settled=true;clearTimeout(timer);reject(e)}})}
export async function biometricManager():Promise<BiometricManager|null>{
 const app=(window as any).Telegram?.WebApp;
 if(!app?.initData||(app.isVersionAtLeast&&!app.isVersionAtLeast('7.2')))return null;
 const manager=app.BiometricManager as BiometricManager|undefined;if(!manager)return null;
 if(!manager.isInited)await biometricCall<void>(done=>manager.init(()=>done()));return manager;
}
export async function authenticateBiometric(m:BiometricManager,reason:string){
 if(!m.isBiometricAvailable||!m.isAccessGranted)throw Error('Разрешите биометрию в настройках Telegram или восстановите доступ через код');
 const result=await biometricCall<{ok:boolean;token?:string}>(done=>m.authenticate({reason},(ok,token)=>done({ok,token})));
 if(!result.ok||!result.token)throw Error('Проверка не завершена. Попробуйте ещё раз или используйте код в Telegram');return result.token;
}
export async function securitySettings(){return runtime.enabled?visitorApi<{enabled:boolean;authenticated:boolean}>('/me/partner-security'):{enabled:false,authenticated:false};}
let pendingLock:Promise<unknown>=Promise.resolve();
let lockGeneration=0;
export function lockPartner(){lockGeneration++;setPartnerGrant('');if(runtime.enabled)pendingLock=visitorApi('/me/partner-security/lock',{method:'POST',body:'{}'}).catch(()=>{});return pendingLock;}
export async function unlockPartner(reason='Вход в партнёрский кабинет'){
 const generation=lockGeneration;await pendingLock;const m=await biometricManager();if(!m)throw Error('Откройте приложение в мобильном Telegram или восстановите доступ через код');
 const token=await authenticateBiometric(m,reason);
 if(generation!==lockGeneration)throw Error('Вход отменён. Откройте кабинет ещё раз');
 const result=await visitorApi<{grant:string}>('/me/partner-security/unlock',{method:'POST',body:JSON.stringify({token,deviceId:m.deviceId})});if(generation!==lockGeneration){void lockPartner();throw Error('Вход отменён. Откройте кабинет ещё раз')}setPartnerGrant(result.grant);
}
export async function enablePartnerBiometrics(){
 const m=await biometricManager();if(!m?.isBiometricAvailable)throw Error('На этом устройстве биометрия недоступна');
 if(!m.isAccessGranted&&!await biometricCall<boolean>(done=>m.requestAccess({reason:'Защита партнёрского кабинета PULSEDV.RU'},done)))throw Error('Защита не включена. Разрешите биометрию в настройках Telegram');
 const prepared=await visitorApi<{token:string}>('/me/partner-security/prepare',{method:'POST',body:JSON.stringify({deviceId:m.deviceId})});
 if(!await biometricCall<boolean>(done=>m.updateBiometricToken(prepared.token,done)))throw Error('Не удалось сохранить защиту на устройстве');
 const token=await authenticateBiometric(m,'Подтвердите включение защиты кабинета');
 const result=await visitorApi<{grant:string}>('/me/partner-security/activate',{method:'POST',body:JSON.stringify({token,deviceId:m.deviceId})});setPartnerGrant(result.grant);
}
export async function disablePartnerBiometrics(){await unlockPartner('Подтвердите отключение защиты кабинета');await visitorApi('/me/partner-security/disable',{method:'POST',body:'{}'});setPartnerGrant('');const m=await biometricManager();if(m)await biometricCall<boolean>(done=>m.updateBiometricToken('',done)).catch(()=>{});}
export async function confirmPartnerPayout(){if(runtime.enabled&&(await securitySettings()).enabled)await unlockPartner('Подтвердите изменение данных для выплаты');}
export const partnerIsUnlocked=()=>!!partnerGrant();
