import {LoadRecovery} from './LoadRecovery';
import {useQuery} from '@tanstack/react-query';
import {api,runtime} from '../../../../packages/pulse-data/runtime';
export function LegalOperator(){
 const query=useQuery({queryKey:['public-legal'],enabled:runtime.enabled,queryFn:()=>api<{name:string;inn:string;email:string;address:string}>('/public/legal'),staleTime:300000});
 if(!runtime.enabled)return <p>Приём обращений пока недоступен.</p>;
 if(query.isPending)return <p>Загружаем сведения об операторе…</p>;
 if(query.isError&&!query.data)return <LoadRecovery label="Обновить сведения об операторе" onRetry={()=>void query.refetch()}/>;
 const info=query.data;
 if(!info?.name||!info.email)return <p>Сведения об операторе ещё не опубликованы.</p>;
 return <div><p>{info.name}{info.inn&&<> · ИНН {info.inn}</>}</p>{info.address&&<p>{info.address}</p>}<p>Вопросы об обработке данных и отзыв согласия: <a href={'mailto:'+info.email}>{info.email}</a></p></div>;
}
