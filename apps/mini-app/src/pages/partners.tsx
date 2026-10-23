import {BackLink} from "../components/BackLink";
import {IconTile} from '../components/IconTile';
import React from 'react';
import {createPortal} from 'react-dom';
import {Link,useSearchParams} from 'react-router-dom';
import {PartnerReceivingForm} from '../components/PartnerReceivingForm';
import {useQueryClient,useQuery} from '@tanstack/react-query';
import {UsersRound,Send,Copy,UserPlus,ChevronRight,Check,Wallet,RefreshCw,ShieldCheck,Info,Clock3,CheckCircle2,XCircle,ArrowUpRight} from 'lucide-react';
import {runtime,api} from '../../../../packages/pulse-data/runtime';
import {joinPartner,acceptPartnerTerms,createPartnerInvite,getOwnPartnerReferral,reservePartnerClient} from '../../../../packages/partners/client';
import {PARTNER_TERMS_VERSION,partnerReward,partnerMoney,partnerLink,referralLabels,rewardLabels,partnerRejectReasons,type PartnerRejectReason,type PartnerReferral} from '../../../../packages/partners/model';
import {usePartners} from '../helpers/usePartners';
import {PageHeader} from '../components/PageHeader';
import {SegmentedControl} from '../components/SegmentedControl';
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from '../components/Sheet';
import {Slider} from '../components/Slider';
import {Input} from '../components/Input';
import {NativeSelect} from '../components/NativeSelect';
import {PartnerTerms} from '../components/PartnerTerms';
import {claimLabel} from '../../../../packages/partners/policy';
import {businessDay} from '../../../../packages/pulse-data/business';
import styles from './partners.module.css';

const GUIDE_KEY='pulse.partner.guide.v1';
type PartnerSheet='guide'|'invite'|'personal'|'terms'|'upgrade'|'calculation'|'reserve';
const tabs=[{value:'clients' as const,label:'Мои клиенты'},{value:'payments' as const,label:'Выплаты'}];
const reservationDeadline=(date:string)=>new Date(date).toLocaleString('ru-RU',{timeZone:'Asia/Vladivostok',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})+' (Владивосток)';
const dateLabel=(date:string)=>new Date(date).toLocaleDateString('ru-RU',{timeZone:'Asia/Vladivostok',day:'numeric',month:'long'});
function nextStep(r:PartnerReferral){
 if(r.status==='rejected')return partnerRejectReasons[r.rejectionReason as PartnerRejectReason]||'Условия программы не выполнены. Свяжитесь с PULSE, если нужна проверка решения.';
 if(r.status==='pending')return 'Связываемся с покупателем и проверяем, что он пришёл впервые. После проверки здесь появится результат.';
 if(r.reward?.status==='paid')return 'Выплата подтверждена агентством'+(r.reward.paidOn?' '+dateLabel(r.reward.paidOn):'')+'. Выплаченная сумма указана с учётом удержаний.';
 if(r.reward?.payoutStage==='agreed'&&['accrued','requested'].includes(r.reward.status))return 'Способ получения согласован. Ниже указаны реквизиты или адрес и время приезда в офис. Выплата появится в истории после подтверждения командой.';
 if(r.reward?.status==='requested')return 'Запрос принят. Команда согласует с вами способ получения и проверит документы. Здесь можно уточнить данные.';
 if(r.reward?.status==='accrued')return 'Вознаграждение начислено. Выберите удобный способ получения и отправьте данные команде.';
 if(r.reward?.status==='void')return 'Начисление отменено. Команда уточнит расчёт; прежняя запись остаётся в истории.';
 if(r.stage==='lost')return 'Покупка не состоялась. Если планы покупателя изменятся, свяжитесь с командой PULSE.';
 if(r.claimExpiresOn&&r.claimExpiresOn<businessDay())return 'Срок закрепления завершён. Если покупка состоялась в срок, команда проверит вознаграждение после получения комиссии.';
 if(['deal','closed'].includes(r.stage))return 'Сделка состоялась. Вознаграждение появится после поступления комиссии и проверки расчёта агентством.';
 return 'Клиент закреплён за вами. Команда сопровождает покупку, а её этапы появляются в этом кабинете.';
}
const journeyLabels=['Знакомство','Подбор','Сделка','Выплата'];
function ClientJourney({referral,detail=false}:{referral:PartnerReferral;detail?:boolean}){
 const r=referral,paid=r.reward?.status==='paid';
 const stopped=r.status!=='accepted'||r.stage==='lost'||r.reward?.status==='void'||(!r.reward&&!!r.claimExpiresOn&&r.claimExpiresOn<businessDay());
 const current=r.reward?3:['deal','closed'].includes(r.stage)?2:['qualified','showing','booking'].includes(r.stage)?1:0;
 const state=paid?'Выплата получена':stopped?'Путь приостановлен':journeyLabels[current];
 return <span className={detail?styles.journeyDetail:styles.journey} role="group" aria-label={'Путь клиента: '+state} data-stopped={stopped}>
  {journeyLabels.map((label,index)=><span key={label} data-state={stopped?'paused':paid||index<current?'done':index===current?'current':'next'} aria-current={!stopped&&!paid&&index===current?'step':undefined}><i aria-hidden="true">{detail&&(paid||index<current)&&!stopped?<Check size={12}/>:detail?index+1:null}</i>{detail&&<small>{label}</small>}</span>)}
 </span>;
}
export default function PartnersPage(){
 const [exampleCommission,setExampleCommission]=React.useState(100000);
 const example=partnerReward(exampleCommission);
 const [page,setPage]=React.useState(1);
 const [tab,setTab]=React.useState<'clients'|'payments'>('clients');
 const q=usePartners(page,tab),cache=useQueryClient();
 const [clientPhone,setClientPhone]=React.useState(''),[clientLabel,setClientLabel]=React.useState(''),[contactConsent,setContactConsent]=React.useState(false),[reservationResult,setReservationResult]=React.useState<import('../../../../packages/partners/model').ReservationResult|null>(null);
 const reserveKey=React.useRef(crypto.randomUUID());
 const [name,setName]=React.useState(''),[phone,setPhone]=React.useState(''),[consent,setConsent]=React.useState(false),[upgradeConsent,setUpgradeConsent]=React.useState(false);
 const [busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[notice,setNotice]=React.useState('');
 const [sheet,setSheet]=React.useState<PartnerSheet|null>(null);
 const [params,setParams]=useSearchParams(),selectedId=params.get('referral');
 const setSelectedId=(id:string|null)=>{const next=new URLSearchParams(params);if(id)next.set('referral',id);else next.delete('referral');setParams(next,{replace:!id})};
 const deep=useQuery({queryKey:['partner-referral',selectedId],queryFn:()=>getOwnPartnerReferral(selectedId!),enabled:!!selectedId,staleTime:0});
 const [label,setLabel]=React.useState(''),[inviteCode,setInviteCode]=React.useState<string|null>(null);
 const inviteKey=React.useRef(crypto.randomUUID()),guideShown=React.useRef(false);
 const dismissSheet=()=>{if(sheet==='guide'){try{localStorage.setItem(GUIDE_KEY,'seen')}catch{}}setSheet(null);setError('')};
 React.useEffect(()=>{if(q.isLoading||!q.data||guideShown.current)return;guideShown.current=true;try{if(localStorage.getItem(GUIDE_KEY)==='seen')return}catch{}setSheet('guide')},[q.isLoading,q.data]);
 const program=useQuery({queryKey:['partner-program'],queryFn:()=>runtime.enabled?api<{botUsername:string;offerPublished:boolean}>('/public/partner-program'):Promise.resolve({botUsername:'pulsedvbot',offerPublished:false}),staleTime:600000});
 const offerReady=!runtime.enabled||program.data?.offerPublished===true;
 const p=q.data?.partner,needsTerms=!!p&&p.termsVersion!==PARTNER_TERMS_VERSION,canInvite=p?.status==='active'&&!needsTerms;
 const waiting=(q.data?.reservations||[]).filter(r=>!r.submitted),unsubmittedInvites=(q.data?.invitations||[]).filter(i=>!i.submitted&&!q.data?.reservations?.some(r=>r.code===i.code));
 const selected=(deep.data?.referral?.id===selectedId?deep.data.referral:null)||q.data?.referrals.find(r=>r.id===selectedId),summary=q.data?.summary;
 React.useEffect(()=>{if(deep.error)setError(deep.error instanceof Error?deep.error.message:'Не удалось открыть рекомендацию')},[deep.error]);
 const shareUrl=partnerLink(inviteCode||p?.code||'',window.location.origin+window.location.pathname,runtime.enabled?program.data?.botUsername:undefined);
 const run=async(fn:()=>Promise<unknown>)=>{
  if(busy)return false;setBusy(true);setError('');
  try{await fn();await Promise.all([cache.invalidateQueries({queryKey:['partner-cabinet']},{throwOnError:true}),cache.invalidateQueries({queryKey:['partner-referral']},{throwOnError:true})]);return true}
  catch(e){setError(e instanceof Error?e.message:'Не удалось выполнить действие');return false}
  finally{setBusy(false)}
 };
 const openSheet=(kind:PartnerSheet)=>{setError('');setSheet(kind);if(kind==='upgrade')setUpgradeConsent(false)};
 const startReserve=()=>{setClientPhone('');setClientLabel('');setContactConsent(false);setReservationResult(null);reserveKey.current=crypto.randomUUID();openSheet('reserve')};
 const openReferral=(r:PartnerReferral)=>{setError('');setSelectedId(r.id)};
 const copy=async()=>{if(!canInvite)return;try{await navigator.clipboard.writeText(shareUrl);setNotice('Ссылка скопирована')}catch{setNotice('Скопируйте ссылку из поля ниже')}};
 const share=async()=>{if(!canInvite)return;try{if(navigator.share){await navigator.share({title:'PULSEDV.RU',text:'Поможем выбрать квартиру и разобраться с ипотекой. Оставьте заявку по моему приглашению и подтвердите, что пришли от меня.',url:shareUrl});setSheet(null)}else await copy()}catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))setNotice('Скопируйте ссылку из поля приглашения')}};
 React.useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),3500);return()=>clearTimeout(timer)},[notice]);
 const titles:Record<PartnerSheet,string>={guide:'Как привести клиента и получить выплату',invite:'Отправить ссылку покупателю',personal:'Персональное приглашение',terms:'Условия программы',upgrade:'Обновлённые условия',reserve:'Добавить клиента',calculation:'Как считается вознаграждение'};
 const descriptions:Record<PartnerSheet,string>={guide:'Три шага. Сначала проверяем номер, затем покупатель подтверждает, что пришёл от вас.',invite:'Покупатель откроет ссылку, укажет свой номер и подтвердит, что пришёл от вас.',personal:'Отдельная ссылка для конкретного знакомства.',terms:'Закрепление клиента, расчёт и оформление выплаты.',upgrade:'Новые правила применяются к новым рекомендациям после вашего согласия.',reserve:reservationResult?.reservation?'Шаг 2 из 2. Номер проверен — осталось отправить ссылку клиенту.':'Шаг 1 из 2. Введите имя и телефон с разрешения покупателя — мы сразу проверим номер.',calculation:'30% от комиссии агентства после вычета 6%.'};
 const today=businessDay();
 const expired=(r:PartnerReferral)=>r.status==='accepted'&&!!r.claimExpiresOn&&r.claimExpiresOn<today;
 const referralRow=(r:PartnerReferral,index:number)=><button className={styles.client} key={r.id} style={{'--row-index':Math.min(index,4)} as React.CSSProperties} onClick={()=>openReferral(r)}>
  {tab==='payments'?<IconTile><Wallet/></IconTile>:<span className={styles.avatar}>{r.clientName[0]}</span>}
  <span className={styles.clientCopy}><b>{r.clientName}</b><small>{r.status==='accepted'?r.stageLabel:r.status==='pending'?'Проверяем рекомендацию':'Откройте результат проверки'}</small>
   {r.status==='accepted'&&tab==='clients'&&<small>{claimLabel(r.claimExpiresOn,today)}</small>}
   <ClientJourney referral={r}/><em key={r.reward?.status||(expired(r)?'expired':r.status)} data-status={r.reward?.status||(expired(r)?'expired':r.status)}>{r.reward?rewardLabels[r.reward.status]:expired(r)?'Срок закрепа истёк':referralLabels[r.status]}</em>
  </span>
  <span className={styles.clientEnd}>{r.reward&&<b>{partnerMoney(r.reward.status==='paid'?r.reward.paidMinor:r.reward.grossMinor)}</b>}<ChevronRight size={15}/></span>
 </button>;
 return <div className={styles.page}>
  <nav className={styles.topbar} aria-label="Навигация"><BackLink to="/profile" aria-label="Вернуться в профиль"/>
   {p?<h1>Партнёрам</h1>:<span className={styles.navTitle}>Партнёрам</span>}
   <button className={styles.helpButton} aria-label="Как закрепить клиента и получить выплату" title="Как это работает" onClick={()=>openSheet('guide')}><Info size={20}/></button>
   {p&&<button className={styles.refresh} aria-label="Обновить рекомендации" title="Обновить" aria-busy={q.isFetching} disabled={q.isFetching} onClick={()=>void q.refetch()}><RefreshCw size={20}/></button>}
  </nav>
  {!q.isLoading&&q.data&&!p&&<PageHeader title="Рекомендуйте PULSE" subtitle="Помогите знакомому найти квартиру и зарабатывайте вместе с нами." compact/>}
  {q.isLoading&&<div className={styles.card} role="status">Загружаем партнёрский кабинет…</div>}
  {q.error&&<div className={styles.error} role="alert">{q.error.message}<button onClick={()=>void q.refetch()}>Повторить</button></div>}
  {error&&p&&!sheet&&!selected&&<div className={styles.error} role="alert">{error}</div>}
  {!q.isLoading&&q.data&&!p&&<>
   <section className={styles.hero}><div className={styles.heroTop}><span>За вашу рекомендацию</span><Wallet size={23}/></div><strong>30%</strong><h2>от комиссии за покупку квартиры через PULSEDV.RU</h2><p>После вычета 6%. Начисление до налогов получателя.</p><button className={styles.heroLink} onClick={()=>openSheet('calculation')}>100 000 ₽ комиссии → 28 200 ₽ вам<ArrowUpRight size={15}/></button></section>
   <section className={styles.card}><h2>Как это работает</h2><ol className={styles.steps}><li><b>Добавьте клиента</b><span>Подключитесь к программе и введите его имя и телефон с его разрешения.</span></li><li><b>Отправьте ему ссылку</b><span>После проверки номера покупатель подтвердит приглашение. Закреп — на 1 месяц, дата будет в кабинете.</span></li><li><b>Получите вознаграждение</b><span>После сделки, поступления комиссии и оформления документов.</span></li></ol></section>
   <section className={styles.card}><h2>Подключиться к программе</h2>
    {runtime.enabled&&program.data?.offerPublished===false&&<p>Подключение станет доступно после публикации окончательных условий программы.</p>}
    {program.isError&&<p className={styles.error} role="alert">Не удалось загрузить условия. <button onClick={()=>void program.refetch()}>Повторить</button></p>}
    {q.data.authenticated?<form className={styles.form} onSubmit={e=>{e.preventDefault();void run(()=>joinPartner({name,phone,consent,termsVersion:PARTNER_TERMS_VERSION}))}}>
     <label>Ваше имя для приглашения<Input value={name} onChange={e=>setName(e.target.value)} maxLength={80} minLength={2} required autoComplete="given-name" placeholder="Как представить вас покупателю"/></label>
     <label>Ваш контактный телефон<Input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} required maxLength={24} autoComplete="tel" placeholder="+7 999 000-00-00"/></label>
     <label className={styles.consent}><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required/><span>Принимаю <button type="button" onClick={()=>openSheet('terms')}>условия программы</button> и даю <Link to="/personal-data-consent">согласие на обработку данных</Link>.</span></label>
     {error&&<p className={styles.error} role="alert">{error}</p>}<button className={styles.primary} disabled={busy||!consent||!offerReady}>{busy?'Подключаем…':'Стать партнёром PULSE'}</button>
    </form>:<><p>Для личного кабинета подтвердите вход через Telegram.</p><a className={styles.primary} href={'https://t.me/'+(program.data?.botUsername||'pulsedvbot')+'?startapp=partners'}>Открыть в Telegram</a></>}
   </section>
  </>}
  {p&&q.data&&summary&&<>
   {needsTerms&&<section className={styles.rulesNotice}><IconTile className={styles.ruleIcon}><ShieldCheck size={20}/></IconTile><div><b>Обновились условия программы</b><p>Новые клиенты закрепляются на 1 месяц. Принятые ранее рекомендации сохраняют свою дату. Прочитайте условия, чтобы добавлять новых клиентов.</p><button onClick={()=>openSheet('upgrade')}>Ознакомиться<ChevronRight size={14}/></button></div></section>}
   {p.status==='paused'&&<div className={styles.warning}>Новые приглашения временно недоступны. Команда поможет уточнить причину.</div>}
   <section className={styles.balance} aria-label="Сводка вознаграждения">
    <div className={styles.programIntro}>
     <div className={styles.programPitch}><span className={styles.eyebrow}>Рекомендуйте PULSE</span><strong>30<span>%</span></strong><p>от комиссии<br/>после вычета 6%</p><button className={styles.calculateLink} onClick={()=>openSheet('calculation')}>Посчитать доход<ArrowUpRight size={14}/></button></div>
     <img className={styles.programArt} src={import.meta.env.BASE_URL+'_cdn/static/partner-house-key-v1.webp'} width="640" height="640" alt="" aria-hidden="true" decoding="async"/>
    </div>
    <div className={styles.earnings}><span>Начислено · до удержаний<b>{partnerMoney(summary.accruedMinor)}</b></span><span>Выплачено<b>{partnerMoney(summary.paidMinor)}</b></span><Wallet size={20} aria-hidden="true"/></div>
    <div className={styles.balanceActions}><button className={styles.primary} disabled={!canInvite} onClick={startReserve}><UserPlus size={18}/>Добавить клиента</button><button className={styles.personalAction} disabled={!canInvite} onClick={()=>{setInviteCode(null);openSheet('invite')}}>Не знаете номер? Отправить ссылку<ChevronRight size={14}/></button></div>
   </section>
   <SegmentedControl ariaLabel="Разделы партнёрского кабинета" value={tab} options={tabs} onChange={value=>{setPage(1);setTab(value)}}/>
   <div className={styles.tabPanel} role="tabpanel" aria-label={tab==='clients'?'Мои клиенты':'Выплаты'} key={tab}>
    {tab==='clients'?<>

     {!!waiting.length&&<section className={styles.card}><h2>Ждём подтверждения клиента</h2><p>Если ещё не отправили ссылку — нажмите на клиента. После его подтверждения здесь появится результат проверки.</p>{waiting.map(r=><button className={styles.invitation} key={r.id} onClick={()=>{setInviteCode(r.code);openSheet('invite')}}><span><b>{r.label} · {r.phoneHint}</b><small>Номер защищён до {reservationDeadline(r.expiresAt)} · отправить ссылку</small></span><Send size={16}/></button>)}</section>}
     <div className={styles.clientsHeading}><div className={styles.sectionHead}><h2>Клиенты</h2><span>{q.data.total}</span></div><div className={styles.balanceCounts} aria-label="Результат рекомендаций"><span><ShieldCheck size={13}/><b>{summary.acceptedCount}</b> принято</span><span><Clock3 size={13}/><b>{summary.pendingCount}</b> на проверке</span></div></div>
     <section className={styles.list} aria-label="Ваши рекомендации">{q.data.referrals.length?q.data.referrals.map(referralRow):<div className={styles.empty}><IconTile><UsersRound size={24}/></IconTile><b>Первое знакомство — первый шаг</b><span className={styles.emptyPath} aria-hidden="true">Знакомство<i/>Покупка<i/>Вознаграждение</span><p>Знакомый ищет квартиру? Добавьте его по кнопке выше. После подтверждения здесь появится весь путь до выплаты.</p></div>}</section>
     {unsubmittedInvites.length>0&&<section className={styles.card}><h2>Ссылки без проверки номера</h2>{unsubmittedInvites.map(i=><button className={styles.invitation} disabled={!canInvite} key={i.id} onClick={()=>{setInviteCode(i.code);openSheet('invite')}}><span><b>{i.label}</b><small>{i.submitted?'Покупатель оставил заявку':'Ожидаем заявку покупателя'}</small></span><Copy size={16}/></button>)}</section>}
    </>:<>
     <div className={styles.sectionHead}><h2>История начислений</h2></div>
     <section className={styles.list} aria-label="Ваши начисления">{q.data.referrals.some(r=>r.reward)?q.data.referrals.filter(r=>r.reward).map(referralRow):<div className={styles.empty}><IconTile><Wallet size={24}/></IconTile><b>Начислений пока нет</b><p>После покупки и поступления комиссии здесь появится ваше вознаграждение.</p><button className={styles.inlineLink} onClick={()=>openSheet('calculation')}>Посмотреть пример<ChevronRight size={14}/></button></div>}</section>
     <p className={styles.hint}>Начисление — до удержаний. В выплаченных записях показана фактическая сумма перевода.{q.data.hasMore?' Остальные записи доступны на следующих страницах.':''}</p>
    </>}
    {(page>1||q.data.hasMore)&&<div className={styles.paging}><button disabled={page===1||q.isPlaceholderData} onClick={()=>setPage(n=>n-1)}>Назад</button><span>Страница {page}</span><button disabled={!q.data.hasMore||q.isPlaceholderData} onClick={()=>setPage(n=>n+1)}>Далее</button></div>}
   </div>
  </>}
  <div className={styles.programFooter}><Link to={'/partner-offer?version='+encodeURIComponent(p?.termsVersion||PARTNER_TERMS_VERSION)}><ShieldCheck size={14}/>Оферта и принятая редакция<ChevronRight size={13}/></Link>{p?.termsAcceptedAt&&<small>Условия приняты {dateLabel(p.termsAcceptedAt)}</small>}</div>
  {notice&&createPortal(<div className={styles.notice} role="status">{notice}</div>,document.body)}
  <Sheet open={!!sheet} onOpenChange={open=>{if(!open&&!busy)dismissSheet()}}><SheetContent side="bottom" className={styles.sheet}>
   <SheetHeader><SheetTitle>{sheet?titles[sheet]:''}</SheetTitle><SheetDescription>{sheet?descriptions[sheet]:''}</SheetDescription></SheetHeader>
   {error&&<p className={styles.error} role="alert">{error}</p>}
   {sheet==='guide'&&<div className={styles.guideBody}>
    {!p&&<p className={styles.guideIntro}>Сначала подключитесь: укажите свои имя и телефон, прочитайте и примите условия. Это делается один раз.</p>}
    <ol className={styles.steps}><li><b>Добавьте клиента</b><span>Введите имя и телефон с разрешения клиента. Сразу проверим номер: повторно закрепить клиента из базы нельзя.</span></li><li><b>Отправьте клиенту ссылку</b><span>Номер защищён за вами на 7 дней. Отправьте ссылку: клиент укажет тот же номер и подтвердит, что пришёл от вас.</span></li><li><b>Проверьте закреп и следите за покупкой</b><span>«Клиент закреплён» и дата — всё готово на 1 календарный месяц. «На проверке» — ждём решения команды. Этапы покупки видны в карточке клиента.</span></li></ol>
    <div className={styles.guideReward}><Wallet size={20}/><div><b>Когда будут деньги?</b><p>После покупки в срок закрепа и получения комиссии. Ваше вознаграждение — 30% после вычета 6%. Пример: со 100 000 ₽ комиссии вам 28 200 ₽ до налогов. Оформление — во вкладке «Выплаты».</p></div></div>
    <p className={styles.hint}>Создать или просто переслать ссылку — ещё не закрепить клиента. Нужно его подтверждение.</p>
    <div className={styles.guideAction}><button className={styles.primary} onClick={dismissSheet}>Понятно, начнём</button></div>
   </div>}
   {sheet==='terms'&&<PartnerTerms version={p?.termsVersion||PARTNER_TERMS_VERSION}/>}
   {sheet==='upgrade'&&<div className={styles.form}><div className={styles.ruleSummary}><div><Clock3 size={18}/><span><b>Предварительная бронь на 7 дней</b><small>Номер защищён до подтверждения покупателя</small></span></div><div><ShieldCheck size={18}/><span><b>Закреп на 1 месяц</b><small>После подтверждения покупателя и проверки</small></span></div><div><UsersRound size={18}/><span><b>Первая действительная рекомендация</b><small>После проверки уникальности покупателя</small></span></div><div><Wallet size={18}/><span><b>30% после вычета 6%</b><small>Старые рекомендации сохраняют свою редакцию</small></span></div></div>
    <Link className={styles.inlineLink} to="/partner-offer">Прочитать оферту<ChevronRight size={14}/></Link>
    <label className={styles.consent}><input type="checkbox" checked={upgradeConsent} disabled={busy} onChange={e=>setUpgradeConsent(e.target.checked)}/><span>Принимаю новую редакцию условий программы</span></label>
    {!offerReady&&<p className={styles.hint}>Принятие станет доступно после публикации окончательных условий.</p>}
    <button className={styles.primary} disabled={busy||!upgradeConsent||!offerReady} onClick={()=>void(async()=>{if(await run(()=>acceptPartnerTerms({consent:upgradeConsent,termsVersion:PARTNER_TERMS_VERSION}))){setSheet(null);setNotice('Условия приняты')}})()}>{busy?'Сохраняем…':'Принять новую редакцию'}</button>
   </div>}
   {sheet==='calculation'&&<div className={styles.sheetInfo}>
    <div className={styles.exampleResult}><span>Пример вашего вознаграждения</span><output aria-label="Вознаграждение в примере" key={example.grossMinor}>{partnerMoney(example.grossMinor)}</output><small>до налогов получателя</small></div>
    <div className={styles.commissionControl}><div><label id="commission-label">Комиссия агентства</label><b>{partnerMoney(exampleCommission*100)}</b></div><Slider aria-label="Комиссия агентства" min={50000} max={500000} step={5000} value={[exampleCommission]} onValueChange={values=>setExampleCommission(values[0])}/><div className={styles.presets}>{[100000,200000,300000].map(value=><button key={value} aria-pressed={exampleCommission===value} onClick={()=>setExampleCommission(value)}>{partnerMoney(value*100)}</button>)}</div></div>
    <div className={styles.calculation}><span>Комиссия агентства<b>{partnerMoney(exampleCommission*100)}</b></span><span>Вычет 6%<b>{partnerMoney(example.reserveMinor)}</b></span><span>База для расчёта<b>{partnerMoney(example.baseMinor)}</b></span><span>Вознаграждение 30%<b>{partnerMoney(example.grossMinor)}</b></span></div><p>Это пример, а не начисление на ваш счёт. Вознаграждение появляется после покупки в срок закрепа, получения комиссии и проверки агентством.</p><Link className={styles.inlineLink} to="/partner-offer">Подробнее в оферте<ChevronRight size={14}/></Link></div>}

   {sheet==='reserve'&&(reservationResult?.reservation?<div className={styles.form}>
    <section className={styles.reserveSuccess} role="status"><IconTile><ShieldCheck size={22}/></IconTile><h3>Номер защищён за вами</h3><p>{reservationResult.reservation.label} · {reservationResult.reservation.phoneHint}</p><p>Теперь отправьте клиенту ссылку. Ему нужно подтвердить приглашение до {reservationDeadline(reservationResult.reservation.expiresAt)}.</p></section>
    <div className={styles.nextAction}><span>Шаг 2 из 2</span><h3>Отправьте ссылку клиенту</h3><p>Он укажет тот же номер и подтвердит, что пришёл от вас. После проверки появится статус «Клиент закреплён» и дата окончания — через 1 месяц.</p></div>
    <button className={styles.primary} onClick={()=>void share()}><Send size={17}/>Отправить ссылку клиенту</button><button className={styles.secondary} onClick={()=>void copy()}>{notice==='Ссылка скопирована'?<Check size={17}/>:<Copy size={17}/>} {notice==='Ссылка скопирована'?'Ссылка скопирована':'Скопировать ссылку'}</button><label>Ссылка для этого клиента<Input readOnly value={shareUrl} onFocus={e=>e.currentTarget.select()}/></label><button className={styles.personalAction} onClick={dismissSheet}>Готово, смотреть моих клиентов<ChevronRight size={14}/></button>
   </div>:<form className={styles.form} onSubmit={e=>{e.preventDefault();void run(async()=>{const result=await reservePartnerClient({phone:clientPhone,label:clientLabel,contactConsent,idempotencyKey:reserveKey.current});setReservationResult(result);if(result.reservation)setInviteCode(result.reservation.code)})}}>
    {!runtime.enabled&&<p className={styles.warning}>Проверка номеров пока недоступна.</p>}
    <label>Имя клиента<Input value={clientLabel} minLength={2} maxLength={100} required autoComplete="off" onChange={e=>{setClientLabel(e.target.value);setReservationResult(null);reserveKey.current=crypto.randomUUID()}} placeholder="Например, Иван"/></label>
    <label>Телефон клиента<Input type="tel" inputMode="tel" autoComplete="off" value={clientPhone} maxLength={24} required onChange={e=>{setClientPhone(e.target.value);setReservationResult(null);reserveKey.current=crypto.randomUUID()}} placeholder="+7 999 000-00-00"/></label>
    <label className={styles.consent}><input type="checkbox" checked={contactConsent} required onChange={e=>setContactConsent(e.target.checked)}/><span>Клиент разрешил передать его телефон PULSE для проверки и связи.</span></label>
    <p className={styles.hint}>Если номер подходит, защитим его за вами на 7 дней и дадим ссылку для клиента. Закреп на 1 месяц начнётся после его заявки и подтверждения. Если клиент уже есть в нашей базе или закреплён, покажем отказ.</p>
    <button className={styles.primary} disabled={busy||!contactConsent||!runtime.enabled}>{busy?'Проверяем номер…':'Проверить номер'}</button>
    {reservationResult&&<div className={styles.warning} role="status"><b>{reservationResult.outcome==='confirmed'?'Клиент уже закреплён':reservationResult.outcome==='self'?'Это ваш номер':reservationResult.outcome==='expired'?'Проверьте номер ещё раз':'Клиента нельзя добавить'}</b><p>{reservationResult.message}</p></div>}
   </form>)}
   {sheet==='personal'&&<form className={styles.form} onSubmit={e=>{e.preventDefault();void run(async()=>{const data=await createPartnerInvite({label,idempotencyKey:inviteKey.current});setInviteCode(data.invitation.code);setSheet('invite')})}}><label>Название приглашения<Input value={label} onChange={e=>setLabel(e.target.value)} maxLength={100} minLength={2} required placeholder="Например, знакомый из Уссурийска"/></label><p className={styles.hint}>Покупатель укажет свой телефон сам. Ссылка помогает узнать, по какому знакомству он пришёл.</p><button className={styles.primary} disabled={busy}>{busy?'Создаём…':'Создать приглашение'}</button></form>}
   {sheet==='invite'&&<div className={styles.form}>{!canInvite&&<p className={styles.warning}>Приглашение сейчас недоступно. Уточните статус программы в кабинете.</p>}<label>Ваша ссылка<Input readOnly value={shareUrl} onFocus={e=>e.currentTarget.select()}/></label><button className={styles.primary} disabled={!canInvite} onClick={()=>void share()}><Send size={17}/>Поделиться приглашением</button><button className={styles.secondary} disabled={!canInvite} onClick={()=>void copy()}>{notice==='Ссылка скопирована'?<Check size={17}/>:<Copy size={17}/>} {notice==='Ссылка скопирована'?'Ссылка скопирована':'Скопировать ссылку'}</button><Link className={styles.inlineLink} to={'/partner-invite?code='+encodeURIComponent(inviteCode||p?.code||'')+'&preview=1'}>Посмотреть приглашение<ChevronRight size={14}/></Link><p className={styles.hint}>{q.data?.reservations?.some(r=>r.code===inviteCode)?'Это ссылка для защищённого за вами номера. Покупатель должен указать тот же телефон и подтвердить приглашение в течение 7 дней.':'Это приглашение без предварительной проверки номера. Покупатель сам укажет телефон. После его заявки проверим, новый ли он клиент.'} Само открытие ссылки не закрепляет клиента. Итоговый статус и дата окончания закрепа появятся в «Моих клиентах».</p><button className={styles.personalAction} disabled={!canInvite} onClick={()=>{setInviteCode(null);setLabel('');inviteKey.current=crypto.randomUUID();openSheet('personal')}}><UserPlus size={16}/>Персональное приглашение<ChevronRight size={14}/></button></div>}
  </SheetContent></Sheet>
  <Sheet open={!!selected} onOpenChange={open=>{if(!open&&!busy){setSelectedId(null);setError('')}}}><SheetContent side="bottom" className={styles.sheet}><SheetHeader><SheetTitle>{selected?.clientName||'Рекомендация'}</SheetTitle><SheetDescription>{selected?referralLabels[selected.status]:''}</SheetDescription></SheetHeader>{selected&&<>
   {error&&<p className={styles.error} role="alert">{error}</p>}
   <section className={styles.progress} data-status={selected.status}><span>{selected.status==='rejected'?<XCircle size={21}/>:selected.reward?.status==='paid'?<CheckCircle2 size={21}/>:selected.status==='accepted'&&!expired(selected)?<ShieldCheck size={21}/>:<Clock3 size={21}/>}</span><div><b>{selected.reward?rewardLabels[selected.reward.status]:selected.status==='accepted'?selected.stageLabel:referralLabels[selected.status]}</b><p>{nextStep(selected)}</p>{selected.status==='accepted'&&<small>{claimLabel(selected.claimExpiresOn)}</small>}</div></section>
   <ClientJourney referral={selected} detail/>
   {selected.reward&&<section className={styles.card}><h2>{rewardLabels[selected.reward.status]}</h2><div className={styles.calculation}><span>Комиссия агентства<b>{partnerMoney(selected.reward.commissionRub*100)}</b></span><span>Вычет 6%<b>{partnerMoney(selected.reward.reserveMinor)}</b></span><span>База для расчёта<b>{partnerMoney(selected.reward.baseMinor)}</b></span><span>Вознаграждение 30%<b>{partnerMoney(selected.reward.grossMinor)}</b></span>{selected.reward.status==='paid'&&<><span>Удержания<b>{partnerMoney(selected.reward.withheldMinor)}</b></span><span>{selected.reward.payoutDetails?.method==='cash'?'Выдано наличными':'Переведено'}<b>{partnerMoney(selected.reward.paidMinor)}</b></span></>}</div><p className={styles.hint}>Начисление до налогов получателя. Сумма перевода зависит от документов и необходимых удержаний.</p>{['accrued','requested','paid'].includes(selected.reward.status)&&<PartnerReceivingForm reward={selected.reward} name={p?.name||''} phone={p?.phone||''} busy={busy} run={run}/>}</section>}
   <h3 className={styles.historyTitle}>История рекомендации</h3><ol className={styles.timeline}>{selected.events.map(e=><li key={e.id} data-kind={e.kind}><span>{['rejected','void'].includes(e.kind)?<XCircle size={12}/>:<Check size={12}/>}</span><div><b>{e.label}</b><small>{new Date(e.createdAt).toLocaleString('ru-RU',{timeZone:'Asia/Vladivostok',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})}</small></div></li>)}</ol>
  </>}</SheetContent></Sheet>
 </div>;
}
