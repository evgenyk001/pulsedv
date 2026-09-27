import React from 'react';
import {Link} from 'react-router-dom';
import {Bell} from 'lucide-react';
import {useClientJourneys} from '../helpers/useClientJourneys';
import {clientUpdates} from '../../../../packages/journey/updates';
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription,SheetTrigger} from './Sheet';
import './clientPolish.css';
const KEY='pulse.read-updates.v1';
export function ClientUpdates({className}:{className?:string}){
 const {data,isLoading,error,refetch}=useClientJourneys();const updates=clientUpdates(data?.items||[]);
 const [seen,setSeen]=React.useState<string[]>(()=>{try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v:[]}catch{return []}});
 const unread=updates.filter(u=>!seen.includes(u.id));
 const mark=()=>{const next=[...new Set([...updates.map(u=>u.id),...seen])].slice(0,500);setSeen(next);try{localStorage.setItem(KEY,JSON.stringify(next))}catch{}};
 return <Sheet><SheetTrigger asChild><button className={className} aria-label={unread.length?'Уведомления, новых: '+unread.length:'Уведомления'}><Bell size={18}/>{unread.length>0&&<i/>}</button></SheetTrigger><SheetContent side="bottom"><SheetHeader><SheetTitle>Обновления по обращениям</SheetTitle><SheetDescription>Подборки, подтверждения показов и сообщения менеджера.</SheetDescription></SheetHeader><div className="pulseUpdates">{isLoading&&<p role="status">Загружаем обновления…</p>}{error&&<p role="alert">Не удалось загрузить обновления. <button onClick={()=>void refetch()}>Повторить</button></p>}{!isLoading&&!error&&!updates.length&&<p>Новых обновлений пока нет. Когда менеджер опубликует подборку или ответит, здесь появится уведомление.</p>}{updates.map(u=><Link key={u.id} to={'/journey?lead='+u.leadId}>{!seen.includes(u.id)&&'• '}{u.title}<small>{new Date(u.at).toLocaleString('ru-RU')}</small></Link>)}{unread.length>0&&<button onClick={mark}>Отметить прочитанными</button>}<Link to="/journey">Все мои обращения →</Link></div></SheetContent></Sheet>;
}
