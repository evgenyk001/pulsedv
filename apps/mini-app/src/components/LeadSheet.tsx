import { runtime } from "../../../../packages/pulse-data/runtime";
import React from "react";
import { CheckCircle2, Send } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./Sheet";
import { Input } from "./Input";
import { postLead } from "../endpoints/leads_POST.schema";
import { recordPulseEvent } from "../../../../packages/pulse-data";
import styles from "./LeadSheet.module.css";

type LeadSheetProps={children:React.ReactNode;title?:string;project?:string;propertyId?:string;source?:string;context?:Record<string,unknown>};

export function LeadSheet({children,title="Получить консультацию",project,propertyId,source="app",context}:LeadSheetProps){
  const key=React.useRef(crypto.randomUUID());
  const locked=React.useRef(false);
  const [sent,setSent]=React.useState(false);
  const [name,setName]=React.useState("");
  const [phone,setPhone]=React.useState("");
  const [sending,setSending]=React.useState(false);
  const [error,setError]=React.useState<string|null>(null);

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(locked.current)return;locked.current=true;
    setSending(true);setError(null);
    try{
      await postLead({idempotencyKey:key.current,source,propertyId:propertyId||null,name,phone,comment:context?JSON.stringify(context):project?("Заявка по "+project):null});
      setSent(true);
    }catch(err){setError(err instanceof Error?err.message:"Не удалось отправить заявку")}
    finally{locked.current=false;setSending(false)}
  };

  return <Sheet onOpenChange={(open)=>{
    if(open){
      recordPulseEvent({eventType:"lead_form_open",entityType:propertyId?"property":"funnel",entityId:propertyId||source,metadata:{source,project:project||null}});
      if(source==="mortgage")recordPulseEvent({eventType:"mortgage_calculated",entityType:"mortgage",entityId:"calculator",metadata:{source,...context}});
    }else{if(sent){key.current=crypto.randomUUID();setName("");setPhone("");}setSent(false);setError(null)}
  }}>
    <SheetTrigger asChild>{children}</SheetTrigger>
    <SheetContent side="bottom" className={styles.sheet}>
      {sent?<div className={styles.success}><CheckCircle2 size={38}/><h2>{runtime.enabled?"Заявка принята":"Демонстрация завершена"}</h2><p>{runtime.enabled?"Менеджер PULSE.DV свяжется с вами и уточнит детали"+(project?" по "+project:"")+".":"Это демонстрационный режим. Заявка не отправлена менеджеру."}</p></div>:<>
        <SheetHeader><SheetTitle>{title}</SheetTitle><SheetDescription>{project?(project+". "):""}Оставьте контакт — всё остальное обсудим без спешки.</SheetDescription></SheetHeader>
        <form className={styles.form} onSubmit={submit}>
          <label><span>Как к вам обращаться</span><Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Имя" required/></label>
          <label><span>Телефон</span><Input value={phone} onChange={(e)=>setPhone(e.target.value)} placeholder="+7 999 000-00-00" inputMode="tel" required/></label>
          {error&&<div className={styles.error}>{error}</div>}
          <button className={styles.submit} type="submit" disabled={sending}>{sending?"Отправляем…":"Отправить заявку"} <Send size={16}/></button>
          <small>{runtime.enabled?"Нажимая кнопку, вы соглашаетесь на обработку контактных данных.":"Демонстрационный режим: заявка сохранится только в этом браузере и не будет отправлена менеджеру."}</small>
        </form>
      </>}
    </SheetContent>
  </Sheet>
}