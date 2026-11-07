import {startAuthentication,startRegistration,browserSupportsWebAuthn} from '@simplewebauthn/browser';
import type {PublicKeyCredentialCreationOptionsJSON,PublicKeyCredentialRequestOptionsJSON} from '@simplewebauthn/browser';
import {visitorApi,replaceVisitorSession} from '../pulse-data/runtime';
import {setPartnerGrant} from './securityState';
export type PasskeySettings={enabled:boolean;authenticated:boolean;legacyApprovalRequired:boolean;keys:{id:string;name:string;createdAt:string;lastUsedAt:string|null}[]};
export const passkeysSupported=()=>typeof window!=='undefined'&&window.isSecureContext&&browserSupportsWebAuthn();
export const getPasskeySettings=()=>visitorApi<PasskeySettings>('/me/account/passkeys');
function friendly(error:unknown):never{if(error instanceof Error&&error.name==='NotAllowedError')throw Error('Подтверждение отменено. Попробуйте ещё раз');throw error;}
export async function enrollPasskey(approvalCode?:string){
 if(!passkeysSupported())throw Error('Ключи доступа недоступны в этом браузере');
 const o=await visitorApi<{challengeId:string;options:PublicKeyCredentialCreationOptionsJSON}>('/me/account/passkeys/register/options',{method:'POST',body:JSON.stringify(approvalCode?{approvalCode}:{})});
 try{const response=await startRegistration({optionsJSON:o.options});const result=await visitorApi<{grant:string}>('/me/account/passkeys/register/verify',{method:'POST',body:JSON.stringify({challengeId:o.challengeId,response})});setPartnerGrant(result.grant)}catch(e){friendly(e)}
}
export async function authenticatePwaPartner(){
 const o=await visitorApi<{challengeId:string;options:PublicKeyCredentialRequestOptionsJSON}>('/me/account/passkeys/unlock/options',{method:'POST',body:'{}'});
 try{const response=await startAuthentication({optionsJSON:o.options});return await visitorApi<{grant:string}>('/me/account/passkeys/unlock/verify',{method:'POST',body:JSON.stringify({challengeId:o.challengeId,response})})}catch(e){return friendly(e)}
}
export async function loginWithPasskey(){
 const o=await visitorApi<{challengeId:string;options:PublicKeyCredentialRequestOptionsJSON}>('/me/account/passkeys/login/options',{method:'POST',body:'{}'});
 try{const response=await startAuthentication({optionsJSON:o.options});const result=await visitorApi<{sessionId:string;accessToken:string;expiresAt:string;grant:string}>('/me/account/passkeys/login/verify',{method:'POST',body:JSON.stringify({challengeId:o.challengeId,response})});replaceVisitorSession(result);setPartnerGrant('');window.dispatchEvent(new Event('pulse:identity-ready'))}catch(e){friendly(e)}
}
export async function removePasskey(id:string){await visitorApi('/me/account/passkeys/remove',{method:'POST',body:JSON.stringify({id})});setPartnerGrant('');}
