import {useQuery} from '@tanstack/react-query';
import {api,runtime} from '../../../../packages/pulse-data/runtime';
export function LegalOperator(){
 const query=useQuery({queryKey:['public-legal'],enabled:runtime.enabled,queryFn:()=>api<{name:string;inn:string;email:string;address:string}>('/public/legal'),staleTime:300000});
 if(!runtime.enabled)return <p>Это демонстрационная версия. Реквизиты оператора будут опубликованы перед запуском сервиса для приёма обращений.</p>;
 if(query.isPending)return <p>Загружаем сведения об операторе…</p>;
 if(query.isError)return <p>Не удалось загрузить реквизиты. <button onClick={()=>void query.refetch()}>Повторить</button></p>;
 const info=query.data;
 if(!info?.name||!info.email)return <p>Сведения об операторе ещё не опубликованы.</p>;
 return <div><p>{info.name}{info.inn&&<> · ИНН {info.inn}</>}</p>{info.address&&<p>{info.address}</p>}<p>Вопросы об обработке данных и отзыв согласия: <a href={'mailto:'+info.email}>{info.email}</a></p></div>;
}
