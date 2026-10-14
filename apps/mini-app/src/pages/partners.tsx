import React from 'react';
import {Link} from 'react-router-dom';
import {useQueryClient,useQuery} from '@tanstack/react-query';
import {ArrowLeft,UsersRound,Send,Copy,UserPlus,ChevronRight,Check,Wallet,RefreshCw,ShieldCheck,Info,Clock3,CheckCircle2,XCircle,ArrowUpRight} from 'lucide-react';
import {runtime,api} from '../../../../packages/pulse-data/runtime';
import {joinPartner,acceptPartnerTerms,createPartnerInvite,requestPartnerPayout} from '../../../../packages/partners/client';
import {PARTNER_TERMS_VERSION,partnerMoney,partnerLink,referralLabels,rewardLabels,partnerRejectReasons,type PartnerRejectReason,type PartnerReferral} from '../../../../packages/partners/model';
import {usePartners} from '../helpers/usePartners';
import {PageHeader} from '../components/PageHeader';
import {SegmentedControl} from '../components/SegmentedControl';
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from '../components/Sheet';
import {Input} from '../components/Input';
import {NativeSelect} from '../components/NativeSelect';
import {PartnerTerms} from '../components/PartnerTerms';
import {claimLabel} from '../../../../packages/partners/policy';
import {businessDay} from '../../../../packages/pulse-data/business';
import styles from './partners.module.css';

type PartnerSheet='invite'|'personal'|'terms'|'upgrade'|'demo'|'calculation';
const tabs=[{value:'clients' as const,label:'Мои клиенты'},{value:'payments' as const,label:'Выплаты'}];
const dateLabel=(date:string)=>new Date(date).toLocaleDateString('ru-RU',{timeZone:'Asia/Vladivostok',day:'numeric',month:'long'});
function nextStep(r:PartnerReferral){
 if(r.status==='rejected')return partnerRejectReasons[r.rejectionReason as PartnerRejectReason]||'Условия программы не выполнены. Свяжитесь с PULSE, если нужна проверка решения.';
 if(r.status==='pending')return 'Связываемся с покупателем и проверяем, что он пришёл впервые. После проверки здесь появится результат.';
 if(r.reward?.status==='paid')return 'Выплата подтверждена агентством'+(r.reward.paidOn?' '+dateLabel(r.reward.paidOn):'')+'. Сумма перевода указана с учётом удержаний.';
 if(r.reward?.status==='requested')return 'Запрос на выплату принят. Команда проверит документы и реквизиты, затем подтвердит перевод.';
 if(r.reward?.status==='accrued')return 'Вознаграждение начислено. Выберите статус получателя и запросите оформление выплаты.';
 if(r.reward?.status==='void')return 'Начисление отменено. Команда уточнит расчёт; прежняя запись остаётся в истории.';
 if(r.stage==='lost')return 'Покупка не состоялась. Если планы покупателя изменятся, свяжитесь с командой PULSE.';
 if(r.claimExpiresOn&&r.claimExpiresOn<businessDay())return 'Срок закрепления завершён. Если покупка состоялась в срок, команда проверит вознаграждение после получения комиссии.';
 if(['deal','closed'].includes(r.stage))return 'Сделка состоялась. Вознаграждение появится после поступления комиссии и проверки расчёта агентством.';
 return 'Клиент закреплён за вами. Команда сопровождает покупку, а её этапы появляются в этом кабинете.';
}
export default function PartnersPage(){
 const [page,setPage]=React.useState(1),q=usePartners(page),cache=useQueryClient();
 const [name,setName]=React.useState(''),[phone,setPhone]=React.useState(''),[consent,setConsent]=React.useState(false),[upgradeConsent,setUpgradeConsent]=React.useState(false);
 const [busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[notice,setNotice]=React.useState('');
 const [tab,setTab]=React.useState<'clients'|'payments'>('clients'),[sheet,setSheet]=React.useState<PartnerSheet|null>(null),[selectedId,setSelectedId]=React.useState<string|null>(null);
 const [label,setLabel]=React.useState(''),[inviteCode,setInviteCode]=React.useState<string|null>(null),[recipient,setRecipient]=React.useState('person');
 const inviteKey=React.useRef(crypto.randomUUID());
 const program=useQuery({queryKey:['partner-program'],queryFn:()=>runtime.enabled?api<{botUsername:string;offerPublished:boolean}>('/public/partner-program'):Promise.resolve({botUsername:'pulsedvbot',offerPublished:false}),staleTime:600000});
 const offerReady=!runtime.enabled||program.data?.offerPublished===true;
 const p=q.data?.partner,needsTerms=!!p&&p.termsVersion!==PARTNER_TERMS_VERSION,canInvite=p?.status==='active'&&!needsTerms;
 const selected=q.data?.referrals.find(r=>r.id===selectedId),summary=q.data?.summary;
 const shareUrl=partnerLink(inviteCode||p?.code||'',window.location.origin+window.location.pathname,runtime.enabled?program.data?.botUsername:undefined);
 const run=async(fn:()=>Promise<unknown>)=>{
  if(busy)return false;setBusy(true);setError('');
  try{await fn();await cache.invalidateQueries({queryKey:['partner-cabinet']});return true}
  catch(e){setError(e instanceof Error?e.message:'Не удалось выполнить действие');return false}
  finally{setBusy(false)}
 };
 const openSheet=(kind:PartnerSheet)=>{setError('');setSheet(kind);if(kind==='upgrade')setUpgradeConsent(false)};
 const openReferral=(r:PartnerReferral)=>{setError('');setSelectedId(r.id);setRecipient('person')};
 const copy=async()=>{if(!canInvite)return;try{await navigator.clipboard.writeText(shareUrl);setNotice('Ссылка скопирована')}catch{setNotice('Скопируйте ссылку из поля ниже')}};
 const share=async()=>{if(!canInvite)return;try{if(navigator.share)await navigator.share({title:'PULSE.DV',text:'Поможем выбрать квартиру и разобраться с ипотекой. Оставьте заявку по моему приглашению.',url:shareUrl});else await copy()}catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))setNotice('Скопируйте ссылку из поля приглашения')}};
 React.useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),3500);return()=>clearTimeout(timer)},[notice]);
 const titles:Record<PartnerSheet,string>={invite:'Пригласить покупателя',personal:'Персональное приглашение',terms:'Условия программы',upgrade:'Обновлённые условия',demo:'Демонстрационный режим',calculation:'Как считается вознаграждение'};
 const descriptions:Record<PartnerSheet,string>={invite:'Покупатель подтвердит вашу рекомендацию в заявке.',personal:'Отдельная ссылка для конкретного знакомства.',terms:'Закрепление клиента, расчёт и оформление выплаты.',upgrade:'Новые правила применяются к новым рекомендациям после вашего согласия.',demo:'Здесь можно пройти путь от приглашения до выплаты.',calculation:'30% от комиссии агентства после вычета 6%.'};
 const referralRow=(r:PartnerReferral)=><button className={styles.client} key={r.id} onClick={()=>openReferral(r)}>
  <span className={styles.avatar}>{tab==='payments'?<Wallet size={17}/>:r.clientName[0]}</span>
  <span className={styles.clientCopy}><b>{r.clientName}</b><small>{r.status==='accepted'?r.stageLabel:referralLabels[r.status]}</small>
   {r.status==='accepted'&&tab==='clients'&&<small>{claimLabel(r.claimExpiresOn)}</small>}
   <em data-status={r.reward?.status||r.status}>{r.reward?rewardLabels[r.reward.status]:referralLabels[r.status]}</em>
  </span>
  <span className={styles.clientEnd}>{r.reward&&<b>{partnerMoney(r.reward.status==='paid'?r.reward.paidMinor:r.reward.grossMinor)}</b>}<ChevronRight size={15}/></span>
 </button>;
 return <div className={styles.page}>
  <nav className={styles.topbar} aria-label="Навигация"><Link to="/profile" className={styles.back} aria-label="Вернуться в профиль"><ArrowLeft size={20}/></Link><span>В профиль</span>
   {p&&<button className={styles.refresh} aria-label="Обновить рекомендации" disabled={q.isFetching} onClick={()=>void q.refetch()}><RefreshCw size={17}/></button>}
  </nav>
  <PageHeader eyebrow="PULSE.DV · ПАРТНЁРАМ" title={p?'Мои рекомендации':'Рекомендуйте PULSE'} subtitle={p?'Ваши покупатели, этапы сделки и вознаграждение.':'Помогите знакомому найти квартиру и зарабатывайте вместе с нами.'}/>
  {!runtime.enabled&&<button className={styles.demoLabel} onClick={()=>openSheet('demo')}><Info size={13}/>Демонстрационный режим<ChevronRight size={12}/></button>}
  {q.isLoading&&<div className={styles.card} role="status">Загружаем партнёрский кабинет…</div>}
  {q.error&&<div className={styles.error} role="alert">{q.error.message}<button onClick={()=>void q.refetch()}>Повторить</button></div>}
  {error&&p&&!sheet&&!selected&&<div className={styles.error} role="alert">{error}</div>}
  {!q.isLoading&&q.data&&!p&&<>
   <section className={styles.hero}><div className={styles.heroTop}><span>За вашу рекомендацию</span><Wallet size={23}/></div><strong>30%</strong><h2>от комиссии за покупку квартиры через PULSE.DV</h2><p>После вычета 6%. Начисление до налогов получателя.</p><button className={styles.heroLink} onClick={()=>openSheet('calculation')}>100 000 ₽ комиссии → 28 200 ₽ вам<ArrowUpRight size={15}/></button></section>
   <section className={styles.card}><h2>Как это работает</h2><ol className={styles.steps}><li><b>Поделитесь приглашением</b><span>Покупатель сам отправит заявку и подтвердит рекомендацию.</span></li><li><b>Мы проверим и закрепим клиента</b><span>Вы увидите результат и дальнейшие этапы покупки.</span></li><li><b>Получите вознаграждение</b><span>После сделки, поступления комиссии и оформления документов.</span></li></ol></section>
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
   <section className={styles.balance} aria-label="Сводка вознаграждения"><div className={styles.balanceTop}><span>Начислено · до удержаний</span><Wallet size={20}/></div>
    <strong>{partnerMoney(summary.accruedMinor)}</strong>
    <div className={styles.balanceCounts} aria-label="Результат рекомендаций"><span><UsersRound size={14}/><b>{summary.acceptedCount}</b> закреплено</span><span><Clock3 size={14}/><b>{summary.pendingCount}</b> на проверке</span></div>
    <div className={styles.balanceBottom}><span>Выплачено <b>{partnerMoney(summary.paidMinor)}</b></span><button onClick={()=>openSheet('calculation')}>Как считается<Info size={13}/></button></div>
   </section>
   {needsTerms&&<section className={styles.rulesNotice}><span className={styles.ruleIcon}><ShieldCheck size={20}/></span><div><b>Обновились условия программы</b><p>Чтобы приглашать новых покупателей, ознакомьтесь с новой редакцией.</p><button onClick={()=>openSheet('upgrade')}>Ознакомиться<ChevronRight size={14}/></button></div></section>}
   {p.status==='paused'&&<div className={styles.warning}>Новые приглашения временно недоступны. Команда поможет уточнить причину.</div>}
   <SegmentedControl ariaLabel="Разделы партнёрского кабинета" value={tab} options={tabs} onChange={setTab}/>
   <div className={styles.tabPanel} role="tabpanel" aria-label={tab==='clients'?'Мои клиенты':'Выплаты'} key={tab}>
    {tab==='clients'?<>
     <div className={styles.actions}><button className={styles.primary} disabled={!canInvite} onClick={()=>{setInviteCode(null);openSheet('invite')}}><Send size={17}/>Пригласить покупателя</button>
      <button className={styles.personalAction} disabled={!canInvite} onClick={()=>{setInviteCode(null);setLabel('');inviteKey.current=crypto.randomUUID();openSheet('personal')}}><UserPlus size={16}/>Персональное приглашение<ChevronRight size={14}/></button></div>
     <div className={styles.sectionHead}><h2>Рекомендации</h2><span>{q.data.total}</span></div>
     <section className={styles.list} aria-label="Ваши рекомендации">{q.data.referrals.length?q.data.referrals.map(referralRow):<div className={styles.empty}><span><UsersRound size={24}/></span><b>Рекомендаций пока нет</b><p>Отправьте знакомому приглашение. Его заявка появится здесь после подтверждения.</p></div>}</section>
     {q.data.invitations.length>0&&<section className={styles.card}><h2>Персональные приглашения</h2>{q.data.invitations.map(i=><button className={styles.invitation} disabled={!canInvite} key={i.id} onClick={()=>{setInviteCode(i.code);openSheet('invite')}}><span><b>{i.label}</b><small>{q.data!.referrals.some(r=>r.invitationId===i.id)?'Покупатель оставил заявку':'Ожидаем заявку покупателя'}</small></span><Copy size={16}/></button>)}</section>}
    </>:<>
     <div className={styles.sectionHead}><h2>История начислений</h2></div>
     <section className={styles.list} aria-label="Ваши начисления">{q.data.referrals.some(r=>r.reward)?q.data.referrals.filter(r=>r.reward).map(referralRow):<div className={styles.empty}><span><Wallet size={24}/></span><b>Начислений пока нет</b><p>После покупки и поступления комиссии здесь появится ваше вознаграждение.</p><button className={styles.inlineLink} onClick={()=>openSheet('calculation')}>Посмотреть пример<ChevronRight size={14}/></button></div>}</section>
     <p className={styles.hint}>Начисление — до удержаний. В выплаченных записях показана фактическая сумма перевода.{q.data.hasMore?' Остальные записи доступны на следующих страницах.':''}</p>
    </>}
    {(page>1||q.data.hasMore)&&<div className={styles.paging}><button disabled={page===1} onClick={()=>setPage(n=>n-1)}>Назад</button><span>Страница {page}</span><button disabled={!q.data.hasMore} onClick={()=>setPage(n=>n+1)}>Далее</button></div>}
   </div>
  </>}
  <div className={styles.programFooter}><Link to={'/partner-offer?version='+encodeURIComponent(p?.termsVersion||PARTNER_TERMS_VERSION)}><ShieldCheck size={14}/>Оферта и принятая редакция<ChevronRight size={13}/></Link>{p?.termsAcceptedAt&&<small>Условия приняты {dateLabel(p.termsAcceptedAt)}</small>}</div>
  {notice&&<div className={styles.notice} role="status">{notice}</div>}
  <Sheet open={!!sheet} onOpenChange={open=>{if(!open&&!busy){setSheet(null);setError('')}}}><SheetContent side="bottom" className={styles.sheet}>
   <SheetHeader><SheetTitle>{sheet?titles[sheet]:''}</SheetTitle><SheetDescription>{sheet?descriptions[sheet]:''}</SheetDescription></SheetHeader>
   {error&&<p className={styles.error} role="alert">{error}</p>}
   {sheet==='terms'&&<PartnerTerms version={p?.termsVersion||PARTNER_TERMS_VERSION}/>}
   {sheet==='upgrade'&&<div className={styles.form}><div className={styles.ruleSummary}><div><ShieldCheck size={18}/><span><b>Закреп на 6 месяцев</b><small>После подтверждения клиента агентством</small></span></div><div><UsersRound size={18}/><span><b>Первая действительная рекомендация</b><small>После проверки уникальности покупателя</small></span></div><div><Wallet size={18}/><span><b>30% после вычета 6%</b><small>Старые рекомендации сохраняют свою редакцию</small></span></div></div>
    <Link className={styles.inlineLink} to="/partner-offer">Прочитать оферту<ChevronRight size={14}/></Link>
    <label className={styles.consent}><input type="checkbox" checked={upgradeConsent} disabled={busy} onChange={e=>setUpgradeConsent(e.target.checked)}/><span>Принимаю новую редакцию условий программы</span></label>
    {!offerReady&&<p className={styles.hint}>Принятие станет доступно после публикации окончательных условий.</p>}
    <button className={styles.primary} disabled={busy||!upgradeConsent||!offerReady} onClick={()=>void(async()=>{if(await run(()=>acceptPartnerTerms({consent:upgradeConsent,termsVersion:PARTNER_TERMS_VERSION}))){setSheet(null);setNotice('Условия приняты. Приглашения доступны.')}})()}>{busy?'Сохраняем…':'Принять новую редакцию'}</button>
   </div>}
   {sheet==='demo'&&<div className={styles.sheetInfo}><span className={styles.largeIcon}><Info size={23}/></span><h3>Познакомьтесь с программой</h3><p>Рекомендации и выплаты в демоверсии сохраняются в этом браузере. Можно создать приглашение, оставить заявку и проверить её в PULSE Control.</p><p>Переводы не выполняются. Для работы с реальными клиентами будет подключена общая база сервиса.</p><button className={styles.secondary} onClick={()=>setSheet(null)}>Понятно</button></div>}
   {sheet==='calculation'&&<div className={styles.sheetInfo}><div className={styles.calculation}><span>Комиссия агентства<b>100 000 ₽</b></span><span>Вычет 6%<b>6 000 ₽</b></span><span>База для расчёта<b>94 000 ₽</b></span><span>Вознаграждение 30%<b>28 200 ₽</b></span></div><p>Это пример расчёта до налогов получателя. Начисление появляется после покупки, получения комиссии и проверки агентством.</p><Link className={styles.inlineLink} to="/partner-offer">Подробнее в оферте<ChevronRight size={14}/></Link></div>}
   {sheet==='personal'&&<form className={styles.form} onSubmit={e=>{e.preventDefault();void run(async()=>{const data=await createPartnerInvite({label,idempotencyKey:inviteKey.current});setInviteCode(data.invitation.code);setSheet('invite')})}}><label>Название приглашения<Input value={label} onChange={e=>setLabel(e.target.value)} maxLength={100} minLength={2} required placeholder="Например, знакомый из Уссурийска"/></label><p className={styles.hint}>Покупатель укажет свой телефон сам. Ссылка помогает узнать, по какому знакомству он пришёл.</p><button className={styles.primary} disabled={busy}>{busy?'Создаём…':'Создать приглашение'}</button></form>}
   {sheet==='invite'&&<div className={styles.form}>{!canInvite&&<p className={styles.warning}>Приглашение сейчас недоступно. Уточните статус программы в кабинете.</p>}<label>Ваша ссылка<Input readOnly value={shareUrl} onFocus={e=>e.currentTarget.select()}/></label><button className={styles.primary} disabled={!canInvite} onClick={()=>void share()}><Send size={17}/>Поделиться приглашением</button><button className={styles.secondary} disabled={!canInvite} onClick={()=>void copy()}><Copy size={17}/>Скопировать ссылку</button><Link className={styles.inlineLink} to={'/partner-invite?code='+encodeURIComponent(inviteCode||p?.code||'')}>Посмотреть приглашение<ChevronRight size={14}/></Link><p className={styles.hint}>Закрепление подтверждает агентство после обращения покупателя и проверки совпадений.</p></div>}
  </SheetContent></Sheet>
  <Sheet open={!!selected} onOpenChange={open=>{if(!open&&!busy){setSelectedId(null);setError('')}}}><SheetContent side="bottom" className={styles.sheet}><SheetHeader><SheetTitle>{selected?.clientName||'Рекомендация'}</SheetTitle><SheetDescription>{selected?referralLabels[selected.status]:''}</SheetDescription></SheetHeader>{selected&&<>
   {error&&<p className={styles.error} role="alert">{error}</p>}
   <section className={styles.progress} data-status={selected.status}><span>{selected.status==='rejected'?<XCircle size={21}/>:selected.reward?.status==='paid'?<CheckCircle2 size={21}/>:<Clock3 size={21}/>}</span><div><b>{selected.reward?rewardLabels[selected.reward.status]:selected.status==='accepted'?selected.stageLabel:referralLabels[selected.status]}</b><p>{nextStep(selected)}</p>{selected.status==='accepted'&&<small>{claimLabel(selected.claimExpiresOn)}</small>}</div></section>
   {selected.reward&&<section className={styles.card}><h2>{rewardLabels[selected.reward.status]}</h2><div className={styles.calculation}><span>Комиссия агентства<b>{partnerMoney(selected.reward.commissionRub*100)}</b></span><span>Вычет 6%<b>{partnerMoney(selected.reward.reserveMinor)}</b></span><span>База для расчёта<b>{partnerMoney(selected.reward.baseMinor)}</b></span><span>Вознаграждение 30%<b>{partnerMoney(selected.reward.grossMinor)}</b></span>{selected.reward.status==='paid'&&<><span>Удержания<b>{partnerMoney(selected.reward.withheldMinor)}</b></span><span>Переведено<b>{partnerMoney(selected.reward.paidMinor)}</b></span></>}</div><p className={styles.hint}>Начисление до налогов получателя. Сумма перевода зависит от документов и необходимых удержаний.</p>{selected.reward.status==='accrued'&&<div className={styles.form}><label>Статус получателя<NativeSelect aria-label="Статус получателя" value={recipient} onChange={e=>setRecipient(e.target.value)}><option value="person">Физическое лицо</option><option value="ip">Индивидуальный предприниматель</option><option value="company">Организация</option><option value="npd">Самозанятый — проверка договора</option></NativeSelect></label><button className={styles.primary} disabled={busy} onClick={()=>void run(()=>requestPartnerPayout(selected.reward!.id,recipient))}>Запросить оформление выплаты</button></div>}</section>}
   <h3 className={styles.historyTitle}>История рекомендации</h3><ol className={styles.timeline}>{selected.events.map(e=><li key={e.id} data-kind={e.kind}><span>{['rejected','void'].includes(e.kind)?<XCircle size={12}/>:<Check size={12}/>}</span><div><b>{e.label}</b><small>{new Date(e.createdAt).toLocaleString('ru-RU',{timeZone:'Asia/Vladivostok',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})}</small></div></li>)}</ol>
  </>}</SheetContent></Sheet>
 </div>;
}
