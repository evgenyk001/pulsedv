import {LoadRecovery} from './LoadRecovery';
import {IconTile} from './IconTile';
import React from 'react';
import {Link} from 'react-router-dom';
import {Bell, BellRing, ArrowRight, ChevronRight, CheckCheck, X, RefreshCw} from 'lucide-react';
import {useClientNotifications} from '../helpers/useClientNotifications';
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription,SheetTrigger,SheetClose} from './Sheet';
import './clientPolish.css';
export function ClientUpdates({className}:{className?:string}){
 const {data,isLoading,error,refetch,mark}=useClientNotifications();
 const updates=data?.items??[];
 const count=data?.unreadCount??0;
 const [open,setOpen]=React.useState(false);
 const hasEntries=updates.some(u=>u.kind!=='search');
 return <Sheet open={open} onOpenChange={setOpen}><SheetTrigger asChild><button className={className} aria-label={count?'Уведомления, новых: '+count:'Уведомления'}><Bell size={18}/>{count>0&&<span className="pulseNotificationBadge" aria-hidden="true">{count>99?'99+':count}</span>}</button></SheetTrigger><SheetContent side="bottom" className="pulseNotifications"><SheetHeader className="pulseNotificationsHeader"><SheetTitle>Уведомления</SheetTitle><SheetDescription>Сообщения, подборки, показы и обновления поиска</SheetDescription></SheetHeader><SheetClose className="pulseExplicitClose" aria-label="Закрыть уведомления"><X size={20}/></SheetClose><div className="pulseUpdates">
 {isLoading?<div className="pulseNoticeEmpty" role="status"><IconTile className="pulseEmptyIcon"><RefreshCw size={28}/></IconTile><h3>Проверяем обновления</h3><p>Это займёт несколько секунд.</p></div>:error&&!data?<LoadRecovery label="Обновить уведомления" onRetry={()=>void refetch()}/>:!updates.length?<div className="pulseNoticeEmpty"><IconTile className="pulseEmptyIcon"><BellRing size={28}/></IconTile><h3>Вы ничего не пропустили</h3><p>Новых обновлений пока нет. Здесь появятся ответы менеджера, подборки, изменения показов и сохранённого поиска.</p></div>:<><div className="pulseUpdatesToolbar"><span>{count?'Новых: '+count:'Всё прочитано'}</span>{count>0&&<button disabled={mark.isPending} onClick={()=>mark.mutate({all:true})}><CheckCheck size={16}/>Прочитать все</button>}</div><div className="pulseUpdatesList">{updates.map(u=><Link className={'pulseUpdateRow'+(!u.read?' isUnread':'')} key={u.id} to={u.href} onClick={()=>{if(!u.read)mark.mutate({ids:[u.id]});setOpen(false)}}><IconTile className="pulseUpdateIcon"><Bell size={18}/></IconTile><span><strong>{u.title}</strong>{u.body&&<p>{u.body}</p>}<small>{new Date(u.at).toLocaleString('ru-RU',{timeZone:'Asia/Vladivostok',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})}</small></span><ChevronRight size={16}/></Link>)}</div></>}
 {mark.isError&&<p role="alert">Не удалось отметить уведомления прочитанными. Попробуйте ещё раз.</p>}
 <div className="pulseUpdatesFooter"><Link className="pulseClientAction" to="/journey" onClick={()=>setOpen(false)}>{hasEntries?'Мои обращения':'Помощь с покупкой'}<ArrowRight size={17}/></Link><SheetClose className="pulseSecondaryAction">Вернуться на главную</SheetClose></div></div></SheetContent></Sheet>;
}
