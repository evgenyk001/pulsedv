import React from 'react';
import {CalendarDays,Check,CheckCheck,ChevronRight,FileText,Image as ImageIcon,MessageCircle,Paperclip,RefreshCw,Send,Sparkles,X} from 'lucide-react';
import {ShowingChange} from './ShowingChange';
import {loadJourneys,markJourneyRead,saveJourney,uploadJourneyAttachment,type JourneyEntry} from './client';
import {reactionLabels,showingLabels,type Journey,type JourneyAttachment,type JourneyCommand} from './model';
import type {PulseProperty} from '../pulse-data/model';
import './controlJourney.css';

const when=(value:string)=>new Date(value).toLocaleString('ru-RU',{timeZone:'Asia/Vladivostok',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const clock=(value:string)=>new Date(value).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Vladivostok'});
const iso=(value:string)=>new Date(value+'+10:00').toISOString();

export function ControlJourneyPanel({leadId,properties}:{leadId:string;properties:PulseProperty[]}){
 const [entry,setEntry]=React.useState<JourneyEntry|null>(null),[loading,setLoading]=React.useState(true),[busy,setBusy]=React.useState(false),[uploading,setUploading]=React.useState(false),[error,setError]=React.useState('');
 const [tab,setTab]=React.useState<'chat'|'collections'|'showings'>('chat');
 const [message,setMessage]=React.useState(''),[picked,setPicked]=React.useState<string[]>([]),[title,setTitle]=React.useState('Варианты для вас'),[notes,setNotes]=React.useState<Record<string,string>>({});
 const [results,setResults]=React.useState<Record<string,string>>({}),[time,setTime]=React.useState(''),[propertyId,setPropertyId]=React.useState(''),[note,setNote]=React.useState('');
 const [step,setStep]=React.useState(''),[due,setDue]=React.useState('');
 const [attachmentOpen,setAttachmentOpen]=React.useState(false),[pendingFile,setPendingFile]=React.useState<File|null>(null),[previewUrl,setPreviewUrl]=React.useState('');
 const imageInput=React.useRef<HTMLInputElement>(null),fileInput=React.useRef<HTMLInputElement>(null),log=React.useRef<HTMLDivElement>(null);
 const reload=React.useCallback(async(silent=false)=>{if(!silent)setLoading(true);try{const data=await loadJourneys(false);setEntry(data.items.find(item=>item.leadId===leadId)||null);setError('')}catch(e){setError(e instanceof Error?e.message:'Не удалось обновить обращение')}finally{if(!silent)setLoading(false)}},[leadId]);
 React.useEffect(()=>{void reload();const timer=setInterval(()=>{if(!document.hidden)void reload(true)},10000);return()=>clearInterval(timer)},[reload]);
 React.useEffect(()=>()=>{if(previewUrl)URL.revokeObjectURL(previewUrl)},[previewUrl]);
 const j=entry?.journey;
 const unreadClient=(j?.messages||[]).filter(m=>m.author==='client'&&!m.readAt).map(m=>m.id).join(',');
 React.useEffect(()=>{if(tab!=='chat'||!j||!unreadClient)return;let cancelled=false;void markJourneyRead(j,unreadClient.split(','),false).then(result=>{if(!cancelled)setEntry(current=>current?{...current,journey:result.journey}:current)}).catch(()=>{});return()=>{cancelled=true}},[tab,unreadClient,leadId]);
 React.useLayoutEffect(()=>{if(tab==='chat'&&log.current)log.current.scrollTop=log.current.scrollHeight},[tab,j?.messages?.length]);
 const run=async(command:JourneyCommand)=>{if(!j||busy)return false;setBusy(true);setError('');try{const result=await saveJourney(j,command,false);setEntry(current=>current?{...current,journey:result.journey}:current);if(command.type==='collection'){setPicked([]);setNotes({})}return true}catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить');await reload(true);return false}finally{setBusy(false)}};
 const clearAttachment=()=>{if(previewUrl)URL.revokeObjectURL(previewUrl);setPreviewUrl('');setPendingFile(null);setAttachmentOpen(false)};
 const chooseFile=(file:File|undefined)=>{if(!file)return;const type=file.type.toLowerCase();if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(type)){setError('Можно отправить JPG, PNG, WebP или PDF');return}clearAttachment();setPendingFile(file);if(type.startsWith('image/'))setPreviewUrl(URL.createObjectURL(file));setError('')};
 const sendMessage=async()=>{if(!j||(!message.trim()&&!pendingFile)||busy||uploading)return;let attachment:JourneyAttachment|undefined;if(pendingFile){setUploading(true);try{attachment=await uploadJourneyAttachment(leadId,pendingFile,false)}catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить вложение');setUploading(false);return}setUploading(false)}if(await run({type:'message',id:crypto.randomUUID(),text:message.trim(),attachment})){setMessage('');clearAttachment()}};
 if(loading)return <section className="controlJourney" aria-label="Подборки и показы"><div className="controlJourneyLoading">Загружаем переписку…</div></section>;
 if(!entry||!j)return <section className="controlJourney" aria-label="Подборки и показы"><div className="controlJourneyEmpty">Обращение пока не создано.</div></section>;
 const closed=['deal','closed','lost'].includes(entry.status);
 const property=(id:string)=>properties.find(p=>p.id===id);
 const options=properties.filter(p=>p.status==='published');
 const subject=entry.propertyId?property(entry.propertyId)?.name:'Помощь с покупкой';
 return <section className="controlJourney" aria-label="Подборки и показы">
  <header className="controlJourneyHeader"><div><span>КЛИЕНТСКОЕ ОБРАЩЕНИЕ</span><h2>{subject||'Помощь с покупкой'}</h2><small>{entry.managerName?'Ответственный: '+entry.managerName:'Менеджер не назначен'}</small></div><button className="controlJourneyIcon" aria-label="Обновить обращение" disabled={busy||loading} onClick={()=>void reload()}><RefreshCw size={18}/></button></header>
  <nav className="controlJourneyTabs" role="tablist" aria-label="Работа с обращением">{[
   {id:'chat' as const,label:'Переписка',Icon:MessageCircle,count:0},
   {id:'collections' as const,label:'Подборки',Icon:Sparkles,count:j.collections.length},
   {id:'showings' as const,label:'Показы',Icon:CalendarDays,count:j.showings.filter(s=>['requested','confirmed'].includes(s.status)).length}
  ].map(({id,label,Icon,count})=><button key={id} role="tab" aria-selected={tab===id} onClick={()=>setTab(id)}><Icon size={17}/>{label}{count>0&&<span>{count}</span>}</button>)}</nav>
  {error&&<div className="controlJourneyError" role="alert">{error}</div>}
  {tab==='chat'&&<div className="controlJourneyChat" role="tabpanel">
   <div className="controlJourneyLog" ref={log} role="log" aria-label="Переписка по обращению">
    {!j.messages?.length&&<div className="controlJourneyEmpty"><MessageCircle size={28}/><b>Диалог пока пуст</b><span>Напишите клиенту — сообщение сразу появится в его обращении.</span></div>}
    {(j.messages||[]).map(m=><article key={m.id} className={m.author==='manager'?'controlMessage controlMessageOutgoing':'controlMessage controlMessageIncoming'} aria-label={m.author==='manager'?'Сообщение менеджера':'Сообщение клиента'}>{m.author==='client'&&<strong>Клиент</strong>}{m.attachment&&(m.attachment.kind==='image'?<a className="controlMessageImage" href={m.attachment.url} target="_blank" rel="noreferrer"><img src={m.attachment.url} alt={m.attachment.name}/></a>:<a className="controlFile" href={m.attachment.url} target="_blank" rel="noreferrer"><FileText size={19}/><span><b>{m.attachment.name}</b><small>{Math.max(1,Math.round(m.attachment.size/1024))} КБ</small></span></a>)}{m.text&&<p>{m.text}</p>}<footer><time>{clock(m.at)}</time>{m.author==='manager'&&(m.readAt?<CheckCheck size={15} aria-label="Прочитано" className="controlRead"/>:<Check size={13} aria-label="Отправлено"/>)}</footer></article>)}
   </div>
   {!closed&&<div className="controlComposer">
    <input ref={imageInput} className="controlSrOnly" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Выбрать фото" onChange={e=>{chooseFile(e.target.files?.[0]);e.currentTarget.value=''}}/>
    <input ref={fileInput} className="controlSrOnly" type="file" accept="application/pdf" aria-label="Выбрать файл" onChange={e=>{chooseFile(e.target.files?.[0]);e.currentTarget.value=''}}/>
    {attachmentOpen&&<div className="controlAttachMenu"><button type="button" onClick={()=>imageInput.current?.click()}><ImageIcon size={18}/>Фото</button><button type="button" onClick={()=>fileInput.current?.click()}><FileText size={18}/>Файл PDF</button></div>}
    {pendingFile&&<div className="controlPending">{previewUrl?<img src={previewUrl} alt="Предпросмотр вложения"/>:<FileText size={20}/>}<span><b>{pendingFile.name}</b><small>{Math.max(1,Math.round(pendingFile.size/1024))} КБ</small></span><button aria-label="Убрать вложение" onClick={clearAttachment}><X size={15}/></button></div>}
    <button className="controlAttachButton" aria-label="Добавить вложение" aria-expanded={attachmentOpen} onClick={()=>setAttachmentOpen(v=>!v)}><Paperclip size={19}/></button>
    <label className="controlSrOnly" htmlFor={'manager-message-'+leadId}>Сообщение</label><textarea id={'manager-message-'+leadId} aria-label="Сообщение" rows={1} maxLength={2000} value={message} placeholder="Написать клиенту…" onChange={e=>setMessage(e.target.value)}/>
    <button className="controlSendButton" aria-label="Отправить сообщение" disabled={busy||uploading||(!message.trim()&&!pendingFile)} onClick={()=>void sendMessage()}><Send size={18}/></button>
   </div>}
  </div>}
  {tab==='collections'&&<div className="controlJourneyPane" role="tabpanel">
   {!j.collections.length&&<div className="controlJourneyEmpty"><Sparkles size={28}/><b>Подборок пока нет</b><span>Создайте первую подборку и опубликуйте её клиенту.</span></div>}
   {j.collections.map(c=><section className="controlCollection" key={c.id}><header><div><span>{c.published?'КЛИЕНТУ ОТПРАВЛЕНО':'ЧЕРНОВИК'}</span><h3>{c.title}</h3></div>{!c.published&&<small>Черновик</small>}</header>{c.items.map(i=><div className="controlPropertyRow" key={i.propertyId}><a href={'../mini-app/#/property/'+encodeURIComponent(i.propertyId)}><b>{property(i.propertyId)?.name||'Объект недоступен'}</b><ChevronRight size={15}/></a>{i.note&&<p>{i.note}</p>}<small><b>{reactionLabels[i.reaction]}</b>{i.reply?' · '+i.reply:''}</small></div>)}{!closed&&<button className="controlSecondary" disabled={busy} onClick={()=>void run({type:'collection',id:c.id,title:c.title,items:c.items,published:!c.published})}>{c.published?'Снять с публикации':'Опубликовать клиенту'}</button>}</section>)}
   {!closed&&<details className="controlCreate"><summary>Создать подборку</summary><div className="controlForm"><label>Название<input value={title} maxLength={200} onChange={e=>setTitle(e.target.value)}/></label><div className="controlPicker">{options.map(p=><div key={p.id}><label><input type="checkbox" checked={picked.includes(p.id)} disabled={!picked.includes(p.id)&&picked.length>=10} onChange={e=>setPicked(e.target.checked?[...picked,p.id]:picked.filter(id=>id!==p.id))}/>{p.name}</label>{picked.includes(p.id)&&<input aria-label={'Почему подходит '+p.name} placeholder="Почему этот вариант подходит" maxLength={2000} value={notes[p.id]||''} onChange={e=>setNotes({...notes,[p.id]:e.target.value})}/>}</div>)}</div><button className="controlPrimary" disabled={busy||!picked.length||!title.trim()} onClick={()=>void run({type:'collection',id:crypto.randomUUID(),title,items:picked.map(propertyId=>({propertyId,note:notes[propertyId]||''})),published:false})}>Сохранить черновик</button></div></details>}
  </div>}
  {tab==='showings'&&<div className="controlJourneyPane" role="tabpanel">
   <div className="controlPaneTitle"><CalendarDays size={20}/><div><h3>Показы</h3><small>Время — Владивосток</small></div></div>
   {!j.showings.length&&<div className="controlJourneyEmpty"><CalendarDays size={28}/><b>Показов пока нет</b><span>Запрос клиента или новый показ появится здесь.</span></div>}
   {j.showings.map(s=><article className="controlShowing" key={s.id}><span className="controlStatus">{showingLabels[s.status]}</span><h3>{property(s.propertyId)?.name||'Объект недоступен'}</h3><b>{when(s.at)}</b>{s.note&&<p>{s.note}</p>}<ShowingChange showing={s} client={false} closed={closed} busy={busy} onCommand={async c=>{await run(c)}}/>{s.result&&<p>{s.result}</p>}{!closed&&['requested','confirmed'].includes(s.status)&&<><label>Результат / причина<textarea maxLength={2000} value={results[s.id]||''} onChange={e=>setResults({...results,[s.id]:e.target.value})}/></label><div className="journeyActions">{(s.status==='requested'?['confirmed','cancelled']:['completed','cancelled']).map(status=><button disabled={busy} key={status} onClick={()=>void run({type:'showing_status',id:s.id,status:status as any,result:results[s.id]||''})}>{showingLabels[status as keyof typeof showingLabels]}</button>)}</div></>}</article>)}
   {!closed&&<details className="controlCreate"><summary>Запросить время показа</summary><div className="controlForm"><label>ЖК<select aria-label="ЖК" value={propertyId} onChange={e=>setPropertyId(e.target.value)}><option value="">Выберите объект</option>{options.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Дата и время (Владивосток)<input type="datetime-local" value={time} onChange={e=>setTime(e.target.value)}/></label><label>Пожелания<input maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></label><button className="controlPrimary" disabled={busy||!time||!propertyId} onClick={()=>void run({type:'showing',id:crypto.randomUUID(),propertyId,at:iso(time),note})}>Запросить показ</button></div></details>}
   <section className="controlNext"><div className="controlPaneTitle"><div><h3>Следующий шаг</h3>{j.nextStep&&<small>{j.nextStep.done?'Выполнен':Date.parse(j.nextStep.dueAt)<Date.now()?'Просрочен':'Запланирован'} · {when(j.nextStep.dueAt)}</small>}</div></div>{j.nextStep&&<p><b>{j.nextStep.title}</b>{!j.nextStep.done&&!closed&&<button className="controlSecondary" disabled={busy} onClick={()=>void run({type:'next_step',...j.nextStep!,done:true})}>Завершить</button>}</p>}{!closed&&<details className="controlCreate"><summary>Запланировать действие</summary><div className="controlForm"><label>Что сделать<input value={step} maxLength={200} onChange={e=>setStep(e.target.value)}/></label><label>Срок (Владивосток)<input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/></label><button className="controlPrimary" disabled={busy||!step.trim()||!due} onClick={()=>void run({type:'next_step',title:step,dueAt:iso(due),done:false})}>Сохранить следующий шаг</button></div></details>}</section>
  </div>}
 </section>;
}
