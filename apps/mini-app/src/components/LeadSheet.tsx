import {Link} from "react-router-dom";
import {useQueryClient} from "@tanstack/react-query";
import { runtime } from "../../../../packages/pulse-data/runtime";
import React from "react";
import { CheckCircle2, Send, ChevronRight, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "./Sheet";
import { Input } from "./Input";
import { postLead } from "../endpoints/leads_POST.schema";
import { recordPulseEvent } from "../../../../packages/pulse-data";
import styles from "./LeadSheet.module.css";

type LeadSheetProps={children:React.ReactNode;title?:string;project?:string;propertyId?:string;source?:string;context?:Record<string,unknown>};

export function LeadSheet({children,title="Получить консультацию",project,propertyId,source="app",context}:LeadSheetProps){
  const cache=useQueryClient();
  const [leadId,setLeadId]=React.useState<string>();
  const key=React.useRef(crypto.randomUUID());
  const locked=React.useRef(false);
  const [sent,setSent]=React.useState(false);
  const [name,setName]=React.useState("");
  const [phone,setPhone]=React.useState("");
  const [sending,setSending]=React.useState(false);
  const [consent,setConsent]=React.useState(false);
  const [error,setError]=React.useState<string|null>(null);

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(locked.current)return;locked.current=true;
    setSending(true);setError(null);
    try{
      const requestContext=context?{...context,...(project?{propertyName:project}:{})}:project?{propertyName:project}:undefined;
      const result=await postLead({idempotencyKey:key.current,source,propertyId:propertyId||null,name,phone,consent,comment:null,context:requestContext});
      setLeadId(result.id);
      void cache.invalidateQueries({queryKey:["my-journeys"]});
      setSent(true);
    }catch(err){setError(err instanceof Error?err.message:"Не удалось отправить заявку")}
    finally{locked.current=false;setSending(false)}
  };

  return <Sheet onOpenChange={(open)=>{
    if(open){
      recordPulseEvent({eventType:"lead_form_open",entityType:propertyId?"property":"funnel",entityId:propertyId||source,metadata:{source,project:project||null}});
    }else{if(sent){key.current=crypto.randomUUID();setName("");setPhone("");}setConsent(false);setSent(false);setError(null)}
  }}>
    <SheetTrigger asChild>{children}</SheetTrigger>
    <SheetContent side="bottom" className={styles.sheet}>
      <SheetClose className={styles.dismiss} aria-label="Закрыть заявку"><X size={18}/></SheetClose>
      {sent?<div className={styles.success}><CheckCircle2 size={38}/><h2>{runtime.enabled?"Заявка принята":"Обращение создано"}</h2><p>{runtime.enabled?"Менеджер PULSE.DV свяжется с вами и уточнит детали"+(project?" по "+project:"")+".":"Это демонстрационный режим. Заявка не отправлена менеджеру."}</p><Link className={styles.submit} to={"/journey"+(leadId?"?lead="+leadId:"")}>Открыть моё обращение <ChevronRight size={17}/></Link></div>:<>
        <SheetHeader><SheetTitle>{title}</SheetTitle><SheetDescription>{project?(project+". "):""}Оставьте контакт — всё остальное обсудим без спешки.</SheetDescription></SheetHeader>
        <form className={styles.form} onSubmit={submit}>
          <label><span>Как к вам обращаться</span><Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Имя" autoComplete="given-name" maxLength={100} required/></label>
          <label><span>Телефон</span><Input value={phone} onChange={(e)=>setPhone(e.target.value)} placeholder="+7 999 000-00-00" type="tel" inputMode="tel" autoComplete="tel" maxLength={24} required/></label>
          <label className={styles.consentRow}><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required/><span>Я даю <Link to="/personal-data-consent">согласие на обработку персональных данных</Link> для обработки моего обращения и подбора недвижимости.</span></label>
          {error&&<div className={styles.error}>{error}</div>}
          <button className={styles.submit} type="submit" disabled={sending||!consent}>{sending?"Отправляем…":"Отправить заявку"} <Send size={16}/></button>
          <small>{runtime.enabled?<><Link to="/privacy">Политика обработки персональных данных</Link></>:"Демонстрационный режим: заявка сохранится только в этом браузере и не будет отправлена менеджеру."}</small>
        </form>
      </>}
    </SheetContent>
  </Sheet>
}