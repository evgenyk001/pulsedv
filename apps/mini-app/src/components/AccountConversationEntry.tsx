import React from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {useQueryClient} from '@tanstack/react-query';
import {ArrowUp,MessageCircle,ShieldCheck} from 'lucide-react';
import {visitorApi,runtime} from '../../../../packages/pulse-data/runtime';
import {loadJourneys} from '../../../../packages/journey/client';
import {rememberedPartnerInvite,clearPartnerInvite} from '../../../../packages/partners/client';
import type {LeadSheetProps} from './LeadSheet';
import {BackLink} from './BackLink';
import styles from '../pages/journey.module.css';
export type ConversationDraft={source:string;propertyId?:string;project?:string;context?:Record<string,unknown>;newPurchase?:boolean;referralCode?:string;referralName?:string};
export function AccountConversationEntry(props:LeadSheetProps){
 const navigate=useNavigate();const [busy,setBusy]=React.useState(false),[error,setError]=React.useState(false);
 const open=async()=>{
  if(busy)return;setBusy(true);setError(false);
  try{
   const invitation=rememberedPartnerInvite(),direct=['profile-manager','profile-contact'].includes(props.source??'');
   const referralCode=direct?undefined:props.referralCode??invitation?.code;
   const entries=(await loadJourneys(true)).items;
   const newPurchase=props.source==='journey'&&entries.length>0;
   const active=!newPurchase&&!referralCode?entries.filter(e=>!['deal','lost','closed'].includes(e.status)&&(!props.propertyId||e.propertyId===props.propertyId||!e.propertyId)).sort((a,b)=>Number(b.propertyId===props.propertyId)-Number(a.propertyId===props.propertyId)||Date.parse(b.createdAt)-Date.parse(a.createdAt))[0]:null;
   const details:ConversationDraft={source:props.source??'app',propertyId:props.propertyId,project:props.project,context:props.context,newPurchase,referralCode,referralName:props.referralName??invitation?.partnerName};
   if(active){
    if(props.context||props.propertyId){try{sessionStorage.setItem('pulse.chat-context.'+active.leadId,JSON.stringify({...props.context,source:details.source,...(props.project?{propertyName:props.project}:{})}))}catch{}}
    navigate('/journey?lead='+active.leadId);
   }else navigate('/journey?compose=1',{state:{conversationDraft:details}});
  }catch{setError(true)}finally{setBusy(false)}
 };
 return <>{React.cloneElement(props.children as React.ReactElement<any>,{type:'button',disabled:busy,onClick:()=>void open()})}{error&&<p className={styles.entryError} role="alert">Не удалось открыть переписку. Нажмите ещё раз.</p>}</>;
}
export function AccountConversationDraft({details}:{details:ConversationDraft}){
 const navigate=useNavigate(),cache=useQueryClient();
 const root=React.useRef<HTMLDivElement>(null);
 React.useEffect(()=>{const resize=()=>{root.current?.style.setProperty('--chat-height',(window.visualViewport?.height??innerHeight)+'px');root.current?.style.setProperty('--chat-top',(window.visualViewport?.offsetTop??0)+'px')};resize();window.visualViewport?.addEventListener('resize',resize);window.visualViewport?.addEventListener('scroll',resize);return()=>{window.visualViewport?.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('scroll',resize)}},[]);
 const storageKey='pulse.new-conversation.'+details.source+'.'+(details.propertyId??'general')+'.'+!!details.newPurchase;
 const restored=React.useMemo(()=>{try{return JSON.parse(sessionStorage.getItem(storageKey)??'{}')}catch{return {}}},[storageKey]);
 const [text,setText]=React.useState<string>(typeof restored.text==='string'?restored.text:'');
 const id=React.useRef(typeof restored.id==='string'?restored.id:crypto.randomUUID());
 const [consent,setConsent]=React.useState(false),[referralConsent,setReferralConsent]=React.useState(false),[referralCode,setReferralCode]=React.useState(details.referralCode);
 const [busy,setBusy]=React.useState(false),[error,setError]=React.useState('');const locked=React.useRef(false);
 React.useEffect(()=>{try{sessionStorage.setItem(storageKey,JSON.stringify({id:id.current,text}))}catch{}},[storageKey,text]);
 const send=async(e:React.FormEvent)=>{
  e.preventDefault();if(locked.current||!text.trim()||!consent)return;locked.current=true;setBusy(true);setError('');
  try{
   const result=await visitorApi<{id:string}>('/me/conversations/start',{method:'POST',body:JSON.stringify({idempotencyKey:id.current,source:details.source,propertyId:details.propertyId??null,context:{...details.context,...(details.project?{propertyName:details.project}:{})},text:text.trim(),newPurchase:!!details.newPurchase,consent:true,consentVersion:runtime.consentVersion,...(referralCode&&referralConsent?{referralCode,referralConsent:true}:{})})});
   try{sessionStorage.removeItem(storageKey)}catch{}clearPartnerInvite();
   await cache.invalidateQueries({queryKey:['my-journeys']});navigate('/journey?lead='+result.id,{replace:true});
  }catch{setError('Не удалось отправить сообщение. Текст сохранён — попробуйте ещё раз.')}finally{locked.current=false;setBusy(false)}
 };
 return <div className={styles.conversation} ref={root}>
  <header className={styles.chatHeader}><BackLink compact to="/journey" aria-label="Все мои обращения"/><span className={styles.avatar}><MessageCircle size={21}/></span><div><h1>Команда PULSEDV.RU</h1><small>Поможем с выбором недвижимости</small></div></header>
  <section className={styles.newChatBody}>
   <div className={styles.newChatMark}><MessageCircle size={30}/></div><h2>С чего начнём?</h2><p>Расскажите, какую квартиру ищете, или просто задайте вопрос.</p>
   {details.project&&<div className={styles.chatContextNote}><small>Обсуждаем</small><strong>{details.project}</strong></div>}
  </section>
  <form className={`${styles.composer} ${styles.firstComposer}`} onSubmit={send}>
   <label className={styles.firstConsent}><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>Согласен на обработку обращения и подбор недвижимости. <Link to="/personal-data-consent">Согласие</Link></span></label>
   {referralCode&&<><label className={styles.firstConsent}><input type="checkbox" checked={referralConsent} onChange={e=>setReferralConsent(e.target.checked)}/><span>Меня пригласил(а) {details.referralName||'партнёр PULSE'}. Разрешаю передавать партнёру имя и статусы рекомендации, включая начисление и выплату вознаграждения. Телефон и переписка ему не передаются.</span></label><button type="button" className={styles.linkAction} onClick={()=>{setReferralCode(undefined);setReferralConsent(false);clearPartnerInvite()}}>Я обратился самостоятельно</button></>}
   {error&&<p className={styles.entryError} role="alert">{error}</p>}
   <label className={styles.srOnly} htmlFor="first-message">Сообщение</label><textarea id="first-message" placeholder="Написать сообщение…" maxLength={2000} rows={2} value={text} readOnly={busy} onChange={e=>setText(e.target.value)}/>
   <button className={styles.sendButton} type="submit" aria-label="Отправить сообщение" disabled={busy||!text.trim()||!consent||!!referralCode&&!referralConsent}><ArrowUp size={21}/></button>
   <small className={styles.firstHint}><ShieldCheck size={12}/>Ваши контакты уже сохранены в аккаунте</small>
  </form>
 </div>;
}
