import React from 'react';
import { initializePublic, runtime } from '../../../../packages/pulse-data/runtime';
export function RuntimeGate({children}:{children:React.ReactNode}){
 const [ready,setReady]=React.useState(!runtime.enabled);
 const [error,setError]=React.useState('');
 const load=React.useCallback(async()=>{setError('');try{await initializePublic();setReady(true);}catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить приложение');}},[]);
 React.useEffect(()=>{if(runtime.enabled)void load();},[load]);
 React.useEffect(()=>{if(!ready||!runtime.enabled)return;const refresh=()=>{if(document.visibilityState==='visible')void initializePublic().catch(()=>{});};window.addEventListener('online',refresh);document.addEventListener('visibilitychange',refresh);return()=>{window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',refresh);};},[ready]);
 if(!ready)return <div style={{padding:32,textAlign:'center'}} role="status">{error||'Загружаем PULSE.DV…'}{error&&<p><button onClick={()=>void load()}>Попробовать снова</button></p>}</div>;
 return children;
}
