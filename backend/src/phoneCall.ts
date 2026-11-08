import type {RuntimeConfig} from './config';
import {normalizePhone} from './phoneIdentity';
export type PhoneCallSender=(phone:string)=>Promise<{code:string;callId:string}>;
/** Official Flash Call API: let the provider choose an available caller suffix. */
export function zvonokCallSender(config:RuntimeConfig,send:typeof fetch=fetch):PhoneCallSender{return async phone=>{
 const body=new FormData();body.set('public_key',config.ZVONOK_PUBLIC_KEY);body.set('campaign_id',config.ZVONOK_CAMPAIGN_ID);body.set('phone',phone);
 const response=await send('https://zvonok.com/manager/cabapi_external/api/v1/phones/flashcall/',{method:'POST',body,redirect:'error',signal:AbortSignal.timeout(12000)});
 const result=await response.json() as any,data=result?.data;
 const code=typeof data?.pincode==='number'&&Number.isInteger(data.pincode)?String(data.pincode).padStart(4,'0'):typeof data?.pincode==='string'?data.pincode:'';
 const callId=typeof data?.call_id==='number'&&Number.isSafeInteger(data.call_id)?String(data.call_id):typeof data?.call_id==='string'?data.call_id:'';
 if(!response.ok||result?.status!=='ok'||!/^\d{4}$/.test(code)||!/^\d{1,30}$/.test(callId)||typeof data.phone!=='string'||normalizePhone(data.phone)!==phone)throw Error('Phone verification call rejected');
 return {code,callId};
 };}
