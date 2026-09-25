import React from "react";
import { CheckCircle2, Send } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./Sheet";
import { Input } from "./Input";
import { postLead } from "../endpoints/leads_POST.schema";
import styles from "./LeadSheet.module.css";

type LeadSheetProps={children:React.ReactNode;title?:string;project?:string;propertyId?:string;source?:string};

export function LeadSheet({children,title="Получить консультацию",project,propertyId,source="app"}:LeadSheetProps){
  const [sent,setSent]=React.useState(false);
  const [name,setName]=React.useState("");
  const [phone,setPhone]=React.useState("");
  const [sending,setSending]=React.useState(false);
  const [error,setError]=React.useState<string|null>(null);

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();
    setSending(true);setError(null);
    try{
      await postLead({source,propertyId:propertyId||null,name,phone,comment:project?("Заявка по "+project):null});
      setSent(true);
    }catch(err){setError(err instanceof Error?err.message:"Не удалось отправить заявку")}
    finally{setSending(false)}
  };

  return <Sheet onOpenChange={(open)=>{if(!open){setSent(false);setError(null)}}}>
    <SheetTrigger asChild>{children}</SheetTrigger>
    <SheetContent side="bottom" className={styles.sheet}>
      {sent?<div className={styles.success}><CheckCircle2 size={38}/><h2>Заявка принята</h2><p>Менеджер PULSE.DV свяжется с вами и уточнит детали{project?(" по "+project):""}.</p></div>:<>
        <SheetHeader><SheetTitle>{title}</SheetTitle><SheetDescription>{project?(project+". "):""}Оставьте контакт — всё остальное обсудим без спешки.</SheetDescription></SheetHeader>
        <form className={styles.form} onSubmit={submit}>
          <label><span>Как к вам обращаться</span><Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Имя" required/></label>
          <label><span>Телефон</span><Input value={phone} onChange={(e)=>setPhone(e.target.value)} placeholder="+7 999 000-00-00" inputMode="tel" required/></label>
          {error&&<div className={styles.error}>{error}</div>}
          <button className={styles.submit} type="submit" disabled={sending}>{sending?"Отправляем…":"Отправить заявку"} <Send size={16}/></button>
          <small>Нажимая кнопку, вы соглашаетесь на обработку контактных данных.</small>
        </form>
      </>}
    </SheetContent>
  </Sheet>
}