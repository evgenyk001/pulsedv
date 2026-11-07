import {isPwa} from '../pwa/client';
import React from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {runtime,visitorApi} from '../../../../packages/pulse-data/runtime';
type Delivery={id:string;status:'queued'|'sent'|'failed'|'unavailable';botUrl:string};
export function usePresentationDelivery(propertyId:string){
 const client=useQueryClient(),[job,setJob]=React.useState<string|null>(null),[requesting,setRequesting]=React.useState(false),[error,setError]=React.useState('');
 const locked=React.useRef(false),current=React.useRef(propertyId);current.current=propertyId;
 const query=useQuery<Delivery>({queryKey:['presentationDelivery',job],queryFn:()=>visitorApi('/me/presentations/'+job),enabled:!!job,refetchInterval:q=>q.state.data?.status==='queued'?3000:false,retry:1});
 React.useEffect(()=>{setJob(null);setError('');setRequesting(false)},[propertyId]);
 const send=async(documentId?:string)=>{
  if(locked.current)return;
  if(!runtime.enabled){setError('Отправка PDF доступна в рабочем Telegram-приложении.');return;}
  if(!documentId){setError('Обновите карточку ЖК и повторите запрос.');return;}
  if(isPwa){
   const a=document.createElement('a');a.href=runtime.base+'/me/presentation-files/'+encodeURIComponent(documentId);a.download='PULSEDV.RU.pdf';document.body.append(a);a.click();a.remove();
   setError('PDF запрошен. Его можно сохранить в «Файлы» или переслать через меню телефона.');return;
  }
  locked.current=true;setRequesting(true);setError('');setJob(null);const started=propertyId;
  try{const data=await visitorApi<Delivery>('/me/presentations',{method:'POST',body:JSON.stringify({propertyId,documentId})});if(current.current!==started)return;client.setQueryData(['presentationDelivery',data.id],data);setJob(data.id)}catch(e){if(current.current===started)setError(e instanceof Error?e.message:'Не удалось запросить презентацию.')}finally{locked.current=false;if(current.current===started)setRequesting(false)}
 };
 const state=query.data?.status;
 const notice=error||(query.isError?'Не удалось проверить отправку. Загляните в бот или повторите запрос.':requesting?'Готовим презентацию…':state==='queued'?'Отправляем PDF в бот. Файл можно будет скачать и переслать.':state==='sent'?'Презентация отправлена в бот. Сохраните PDF или перешлите близким.':state==='failed'?'Не удалось доставить PDF. Откройте бота, нажмите «Начать» или разблокируйте его и повторите запрос.':state==='unavailable'?'Презентация обновилась или снята с публикации. Обновите карточку ЖК.':'');
 return {send,busy:requesting||(!query.isError&&state==='queued'),notice,botUrl:query.data?.botUrl,dismiss:()=>{setJob(null);setError('')}};
}
