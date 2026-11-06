import React from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {ArrowRight,BookOpen,Check,ChevronDown,Clock3,Gift,MessageCircle,ShieldCheck,Ticket} from 'lucide-react';
import {useGiveaway} from '../helpers/useGiveaway';
import {visitorApi} from '../../../../packages/pulse-data/runtime';
import {GiveawayCountdown} from '../components/GiveawayCountdown';
import {AccountConversationEntry} from '../components/AccountConversationEntry';
import {BackLink} from '../components/BackLink';
import type {GiveawayEntry} from '../../../../packages/giveaway';
import './giveaway.css';

export default function GiveawayPage(){
 const query=useGiveaway(),client=useQueryClient();
 const [accepted,setAccepted]=React.useState(false),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
 const [clockRevision,tick]=React.useReducer(n=>n+1,0);
 const rules=React.useRef<HTMLDetailsElement>(null);
 const serverNow=query.data?.serverNow,observedAt=query.data?.observedAt;
 React.useEffect(()=>{setAccepted(false)},[query.data?.settings.version]);
 // Refresh eligibility at the exact campaign boundaries; the countdown updates itself.
 React.useEffect(()=>{
  if(!query.data)return;
  const now=Date.parse(query.data.serverNow)+performance.now()-(query.data.observedAt??performance.now());
  const next=[query.data.settings.startsAt,query.data.settings.endsAt].map(Date.parse).filter(at=>at>now).sort((a,b)=>a-b)[0];
  if(!next)return;
  const timer=window.setTimeout(tick,Math.min(next-now+50,2147483647));
  const resume=()=>{if(!document.hidden)tick()};document.addEventListener('visibilitychange',resume);
  return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',resume)};
 },[query.data,serverNow,observedAt,clockRevision]);
 const back=<div className="giveawayExperience__back" data-app-back-row><BackLink to="/" aria-label="Назад"/><span>Назад</span></div>;
 if(query.isPending)return <div className="giveawayExperience">{back}<div className="giveawayExperience__load" role="status"><Gift size={28}/><h1>Готовим праздник…</h1><p>Загружаем условия и ваш статус.</p></div></div>;
 if(query.isError)return <div className="giveawayExperience">{back}<div className="giveawayExperience__load" role="alert"><h1>Не удалось загрузить акцию</h1><p>Попробуйте ещё раз — ваша заявка сохранена, если вы уже её подавали.</p><button className="giveawayExperience__button" onClick={()=>void query.refetch()}>Попробовать ещё раз</button></div></div>;
 const data=query.data;
 if(!data||(!data.settings.enabled&&!data.entry))return <div className="giveawayExperience">{back}<div className="giveawayExperience__load"><Gift size={28}/><h1>Акция пока недоступна</h1><p>Загляните сюда позже.</p></div></div>;
 const {settings:s,entry}=data;
 const now=Date.parse(data.serverNow)+performance.now()-(data.observedAt??performance.now());
 const starts=Date.parse(s.startsAt),ends=Date.parse(s.endsAt),closed=now>=ends,before=now<starts;
 const date=(value:string)=>new Date(value).toLocaleDateString('ru-RU',{timeZone:'Asia/Vladivostok',day:'numeric',month:'long'});
 const periodDate=(value:string)=>new Date(value).toLocaleDateString('ru-RU',{timeZone:'Asia/Vladivostok',day:'2-digit',month:'2-digit',year:'numeric'});
 const drawTime=new Date(s.drawAt).toLocaleTimeString('ru-RU',{timeZone:'Asia/Vladivostok',hour:'2-digit',minute:'2-digit'});
 const showRules=()=>{if(!rules.current)return;rules.current.open=true;rules.current.querySelector('summary')?.focus();rules.current.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})};
 const apply=async()=>{
  if(!accepted||busy||!s.enabled||before||closed)return;
  setBusy(true);setError('');
  try{const result=await visitorApi<{entry:GiveawayEntry}>('/me/giveaway',{method:'POST',body:JSON.stringify({version:s.version,acceptedRules:true})});client.setQueryData(['giveaway'],{...data,entry:result.entry});}
  catch(e){setError(e instanceof Error?e.message:'Не удалось отправить заявку. Попробуйте ещё раз.');void query.refetch()}
  finally{setBusy(false)}
 };
 const confirmed=entry?.status==='confirmed',pending=entry?.status==='pending';
 return <div className="giveawayExperience">
  {back}
  <section className="giveawayExperience__hero" aria-labelledby="giveaway-title">
   <div className="giveawayExperience__art">
    <img src={import.meta.env.BASE_URL+'_cdn/static/giveaway-burgundy.webp'} alt="Бордовый смартфон — художественная визуализация приза" fetchPriority="high" decoding="async"/>
    <div className="giveawayExperience__heroCopy"><span className="giveawayExperience__eyebrow">PULSEDV.RU · НОВЫЙ ГОД</span><h1 id="giveaway-title">{s.title}</h1><span className="giveawayExperience__prize"><Gift size={14} aria-hidden="true"/>{s.prize}</span></div>
   </div>
   <div className="giveawayExperience__heroFooter">
    <p>Выбирайте новый дом через PULSEDV.RU.<br/>А мы добавим к покупке шанс на подарок.</p>
    <div className="giveawayExperience__timerLabel"><span><Clock3 size={14} aria-hidden="true"/>{before?'До старта розыгрыша':closed?'Приём заявок завершён':'До конца приёма заявок'}</span><span>Владивосток</span></div>
    <GiveawayCountdown deadline={before?s.startsAt:s.endsAt} serverNow={data.serverNow} observedAt={data.observedAt}/>
    <div className="giveawayExperience__draw"><span>Определим победителя</span><strong>{date(s.drawAt)} · {drawTime}</strong></div>
   </div>
  </section>
  <section className={'giveawayExperience__entry'+(confirmed?' is-confirmed':entry?.status==='rejected'?' is-rejected':'')} aria-labelledby="giveaway-entry-title">
   {entry?<>
    <div className="giveawayExperience__statusHeading"><span className="giveawayExperience__statusIcon">{confirmed?<Ticket size={21}/>:pending?<Check size={21}/>:<MessageCircle size={21}/>}</span><div><span className="giveawayExperience__sectionLabel">{confirmed?'ВЫ В РОЗЫГРЫШЕ':pending?'ПЕРВЫЙ ШАГ СДЕЛАН':'СТАТУС УЧАСТИЯ'}</span><h2 id="giveaway-entry-title">{confirmed?(entry.tickets.length>1?'Ваши счастливые номера':'Ваш счастливый номер'):pending?'Заявка уже у нас':'Участие не подтверждено'}</h2></div></div>
    <div role="status">{confirmed?<><div className="giveawayExperience__tickets">{entry.tickets.map(ticket=><div className="giveawayExperience__ticket" key={ticket.id}><span>НОМЕР УЧАСТНИКА</span><strong>{ticket.ticket}</strong><Ticket size={25} aria-hidden="true"/></div>)}</div><p>Допуск подтверждён. {entry.tickets.length>1?'Все номера участвуют':'Номер участвует'} в розыгрыше и {entry.tickets.length>1?'сохранены':'сохранён'} в вашем аккаунте.</p></>:<p>{pending?'Теперь — к вашей новой квартире. Мы сопровождаем сделку и после проверки государственной регистрации присвоим номер участника.':entry.reason||'Уточните причину у вашего менеджера.'}</p>}</div>
    <AccountConversationEntry source="giveaway" context={{giveawayEntryId:entry.id}}><button className="giveawayExperience__button"><MessageCircle size={18} aria-hidden="true"/>{confirmed?'Написать менеджеру':'Связаться с менеджером'}<ArrowRight size={18} aria-hidden="true"/></button></AccountConversationEntry>
    {pending&&<small className="giveawayExperience__footnote">Дополнительно отправлять документы для розыгрыша не нужно.</small>}
   </>:<>
    <span className="giveawayExperience__sectionLabel">ВАША ПОКУПКА МОЖЕТ ПРИНЕСТИ БОЛЬШЕ</span><h2 id="giveaway-entry-title">Начните с заявки</h2><p>Покупка через нас, зарегистрированная сделка — и ваш номер в розыгрыше.</p>
    <div className="giveawayExperience__accept"><label><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><span>Принимаю правила розыгрыша</span></label><button type="button" onClick={showRules}>Прочитать правила <ArrowRight size={14}/></button></div>
    <button className="giveawayExperience__button" disabled={!accepted||busy||!s.enabled||before||closed} onClick={()=>void apply()}>{busy?'Отправляем заявку…':before?'Приём ещё не начался':closed?'Приём завершён':!s.enabled?'Приём приостановлен':'Подать заявку'}<ArrowRight size={18} aria-hidden="true"/></button>
    <small className="giveawayExperience__footnote">Номер выдаём после проверки регистрации сделки.</small>
   </>}
   {error&&<p className="giveawayExperience__error" role="alert">{error}</p>}
  </section>
  <section className="giveawayExperience__how" aria-labelledby="giveaway-how-title"><div className="giveawayExperience__sectionHead"><h2 id="giveaway-how-title">Три шага к подарку</h2><span>Всё просто</span></div><ol>
   <li><span>01</span><div><h3>Заявите об участии</h3><p>Одна заявка в приложении. Без репостов и подписок.</p></div></li>
   <li><span>02</span><div><h3>Купите недвижимость через нас</h3><p>Поможем с выбором и сопроводим вашу сделку.</p></div></li>
   <li><span>03</span><div><h3>Получите свой номер</h3><p>После регистрации сделки проверим условия и отправим номер в бот.</p></div></li>
  </ol><div className="giveawayExperience__period"><ShieldCheck size={18} aria-hidden="true"/><p>Одна зарегистрированная сделка — один номер.<br/>Период регистрации: {periodDate(s.startsAt)} — {periodDate(new Date(ends-1).toISOString())}.</p></div></section>
  <details className="giveawayExperience__rules" ref={rules}><summary><span className="giveawayExperience__rulesIcon"><BookOpen size={20}/></span><span><strong>Правила розыгрыша</strong><small>Условия, организатор и получение приза</small></span><ChevronDown size={20} aria-hidden="true"/></summary><div className="giveawayExperience__rulesText">{s.rules.split(/\n\s*\n/).filter(Boolean).map((paragraph,index)=><p key={index}>{paragraph}</p>)}</div><button className="giveawayExperience__collapse" onClick={()=>{if(rules.current){rules.current.open=false;rules.current.querySelector('summary')?.focus();rules.current.scrollIntoView({block:'nearest'})}}}>Свернуть правила <ChevronDown size={16}/></button></details>
  <p className="giveawayExperience__artNote">Изображение приза — художественная визуализация. Характеристики и порядок вручения указаны в правилах.</p>
 </div>;
}
