import {useMessageHistory} from '../../../../packages/journey/useMessageHistory';
import React from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {useQueryClient} from '@tanstack/react-query';
import {ArrowLeft, ArrowDown, ArrowUp, CalendarDays, Check, CheckCheck, ChevronRight, FileText, Image as ImageIcon, MessageCircle, Paperclip, RefreshCw, Sparkles, Building2, X} from 'lucide-react';
import {markJourneyRead,saveJourney,uploadJourneyAttachment,type JourneyEntry} from '../../../../packages/journey/client';
import {type JourneyAttachment,type JourneyCommand,type Reaction,reactionLabels,showingLabels} from '../../../../packages/journey/model';
import {ShowingChange} from '../../../../packages/journey/ShowingChange';
import {isFutureVladivostokInput,vladivostokInputNow} from '../../../../packages/journey/time';
import {runtime} from '../../../../packages/pulse-data/runtime';
import type {PulseProperty} from '../../../../packages/pulse-data/model';
import {useClientJourneys} from '../helpers/useClientJourneys';
import styles from '../pages/journey.module.css';

export const journeyStatus=(status:string)=>({new:'Обращение принято',contacted:'На связи',qualified:'Подбираем варианты',showing:'Готовимся к показу',booking:'Бронирование',deal:'Сделка завершена',closed:'Обращение завершено',lost:'Обращение закрыто'}[status]||'Обращение принято');
export const journeyDate=(value:string,short=false)=>new Date(value).toLocaleString('ru-RU',short?{day:'numeric',month:'short'}:{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Vladivostok'});
const clock=(value:string)=>new Date(value).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
function draftFor(id:string){try{return sessionStorage.getItem('pulse.chat-draft.'+id)||''}catch{return ''}}

type Props={entry:JourneyEntry;properties:PulseProperty[];query:ReturnType<typeof useClientJourneys>;catalogError:boolean;onRetryCatalog:()=>void};
export function ClientConversation({entry,properties,query,catalogError,onRetryCatalog}:Props){
 const [params,setParams]=useSearchParams();
 const tab=['collections','showings'].includes(params.get('tab')||'')?params.get('tab')!:'chat';
 const cache=useQueryClient();const j=entry.journey;const history=useMessageHistory(j,true);
 const closed=['deal','closed','lost'].includes(entry.status);
 const [draft,setDraft]=React.useState(()=>draftFor(entry.leadId));
 const [busy,setBusy]=React.useState(false),[uploading,setUploading]=React.useState(false),[error,setError]=React.useState(''),[notice,setNotice]=React.useState('');
 const [attachmentOpen,setAttachmentOpen]=React.useState(false),[pendingFile,setPendingFile]=React.useState<File|null>(null),[previewUrl,setPreviewUrl]=React.useState('');
 const locked=React.useRef(false),messageId=React.useRef(crypto.randomUUID());
 const [replies,setReplies]=React.useState<Record<string,string>>({});
 const [propertyId,setPropertyId]=React.useState(''),[at,setAt]=React.useState(''),[note,setNote]=React.useState('');
 const [newBelow,setNewBelow]=React.useState(false);
 const root=React.useRef<HTMLDivElement>(null),log=React.useRef<HTMLDivElement>(null),nearBottom=React.useRef(true),input=React.useRef<HTMLTextAreaElement>(null),imageInput=React.useRef<HTMLInputElement>(null),fileInput=React.useRef<HTMLInputElement>(null);
 const options=properties.filter(p=>p.id===entry.propertyId||j.collections.some(c=>c.items.some(i=>i.propertyId===p.id)));
 const property=(id:string)=>properties.find(p=>p.id===id);
 const subjectProperty=entry.propertyId?property(entry.propertyId):undefined;
 const subject=entry.propertyId?subjectProperty?.name:'Помощь с покупкой';
 const firstUnreadManagerId=React.useRef((j.messages||[]).find(m=>m.author==='manager'&&!m.readAt)?.id||'');
 const scrollEnd=()=>{if(log.current)log.current.scrollTop=log.current.scrollHeight;nearBottom.current=true;setNewBelow(false)};
 React.useEffect(()=>{const resize=()=>{const viewport=window.visualViewport;root.current?.style.setProperty('--chat-height',(viewport?.height||window.innerHeight)+'px');root.current?.style.setProperty('--chat-top',(viewport?.offsetTop||0)+'px');if(nearBottom.current)requestAnimationFrame(scrollEnd)};resize();window.visualViewport?.addEventListener('resize',resize);window.visualViewport?.addEventListener('scroll',resize);window.addEventListener('resize',resize);return()=>{window.visualViewport?.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('scroll',resize);window.removeEventListener('resize',resize)}},[]);
 React.useLayoutEffect(()=>{if(tab!=='chat')return;if(nearBottom.current)scrollEnd();else setNewBelow(true)},[j.messages?.length,tab]);
 React.useLayoutEffect(()=>{if(input.current){input.current.style.height='auto';input.current.style.height=Math.min(112,input.current.scrollHeight)+'px'}},[draft,tab]);
 React.useEffect(()=>{try{if(draft)sessionStorage.setItem('pulse.chat-draft.'+entry.leadId,draft);else sessionStorage.removeItem('pulse.chat-draft.'+entry.leadId)}catch{}},[draft,entry.leadId]);
 React.useEffect(()=>{if(tab!=='chat')return;try{const previous=JSON.parse(localStorage.getItem('pulse.read-updates.v1')||'[]');const ids=(j.messages||[]).filter(m=>m.author==='manager').map(m=>'message:'+m.id);localStorage.setItem('pulse.read-updates.v1',JSON.stringify([...new Set([...ids,...(Array.isArray(previous)?previous:[])])].slice(0,500)))}catch{}},[j.messages,tab]);
 const unreadManager=(j.messages||[]).filter(m=>m.author==='manager'&&!m.readAt).map(m=>m.id).join(',');
 React.useEffect(()=>{if(tab!=='chat'||!unreadManager)return;let cancelled=false;void markJourneyRead(j,unreadManager.split(','),true).then(result=>{if(cancelled)return;cache.setQueryData(['my-journeys'],(old:{items:JourneyEntry[];limited:boolean}|undefined)=>old?{...old,items:old.items.map(e=>e.leadId===entry.leadId?{...e,journey:result.journey}:e)}:old)}).catch(()=>{});return()=>{cancelled=true}},[tab,unreadManager,entry.leadId]);
 React.useEffect(()=>()=>{if(previewUrl)URL.revokeObjectURL(previewUrl)},[previewUrl]);
 const run=async(command:JourneyCommand):Promise<boolean>=>{
  if(locked.current)return false;locked.current=true;setBusy(true);setError('');setNotice('');
  try{
   await cache.cancelQueries({queryKey:['my-journeys']});
   const result=await saveJourney(j,command,true);
   cache.setQueryData(['my-journeys'],(old:{items:JourneyEntry[];limited:boolean}|undefined)=>old?{...old,items:old.items.map(e=>e.leadId===entry.leadId?{...e,journey:result.journey}:e)}:old);
   if(command.type!=='message')setNotice(command.type==='reaction'?'Ответ сохранён':command.type==='showing'?'Запрос отправлен. Дождитесь подтверждения.':'Изменения сохранены');
   return true;
  }catch(e){
   const refreshed=await query.refetch();
   if(command.type==='message'&&refreshed.data?.items.find(e=>e.leadId===entry.leadId)?.journey.messages?.some(m=>m.id===command.id))return true;
   setError(e instanceof Error?e.message:'Не удалось сохранить. Попробуйте ещё раз.');return false;
  }finally{locked.current=false;setBusy(false)}
 };
 const clearAttachment=()=>{if(previewUrl)URL.revokeObjectURL(previewUrl);setPreviewUrl('');setPendingFile(null);setAttachmentOpen(false)};
 const chooseFile=(file:File|undefined)=>{if(!file)return;const type=file.type.toLowerCase();if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(type)){setError('Можно отправить JPG, PNG, WebP или PDF');return}clearAttachment();setPendingFile(file);if(type.startsWith('image/'))setPreviewUrl(URL.createObjectURL(file));setError('');messageId.current=crypto.randomUUID()};
 const send=async(e:React.FormEvent)=>{e.preventDefault();if((!draft.trim()&&!pendingFile)||closed||uploading)return;const text=draft.trim();let attachment:JourneyAttachment|undefined;
  if(pendingFile){setUploading(true);setError('');try{attachment=await uploadJourneyAttachment(entry.leadId,pendingFile,true)}catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить вложение');setUploading(false);return}setUploading(false)}
  if(await run({type:'message',id:messageId.current,text,attachment})){setDraft('');clearAttachment();messageId.current=crypto.randomUUID();nearBottom.current=true;requestAnimationFrame(scrollEnd);input.current?.focus()}};
 const setTab=(value:string)=>{setParams({lead:entry.leadId,...(value==='chat'?{}:{tab:value})},{replace:true});setError('');setNotice('');requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'auto'}))};
 const requestShowing=async(e:React.FormEvent)=>{e.preventDefault();const date=Date.parse(at+'+10:00');if(!Number.isFinite(date)||date<=Date.now()){setError('Выберите дату и время в будущем');return}if(await run({type:'showing',id:crypto.randomUUID(),propertyId,at:new Date(date).toISOString(),note})){setAt('');setPropertyId('');setNote('')}};
 const minDateTime=vladivostokInputNow();
 const invalidShowingTime=!!at&&!isFutureVladivostokInput(at);
 const limitReached=false;
 return <div className={`${styles.conversation} ${tab==='chat'?'':styles.detailsMode}`} ref={root}>
  <header className={styles.chatHeader}><Link className={styles.iconButton} to="/journey" aria-label="Все мои обращения"><ArrowLeft size={21}/></Link><span className={styles.avatar}>{entry.managerName?entry.managerName.trim().split(/\s+/).map(n=>n[0]).slice(0,2).join(''):<MessageCircle size={21}/>}</span><div><h1>{entry.managerName||'Команда PULSE.DV'}</h1><small>{entry.managerName?'Ваш менеджер по недвижимости':'Менеджер пока не назначен'}</small></div><button className={styles.iconButton} aria-label="Обновить переписку" disabled={query.isFetching||busy} onClick={()=>void query.refetch()}><RefreshCw size={17}/></button></header>
  <div className={styles.subject}><span>{subject||'Обсуждение квартиры'}</span><small>{journeyStatus(entry.status)}</small></div>
  <div className={styles.tabs} role="tablist" aria-label="Разделы обращения">{[{id:'chat',label:'Переписка',Icon:MessageCircle,count:0},{id:'collections',label:'Подборки',Icon:Sparkles,count:j.collections.length},{id:'showings',label:'Показы',Icon:CalendarDays,count:j.showings.filter(s=>['requested','confirmed'].includes(s.status)).length}].map(({id,label,Icon,count})=><button key={id} id={'tab-'+id} type="button" role="tab" aria-selected={tab===id} aria-controls={'panel-'+id} tabIndex={tab===id?0:-1} onClick={()=>setTab(id)} onKeyDown={e=>{const ids=['chat','collections','showings'];const step=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(step){e.preventDefault();const next=ids[(ids.indexOf(id)+step+3)%3];setTab(next);requestAnimationFrame(()=>document.getElementById('tab-'+next)?.focus())}}}><Icon size={16}/>{label}{count>0&&<span>{count}</span>}</button>)}</div>
  {!runtime.enabled&&<p className={styles.demo}>Демонстрация · сообщения сохраняются в этом браузере</p>}
  {(error||query.error)&&<div className={styles.error} role="alert">{error||'Не удалось обновить переписку. Проверьте подключение.'}<button onClick={()=>void query.refetch()}>Обновить</button></div>}
  {notice&&<div className={styles.notice} role="status"><Check size={15}/>{notice}</div>}
  {catalogError&&tab!=='chat'&&<div className={styles.error} role="alert">Не удалось загрузить сведения о ЖК.<button onClick={onRetryCatalog}>Повторить</button></div>}
  {tab==='chat'?<section id="panel-chat" role="tabpanel" aria-labelledby="tab-chat" className={styles.chatPanel}>
   <div className={styles.messages} ref={log} role="log" aria-label="Переписка по обращению" aria-live="polite" onScroll={()=>{const node=log.current;if(node){nearBottom.current=node.scrollHeight-node.scrollTop-node.clientHeight<72;if(nearBottom.current)setNewBelow(false)}}}>
    <div className={styles.systemMessage}>Обращение от {journeyDate(entry.createdAt)}<br/>Время обращения — Владивосток</div>
    {subjectProperty&&<Link className={styles.chatPropertyContext} to={'/property/'+encodeURIComponent(subjectProperty.id)} state={{returnTo:'/journey?lead='+entry.leadId}}>
      {subjectProperty.coverImageUrl?<img src={subjectProperty.coverImageUrl} alt=""/>:<span><Building2 size={23}/></span>}
      <div><small>ОБСУЖДАЕМ ЖК</small><strong>{subjectProperty.name}</strong><p>{subjectProperty.city} · {subjectProperty.district} · от {subjectProperty.priceFrom.toLocaleString('ru-RU',{minimumFractionDigits:subjectProperty.priceFrom%1?1:0,maximumFractionDigits:1})} млн ₽</p></div>
      <ChevronRight size={17}/>
    </Link>}
    {!j.messages?.length&&<div className={styles.chatWelcome}><span className={styles.emptyIcon}><MessageCircle size={27}/></span><h2>Начнём с ваших пожеланий</h2><p>Напишите, какую квартиру ищете, или задайте вопрос о проекте.</p>{!closed&&<div className={styles.prompts}>{['Хочу обсудить бюджет','Помогите сравнить ЖК','Как записаться на показ?'].map(text=><button key={text} disabled={busy} onClick={()=>{setDraft(text);input.current?.focus()}}>{text}<ChevronRight size={14}/></button>)}</div>}</div>}
    {history.hasMore&&<button type="button" disabled={history.loading} onClick={()=>void history.load()}>{history.loading?'Загружаем…':'Предыдущие сообщения'}</button>}{history.error&&<p role="alert">{history.error}</p>}{history.messages.map((m,index,all)=>{
     const day=new Date(m.at).toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
     const previous=index?new Date(all[index-1].at).toLocaleDateString('ru-RU',{day:'numeric',month:'long'}):'';
     return <React.Fragment key={m.id}>{day!==previous&&<div className={styles.dateDivider}>{day}</div>}{m.id===firstUnreadManagerId.current&&<div className={styles.unreadDivider}><span>Новые сообщения</span></div>}<article className={m.author==='client'?styles.outgoing:styles.incoming} aria-label={m.author==='client'?'Ваше сообщение':'Сообщение менеджера'}>{m.author==='manager'&&<strong>{entry.managerName||'Команда PULSE.DV'}</strong>}{m.attachment&&(m.attachment.kind==='image'?<a className={styles.messageImage} href={m.attachment.url.replace(/^\/media\/chat\//,'/api/v1/legacy-journey-media/')} target="_blank" rel="noreferrer"><img src={m.attachment.url.replace(/^\/media\/chat\//,'/api/v1/legacy-journey-media/')} alt={m.attachment.name}/></a>:<a className={styles.fileAttachment} href={m.attachment.url.replace(/^\/media\/chat\//,'/api/v1/legacy-journey-media/')} target="_blank" rel="noreferrer"><FileText size={20}/><span><b>{m.attachment.name}</b><small>{Math.max(1,Math.round(m.attachment.size/1024))} КБ</small></span></a>)}{m.text&&<p>{m.text}</p>}<footer><time dateTime={m.at}>{clock(m.at)}</time>{m.author==='client'&&(m.readAt?<CheckCheck className={styles.readReceipt} size={15} aria-label="Прочитано"/>:<Check size={13} aria-label={runtime.enabled?'Отправлено':'Сохранено в демонстрации'}/>)}</footer></article></React.Fragment>;
    })}
   </div>
   {newBelow&&<button className={styles.newMessages} onClick={scrollEnd}><ArrowDown size={16}/>К последним сообщениям</button>}
   {closed||limitReached?<div className={styles.closed}>{closed?'Обращение завершено. Переписка сохранена.':'Достигнут лимит сообщений в этом обращении.'}<Link to="/journey">К моим обращениям<ChevronRight size={14}/></Link></div>:<form className={styles.composer} onSubmit={send}>
    <input ref={imageInput} className={styles.srOnly} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Выбрать фото" onChange={e=>{chooseFile(e.target.files?.[0]);e.currentTarget.value=''}}/>
    <input ref={fileInput} className={styles.srOnly} type="file" accept="application/pdf" aria-label="Выбрать файл" onChange={e=>{chooseFile(e.target.files?.[0]);e.currentTarget.value=''}}/>
    {attachmentOpen&&<div className={styles.attachmentMenu} role="menu"><button type="button" role="menuitem" onClick={()=>imageInput.current?.click()}><ImageIcon size={18}/>Фото</button><button type="button" role="menuitem" onClick={()=>fileInput.current?.click()}><FileText size={18}/>Файл PDF</button></div>}
    {pendingFile&&<div className={styles.pendingAttachment}>{previewUrl?<img src={previewUrl} alt="Предпросмотр вложения"/>:<FileText size={21}/>}<span><b>{pendingFile.name}</b><small>{Math.max(1,Math.round(pendingFile.size/1024))} КБ</small></span><button type="button" aria-label="Убрать вложение" onClick={clearAttachment}><X size={16}/></button></div>}
    <button className={styles.attachButton} aria-label="Добавить вложение" type="button" aria-expanded={attachmentOpen} onClick={()=>setAttachmentOpen(v=>!v)}><Paperclip size={20}/></button>
    <label className={styles.srOnly} htmlFor="client-message">Сообщение</label><textarea ref={input} id="client-message" rows={1} placeholder="Написать сообщение…" maxLength={2000} value={draft} readOnly={busy||uploading} onChange={e=>{setDraft(e.target.value);messageId.current=crypto.randomUUID()}} onKeyDown={e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form?.requestSubmit()}}}/>
    <button className={styles.sendButton} aria-label="Отправить сообщение" type="submit" disabled={busy||uploading||(!draft.trim()&&!pendingFile)}><ArrowUp size={21}/></button>{(busy||uploading||draft.length>1800)&&<small role="status">{uploading?'Загружаем вложение…':busy?'Отправляем…':draft.length+' / 2000'}</small>}
   </form>}
  </section>:<section id={'panel-'+tab} role="tabpanel" aria-labelledby={'tab-'+tab} className={styles.detailsPanel}>
   {tab==='collections'?<>{!j.collections.length&&<div className={styles.sectionEmpty}><Sparkles size={30}/><h2>Здесь будет ваша подборка</h2><p>Расскажите менеджеру о бюджете и пожеланиях в переписке.</p><button className={styles.secondary} onClick={()=>setTab('chat')}>Написать менеджеру</button></div>}{j.collections.map(c=><section key={c.id} className={styles.collection}><header><span><Sparkles size={17}/>{c.items.length} вариантов</span><h2>{c.title}</h2></header>{c.items.map(i=>{const p=property(i.propertyId),key=c.id+':'+i.propertyId;return <article className={styles.propertyCard} key={i.propertyId}><Link className={styles.propertyLink} to={'/property/'+encodeURIComponent(i.propertyId)} state={{returnTo:'/journey?lead='+entry.leadId+'&tab=collections'}}>{p?.coverImageUrl?<img src={p.coverImageUrl} alt="" onError={e=>{e.currentTarget.style.display='none'}}/>:<span><Building2 size={27}/></span>}<div><h3>{p?.name||'Сведения о ЖК уточняются'}</h3>{p&&<><small>{p.city} · {p.district}</small><b>от {p.priceFrom.toLocaleString('ru-RU',{minimumFractionDigits:p.priceFrom%1?1:0,maximumFractionDigits:1})} млн ₽</b><small>{p.delivery}</small></>}</div><ChevronRight size={17}/></Link>{i.note&&<p className={styles.propertyNote}>{i.note}</p>}<label>Ваше мнение<select disabled={busy||closed} value={i.reaction} onChange={e=>void run({type:'reaction',collectionId:c.id,propertyId:i.propertyId,reaction:e.target.value as Reaction,reply:i.reply})}>{Object.entries(reactionLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><details><summary>Комментарий к варианту{i.reply?' · сохранён':''}</summary><label><span className={styles.srOnly}>Комментарий к варианту</span><textarea maxLength={2000} disabled={closed||busy} value={replies[key]??i.reply} placeholder="Что нравится или смущает?" onChange={e=>setReplies({...replies,[key]:e.target.value})}/></label><button className={styles.secondary} disabled={busy||closed} onClick={()=>void run({type:'reaction',collectionId:c.id,propertyId:i.propertyId,reaction:i.reaction,reply:replies[key]??i.reply})}>Сохранить ответ</button></details></article>})}</section>)}</>:<>
    <div className={styles.sectionHeading}><CalendarDays size={21}/><div><h2>Ваши показы</h2><small>Дата и время — по Владивостоку</small></div></div>
    {!j.showings.length&&<div className={styles.sectionEmpty}><p>Пока нет запланированных показов. Выберите удобное время — менеджер подтвердит встречу.</p></div>}
    {j.showings.map(s=><article className={styles.showing} key={s.id}><span className={styles.status}>{showingLabels[s.status]}</span><h3>{property(s.propertyId)?.name||'Сведения о ЖК уточняются'}</h3><p className={styles.showingTime}><CalendarDays size={17}/>{journeyDate(s.at)}</p>{s.note&&<p>{s.note}</p>}<ShowingChange showing={s} client closed={closed} busy={busy} onCommand={async c=>{await run(c)}}/></article>)}
    {!closed&&(options.length?<details className={styles.showingForm}><summary>Запросить время показа</summary><form onSubmit={requestShowing}><label>ЖК<select aria-label="ЖК" required value={propertyId} disabled={busy} onChange={e=>setPropertyId(e.target.value)}><option value="">Выберите объект</option>{options.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Дата и время (Владивосток)<input type="datetime-local" aria-label="Дата и время (Владивосток)" min={minDateTime} required disabled={busy} value={at} onChange={e=>setAt(e.target.value)}/>{invalidShowingTime&&<small className={styles.fieldError}>Выберите будущее время по Владивостоку.</small>}</label><label>Пожелания<input value={note} maxLength={2000} disabled={busy} placeholder="Например, после работы" onChange={e=>setNote(e.target.value)}/></label><button className={styles.primary} disabled={busy||!at||!propertyId||invalidShowingTime}>Запросить показ<ArrowRightIcon/></button><small>Встреча состоится после подтверждения менеджером.</small></form></details>:<div className={styles.sectionEmpty}><p>Сначала выберите ЖК вместе с менеджером.</p><button className={styles.secondary} onClick={()=>setTab('chat')}>Обсудить варианты</button></div>)}
   </>}
  </section>}
 </div>;
}
function ArrowRightIcon(){return <ChevronRight size={17}/>}
