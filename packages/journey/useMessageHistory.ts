import React from 'react';
import {api,visitorApi} from '../pulse-data/runtime';
import type {Journey,JourneyMessage} from './model';
export function useMessageHistory(journey:Journey|undefined,client:boolean){
 const [older,setOlder]=React.useState<JourneyMessage[]>([]),[cursor,setCursor]=React.useState<number|null|undefined>(),[loading,setLoading]=React.useState(false),[error,setError]=React.useState('');
 const generation=React.useRef(0);
 React.useEffect(()=>{generation.current++;setOlder([]);setCursor(undefined);setError('');setLoading(false)},[journey?.leadId]);
 React.useEffect(()=>{setOlder(current=>[...new Map([...current,...journey?.messages||[]].map(m=>[m.id,m])).values()])},[journey?.leadId,journey?.messages]);
 const before=cursor===undefined?journey?.messagesBefore:cursor;
 const load=async()=>{
  if(!journey||!before||loading)return;
  const version=generation.current;setLoading(true);setError('');
  try{
   const result=await (client?visitorApi:api)<{messages:JourneyMessage[];messagesBefore:number|null}>((client?'/me':'/control')+'/journeys/'+journey.leadId+'/messages?before='+before);
   if(version===generation.current){setOlder(current=>[...result.messages,...current]);setCursor(result.messagesBefore);}
  }catch(e){if(version===generation.current)setError(e instanceof Error?e.message:'Не удалось загрузить историю');}
  finally{if(version===generation.current)setLoading(false);}
 };
 const messages=[...new Map([...older,...journey?.messages||[]].map(m=>[m.id,m])).values()];
 return {messages,hasMore:!!before,loading,error,load};
}
