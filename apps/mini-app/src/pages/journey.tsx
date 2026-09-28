import React from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {ArrowLeft, ArrowRight, MessageCircle, CalendarDays, Sparkles, Plus, RefreshCw, ChevronRight} from 'lucide-react';
import {useClientJourneys} from '../helpers/useClientJourneys';
import {getPropertiesByIds} from '../helpers/catalogApi';
import {LeadSheet} from '../components/LeadSheet';
import {ClientConversation, journeyStatus, journeyDate} from '../components/ClientConversation';
import styles from './journey.module.css';

export default function JourneyPage(){
 const [params]=useSearchParams();
 const query=useClientJourneys(params.get('lead')?10000:30000);
 const items=query.data?.items||[];
 const ids=[...new Set(items.flatMap(e=>[e.propertyId,...e.journey.collections.flatMap(c=>c.items.map(i=>i.propertyId)),...e.journey.showings.map(s=>s.propertyId)]).filter((id):id is string=>!!id))].sort();
 const catalog=useQuery({queryKey:['journey-properties',ids],queryFn:()=>getPropertiesByIds(ids),enabled:ids.length>0,staleTime:60000});
 const properties=catalog.data||[];
 const leadId=params.get('lead');
 const selected=items.find(e=>e.leadId===leadId);
 if(leadId&&selected)return <ClientConversation key={leadId} entry={selected} properties={properties} query={query} catalogError={!!catalog.error} onRetryCatalog={()=>void catalog.refetch()}/>;
 return <div className={styles.page}>
  <nav className={styles.navigation} aria-label="Навигация по обращениям"><Link to="/"><ArrowLeft size={18}/>На главную</Link><Link to="/profile">Профиль</Link></nav>
  <header className={styles.pageHeader}><span>НА СВЯЗИ С PULSE.DV</span><div><h1>Мои подборки<br/>и показы</h1><button className={styles.iconButton} aria-label="Обновить обращения" disabled={query.isFetching} onClick={()=>void query.refetch()}><RefreshCw size={19}/></button></div><p>Ваши диалоги, варианты квартир и встречи — в одном месте.</p></header>
  {query.isLoading?<div className={styles.loading} role="status">Загружаем обращения…</div>:query.error?<div className={styles.empty}><MessageCircle size={32}/><h2>Не удалось загрузить диалоги</h2><p>Проверьте подключение. Ваши сообщения сохраняются в обращении.</p><button className={styles.secondary} onClick={()=>void query.refetch()}>Попробовать ещё раз</button></div>:leadId?<div className={styles.empty}><MessageCircle size={32}/><h2>Обращение недоступно</h2><p>Возможно, оно создано в другом браузере или аккаунте.</p><Link className={styles.primary} to="/journey">Все мои обращения</Link></div>:!items.length?<section className={styles.empty}>
   <span className={styles.emptyIcon}><MessageCircle size={30}/></span><h2>Найдём квартиру вместе</h2><p>Начните диалог с командой. Поможем сравнить варианты и организовать просмотр.</p>
   <div className={styles.benefits}><span><Sparkles size={18}/><b>Подборки под вас</b><small>Сохраняйте подходящие варианты</small></span><span><MessageCircle size={18}/><b>Личная переписка</b><small>Вопросы и ответы всегда рядом</small></span><span><CalendarDays size={18}/><b>Удобные показы</b><small>Выбирайте время вместе с менеджером</small></span></div>
   <LeadSheet title="Помочь с выбором квартиры" source="journey"><button className={styles.primary}>Обсудить покупку<ArrowRight size={17}/></button></LeadSheet><Link className={styles.secondary} to="/catalog">Пока посмотрю каталог</Link>
  </section>:<><div className={styles.inbox} aria-label="Мои диалоги">{[...items].sort((a,b)=>Date.parse(b.journey.messages?.at(-1)?.at||b.createdAt)-Date.parse(a.journey.messages?.at(-1)?.at||a.createdAt)).map(e=>{
   const last=e.journey.messages?.at(-1);const property=properties.find(p=>p.id===e.propertyId);const closed=['deal','closed','lost'].includes(e.status);
   return <Link className={styles.dialogRow} key={e.leadId} to={'/journey?lead='+e.leadId}><span className={styles.avatar}>{e.managerName?e.managerName.trim().split(/\s+/).map(n=>n[0]).slice(0,2).join(''):<MessageCircle size={22}/>}</span><span className={styles.dialogCopy}><span className={styles.dialogTitle}><strong>{e.managerName||'Команда PULSE.DV'}</strong><time>{journeyDate(last?.at||e.createdAt,true)}</time></span><b>{property?.name||'Помощь с покупкой'}</b><small>{last?(last.author==='client'?'Вы: ':'')+last.text:closed?'Обращение завершено':'Начните переписку — расскажите, что ищете'}</small><span className={styles.status}>{journeyStatus(e.status)}</span></span><ChevronRight size={16}/></Link>;
  })}</div><LeadSheet title="Новое обращение" source="journey"><button className={styles.secondary}><Plus size={18}/>Обсудить другую покупку</button></LeadSheet></>}
 </div>;
}
