import {Link,useSearchParams} from "react-router-dom";
import React from 'react';
import {ArrowLeft, ArrowRight, MessageCircle, ListChecks, CalendarDays, Sparkles} from 'lucide-react';
import {JourneyPanel} from '../../../../packages/journey/JourneyPanel';
import {type JourneyEntry} from '../../../../packages/journey/client';
import {getPropertiesByIds} from '../helpers/catalogApi';
import {LeadSheet} from '../components/LeadSheet';
import type {PulseProperty} from '../../../../packages/pulse-data/model';
import '../components/clientPolish.css';
export default function JourneyPage(){
 const [params]=useSearchParams();
 const [properties,setProperties]=React.useState<PulseProperty[]>([]),[error,setError]=React.useState('');
 const refreshProperties=React.useCallback((items:JourneyEntry[])=>{setError('');getPropertiesByIds([...new Set(items.flatMap(e=>[e.propertyId,...e.journey.collections.flatMap(c=>c.items.map(i=>i.propertyId)),...e.journey.showings.map(s=>s.propertyId)]).filter((x):x is string=>!!x))]).then(setProperties).catch(e=>setError(e.message))},[]);
 return <div className="pulseJourneyPage"><nav className="pulseJourneyNav" aria-label="Навигация по обращениям"><Link to="/"><ArrowLeft size={18}/>На главную</Link><Link to="/profile">Профиль</Link></nav>{error&&<p role="alert">Не удалось загрузить сведения о проектах. Нажмите «Обновить», чтобы повторить.</p>}{params.get('lead')&&<Link className="pulseAllJourneys" to="/journey">Все мои обращения<ArrowRight size={16}/></Link>}<JourneyPanel client leadId={params.get('lead')||undefined} properties={properties} onRefreshed={refreshProperties} emptyState={params.get('lead')?<div className="pulseJourneyEmpty"><h3>Обращение недоступно</h3><p>Возможно, оно было создано в другом браузере или аккаунте.</p><Link className="pulseClientAction" to="/journey">Все мои обращения</Link></div>:<div className="pulseJourneyEmpty"><span className="pulseEmptyIcon"><MessageCircle size={30}/></span><h3>Найдём квартиру вместе</h3><p>Расскажите, что ищете. Здесь вы сможете обсуждать варианты с менеджером и договариваться о просмотрах.</p><div className="pulseJourneyBenefits"><span><Sparkles size={18}/><b>Подборки под вас</b><small>Сравнивайте и отмечайте подходящее</small></span><span><MessageCircle size={18}/><b>Прямая связь</b><small>Все вопросы в одном обращении</small></span><span><CalendarDays size={18}/><b>Удобные показы</b><small>Согласовывайте дату и время</small></span></div><LeadSheet title="Помочь с выбором квартиры" source="journey"><button className="pulseClientAction">Обсудить покупку<ArrowRight size={17}/></button></LeadSheet><Link className="pulseSecondaryAction" to="/catalog"><ListChecks size={17}/>Пока посмотрю каталог</Link></div>}/></div>;
}
