import React from 'react';
import {runtime} from '../../../../packages/pulse-data/runtime';
import {pwaConfig,requestPhoneCode,verifyPhoneCode,resetPwaDevice} from './client';
import {PhoneEntry} from './PhoneEntry';
import {loginWithPasskey,passkeysSupported} from '../../../../packages/partners/passkeys';
export function BrowserPhoneRegistration({onRegistered}:{onRegistered:()=>void}){
 const [phone,setPhone]=React.useState(''),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[available,setAvailable]=React.useState<boolean|null>(null),[challenge,setChallenge]=React.useState(''),[retryAt,setRetryAt]=React.useState(0),[now,setNow]=React.useState(Date.now());
 const [channel,setChannel]=React.useState<'call'|'sms'>('call');
 const locked=React.useRef(false);
 const load=React.useCallback(()=>{setAvailable(null);void pwaConfig().then(c=>{setChannel(c.phoneChannel);setAvailable(c.phoneLogin)},()=>{setAvailable(false);setError('Проверьте интернет и повторите')})},[]);
 React.useEffect(()=>{void resetPwaDevice();load()},[load]);React.useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[]);
 const send=React.useCallback(async(value:string)=>{if(locked.current||Date.now()<retryAt)return;locked.current=true;setBusy(true);setError('');try{const r=await requestPhoneCode(value,runtime.consentVersion,channel);setPhone(value);setChallenge(r.challengeId);setRetryAt(Date.now()+r.retryAfter*1000)}catch(e){setError(e instanceof Error?e.message:'Не удалось отправить код')}finally{locked.current=false;setBusy(false)}},[retryAt,channel]);
 const verify=React.useCallback(async(code:string)=>{if(locked.current||code.length!==(channel==='call'?4:6))return;locked.current=true;setBusy(true);setError('');try{await verifyPhoneCode(challenge,code,channel);onRegistered()}catch(e){setError(e instanceof Error?e.message:'Не удалось войти')}finally{locked.current=false;setBusy(false)}},[challenge,onRegistered,channel]);
 const passkey=async()=>{if(locked.current)return;locked.current=true;setBusy(true);setError('');try{await loginWithPasskey();onRegistered()}catch(e){setError(e instanceof Error?e.message:'Ключ не подтверждён')}finally{locked.current=false;setBusy(false)}};
 return <PhoneEntry channel={channel} stage={challenge?'code':'phone'} phone={phone} busy={busy} available={available} error={error} retrySeconds={Math.max(0,Math.ceil((retryAt-now)/1000))} onRequest={value=>void send(value)} onVerify={code=>void verify(code)} onBack={()=>{if(!locked.current){setChallenge('');setError('')}}} onRetry={()=>void send(phone)} onReload={load} onPasskey={passkeysSupported()?()=>void passkey():undefined}/>;
}
