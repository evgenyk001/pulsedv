import {isPwa} from '../pwa/client';
import React from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {ArrowRight,BookOpen,Check,ChevronDown,Clock3,Gift,MessageCircle,ShieldCheck,Ticket,ArrowUpRight,CheckCircle2} from 'lucide-react';
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
 const tickets=entry?.tickets??[];
 const eligibilityText=before?'Приём начнётся '+date(s.startsAt):closed?'Приём заявок завершён':!s.enabled?'Приём заявок приостановлен':'Заявка бесплатная. Номер — после подтверждения сделки.';
 return <div className="giveawayExperience">
  {back}
  <section className="giveawayExperience__hero" aria-labelledby="giveaway-title">
   <div className="giveawayExperience__art">
    <img src={import.meta.env.BASE_URL+'_cdn/static/giveaway-burgundy.webp'} alt="Бордовый смартфон — художественная визуализация приза" fetchPriority="high" decoding="async"/>
    <div className="giveawayExperience__heroCopy"><span className="giveawayExperience__eyebrow"><span/>НОВОГОДНИЙ РОЗЫГРЫШ</span><h1 id="giveaway-title">{s.title}</h1><span className="giveawayExperience__prize"><Gift size={14} aria-hidden="true"/>{s.prize}</span></div>
   </div>
   <div className="giveawayExperience__heroFooter">
    <div className="giveawayExperience__timerLabel"><span><Clock3 size={13} aria-hidden="true"/>{before?'До начала акции':closed?'Приём завершён':'До конца приёма заявок'}</span><span>Владивосток</span></div>
    <GiveawayCountdown deadline={before?s.startsAt:s.endsAt} serverNow={data.serverNow} observedAt={data.observedAt}/>
    <div className="giveawayExperience__draw"><span>Определение победителя</span><strong>{date(s.drawAt)} · {drawTime}</strong></div>
   </div>
  </section>
  <div className="giveawayExperience__intro"><p>Новый дом — большое событие.<br/><strong>Пусть приятных перемен будет больше.</strong></p><span><ShieldCheck size={14}/>Без подписок и репостов</span></div>
  <section className={'giveawayExperience__entry'+(confirmed?' is-confirmed':entry?.status==='rejected'?' is-rejected':'')} aria-labelledby="giveaway-entry-title">
   <div className="giveawayExperience__sectionTop"><span className="giveawayExperience__sectionLabel">ВАШЕ УЧАСТИЕ</span><span className="giveawayExperience__statusBadge">{confirmed?'Подтверждено':pending?'Заявка принята':entry?'Нужна проверка':closed?'Приём завершён':before?'Скоро старт':'Приём открыт'}</span></div>
   {entry?<>
    <div className="giveawayExperience__statusHeading"><span className="giveawayExperience__statusIcon">{confirmed?<Ticket size={21}/>:pending?<CheckCircle2 size={21}/>:<MessageCircle size={21}/>}</span><div><h2 id="giveaway-entry-title">{confirmed?(tickets.length>1?'Ваши номера участника':tickets.length?'Ваш номер участника':'Участие подтверждено'):pending?'Вы сделали первый шаг':'Уточним ваше участие'}</h2><p>{confirmed?'Удачи в розыгрыше!':pending?'Заявка сохранена в вашем аккаунте.':'Посмотрите причину и свяжитесь с нами.'}</p></div></div>
    <div role="status">{confirmed?<><div className="giveawayExperience__tickets">{tickets.map(ticket=><div className="giveawayExperience__ticket" key={ticket.id}><div><span>НОМЕР УЧАСТНИКА</span><strong>{ticket.ticket}</strong></div><Ticket size={28} aria-hidden="true"/></div>)}</div><p>{tickets.length?(tickets.length>1?'Все номера участвуют в розыгрыше и сохраняются в вашем аккаунте.':'Этот номер участвует в розыгрыше и сохраняется в вашем аккаунте.'):'Если номер ещё не появился, уточните его у менеджера.'}</p></>:<p>{pending?(closed?'Если ваша сделка зарегистрирована в период акции, мы проверим условия и подтвердим участие.':'После покупки недвижимости через нас и проверки государственной регистрации сделки вы получите номер участника.'):entry.reason||'Менеджер поможет разобраться, какие условия ещё нужно выполнить.'}</p>}</div>
    {pending&&<div className="giveawayExperience__notice"><Ticket size={17}/><span>{isPwa?'Номер появится здесь ':'Номер появится здесь и придёт в бот '}<strong>после подтверждения сделки.</strong></span></div>}
    <AccountConversationEntry source="giveaway" context={{giveawayEntryId:entry.id}}><button className="giveawayExperience__button"><MessageCircle size={18} aria-hidden="true"/><span>{entry.status==='rejected'?'Уточнить участие':confirmed?'Написать менеджеру':'Обсудить покупку'}<small>В переписке внутри приложения</small></span><ArrowUpRight size={18} aria-hidden="true"/></button></AccountConversationEntry>
    {pending&&<small className="giveawayExperience__footnote">Документы отдельно для розыгрыша отправлять не нужно.</small>}
   </>:<>
    <h2 id="giveaway-entry-title">Ваша новая квартира.<br/>Ваш шанс на подарок.</h2><p>Оставьте заявку, купите недвижимость через PULSEDV.RU и получите номер после проверки регистрации сделки.</p>
    <div className="giveawayExperience__accept"><label><input type="checkbox" checked={accepted} disabled={busy} onChange={e=>setAccepted(e.target.checked)}/><span>Принимаю правила розыгрыша</span></label><button type="button" onClick={showRules} aria-label="Прочитать правила розыгрыша"><BookOpen size={16}/><span>Прочитать правила</span><ArrowUpRight size={14}/></button></div>
    <button type="button" className="giveawayExperience__button" disabled={!accepted||busy||!s.enabled||before||closed} onClick={()=>void apply()}>{busy?<span>Отправляем заявку…</span>:<><Gift size={18}/><span>{before?'Приём ещё не начался':closed?'Приём завершён':!s.enabled?'Приём приостановлен':'Участвовать в розыгрыше'}</span><ArrowRight size={18} aria-hidden="true"/></>}</button>
    <small className="giveawayExperience__footnote">{eligibilityText}</small>
   </>}
   {error&&<p className="giveawayExperience__error" role="alert">{error}</p>}
  </section>
  <section className="giveawayExperience__how" aria-labelledby="giveaway-how-title"><div className="giveawayExperience__sectionHead"><span className="giveawayExperience__roundIcon"><Gift size={19}/></span><div><h2 id="giveaway-how-title">Как получить номер</h2><p>Три понятных шага</p></div></div><ol>
   {[{title:'Подайте заявку',text:'Примите правила и нажмите «Участвовать».',done:!!entry,current:!entry},{title:'Купите недвижимость через нас',text:'Мы сопроводим сделку и проверим её государственную регистрацию.',done:confirmed,current:pending},{title:isPwa?'Получите номер участника':'Получите номер в бот',text:'Подтверждённый номер также сохранится в этом разделе.',done:confirmed,current:false}].map((step,index)=><li key={step.title} className={(step.done?'is-done ':'')+(step.current?'is-current':'')}><span>{step.done?<Check size={15}/>:String(index+1).padStart(2,'0')}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></li>)}
  </ol><div className="giveawayExperience__period"><ShieldCheck size={17} aria-hidden="true"/><div><strong>Одна сделка — один номер</strong><p>Государственная регистрация сделки должна попасть в период {periodDate(s.startsAt)} — {periodDate(new Date(ends-1).toISOString())}.</p></div></div></section>
  <section className="giveawayExperience__answers" aria-label="Частые вопросы"><details><summary><span>Заявка уже даёт номер?</span><ChevronDown size={18}/></summary><p>Нет. Заявка фиксирует ваш интерес к акции. Номер выдаём после покупки через PULSEDV.RU и проверки регистрации сделки.</p></details><details><summary><span>Когда узнаем победителя?</span><ChevronDown size={18}/></summary><p>Определение победителя — {date(s.drawAt)} в {drawTime} по Владивостоку. Порядок проведения и получения приза указан в полных правилах.</p></details></section>
  <details className="giveawayExperience__rules" ref={rules}><summary><span className="giveawayExperience__roundIcon"><BookOpen size={19}/></span><span><strong>Полные правила</strong><small>Условия, организатор и получение приза</small></span><ChevronDown size={19} aria-hidden="true"/></summary><div className="giveawayExperience__rulesText">{s.rules.trim()?s.rules.split(/\n\s*\n/).filter(Boolean).map((paragraph,index)=><p key={index}>{paragraph}</p>):<p>Правила пока не опубликованы. Уточните условия у команды PULSEDV.RU.</p>}</div><button type="button" className="giveawayExperience__collapse" onClick={()=>{if(rules.current){rules.current.open=false;rules.current.querySelector('summary')?.focus();rules.current.scrollIntoView({block:'nearest'})}}}>Свернуть правила <ChevronDown size={16}/></button></details>
  <p className="giveawayExperience__artNote">Изображение приза — художественная визуализация. Характеристики и порядок вручения указаны в правилах.</p>
 </div>;
}
