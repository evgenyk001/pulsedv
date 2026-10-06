import React from 'react';
import {api,runtime} from '../../../packages/pulse-data/runtime';
import type {PulseLead} from '../../../packages/pulse-data/model';
type Page={items:PulseLead[];page:number;total:number;hasMore:boolean};
export function useLeadSearch(query:string,mode:string,status:string|null,unassigned:boolean){
 const [result,setResult]=React.useState<Page>({items:[],page:0,total:0,hasMore:false}),[loading,setLoading]=React.useState(false),[error,setError]=React.useState('');
 const generation=React.useRef(0);
 const search=React.useMemo(()=>new URLSearchParams({q:query,mode,unassigned:String(unassigned),...(status?{status}:{}),limit:'100'}).toString(),[query,mode,status,unassigned]);
 const fetchPage=React.useCallback(async(page:number,signal?:AbortSignal)=>{
  const version=generation.current;setLoading(true);setError('');
  try{const data=await api<Page>('/control/leads?'+search+'&page='+page,{signal});if(version===generation.current&&!signal?.aborted)setResult(current=>({...data,items:page===1?data.items:[...new Map([...current.items,...data.items].map(l=>[l.id,l])).values()]}));}
  catch(e){if(version===generation.current&&!signal?.aborted)setError(e instanceof Error?e.message:'Поиск недоступен');}
  finally{if(version===generation.current&&!signal?.aborted)setLoading(false);}
 },[search]);
 React.useEffect(()=>{
  if(!runtime.enabled)return;generation.current++;const controller=new AbortController();setLoading(true);
  const timer=setTimeout(()=>void fetchPage(1,controller.signal),250);
  const poll=setInterval(()=>{if(!document.hidden)void fetchPage(1,controller.signal)},30000);
  return()=>{generation.current++;clearTimeout(timer);clearInterval(poll);controller.abort()};
 },[fetchPage]);
 return {...result,loading,error,loadMore:()=>fetchPage(result.page+1),refresh:()=>fetchPage(1)};
}
