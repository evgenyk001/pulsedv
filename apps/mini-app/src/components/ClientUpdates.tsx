import React from 'react';
import {Link} from 'react-router-dom';
import {Bell, BellRing, ChevronRight, CheckCheck, X, RefreshCw} from 'lucide-react';
import {useClientJourneys} from '../helpers/useClientJourneys';
import {clientUpdates} from '../../../../packages/journey/updates';
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription,SheetTrigger,SheetClose} from './Sheet';
import './clientPolish.css';
const KEY='pulse.read-updates.v1';
export function ClientUpdates({className}:{className?:string}){
 const {data,isLoading,error,refetch}=useClientJourneys();const updates=clientUpdates(data?.items||[]);
 const [open,setOpen]=React.useState(false);
 const [seen,setSeen]=React.useState<string[]>(()=>{try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v:[]}catch{return []}});
 const unread=updates.filter(u=>!seen.includes(u.id));
 const mark=(ids:string[])=>{const next=[...new Set([...ids,...seen])].slice(0,500);setSeen(next);try{localStorage.setItem(KEY,JSON.stringify(next))}catch{}};
 const hasEntries=!!data?.items.length;
 return <Sheet open={open} onOpenChange={setOpen}><SheetTrigger asChild><button className={className} aria-label={unread.length?'Уведомления, новых: '+unread.length:'Уведомления'}><Bell size={18}/>{unread.length>0&&<i/>}</button></SheetTrigger><SheetContent side="bottom" className="pulseNotifications"><SheetHeader className="pulseNotificationsHeader"><SheetTitle>Уведомления</SheetTitle><SheetDescription>Всё важное о ваших подборках и показах</SheetDescription></SheetHeader><SheetClose className="pulseExplicitClose" aria-label="Закрыть уведомления"><X size={20}/></SheetClose><div className="pulseUpdates">
 {isLoading?<div className="pulseNoticeEmpty" role="status"><span className="pulseEmptyIcon"><RefreshCw size={28}/></span><h3>Проверяем обновления</h3><p>Это займёт несколько секунд.</p></div>:error?<div className="pulseNoticeEmpty" role="alert"><span className="pulseEmptyIcon"><Bell size={28}/></span><h3>Не удалось загрузить</h3><p>Проверьте подключение и попробуйте ещё раз.</p><button className="pulseSecondaryAction" onClick={()=>void refetch()}><RefreshCw size={16}/>Повторить</button></div>:!updates.length?<div className="pulseNoticeEmpty"><span className="pulseEmptyIcon"><BellRing size={28}/></span><h3>Вы ничего не пропустили</h3><p>Новых обновлений пока нет. Здесь появятся ответы менеджера, подборки и подтверждения показов.</p></div>:<><div className="pulseUpdatesToolbar"><span>{unread.length?'Новых: '+unread.length:'Всё прочитано'}</span>{unread.length>0&&<button onClick={()=>mark(updates.map(u=>u.id))}><CheckCheck size={16}/>Прочитать все</button>}</div><div className="pulseUpdatesList">{updates.map(u=><Link className={'pulseUpdateRow'+(!seen.includes(u.id)?' isUnread':'')} key={u.id} to={'/journey?lead='+u.leadId} onClick={()=>{mark([u.id]);setOpen(false)}}><span className="pulseUpdateIcon"><Bell size={18}/></span><span><strong>{u.title}</strong><small>{new Date(u.at).toLocaleString('ru-RU',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})}</small></span><ChevronRight size={16}/></Link>)}</div></>}
 <div className="pulseUpdatesFooter"><Link className="pulseClientAction" to="/journey" onClick={()=>setOpen(false)}>{hasEntries?'Мои обращения':'Помощь с покупкой'}<ChevronRight size={17}/></Link><SheetClose className="pulseSecondaryAction">Вернуться на главную</SheetClose></div></div></SheetContent></Sheet>;
}
