import React from "react";
import { Link } from "react-router-dom";
import { UserRound, MessageCircle, Phone, ChevronRight, ShieldCheck, Heart, Clock3, Info, PlayCircle } from "lucide-react";
import { LeadSheet } from "../components/LeadSheet";
import { PageHeader } from "../components/PageHeader";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "../components/Sheet";
import styles from "./profile.module.css";

export default function ProfilePage(){
  const [history,setHistory]=React.useState<Array<{city:string;rooms:string;min:number;max:number;delivery:string;mortgage:boolean;sea:boolean;createdAt:number}>>([]);
  React.useEffect(()=>{
    try{
      const stored=JSON.parse(localStorage.getItem("pulse_selection_history")||"[]");
      setHistory(Array.isArray(stored)?stored.slice(0,3):[]);
    }catch{setHistory([])}
  },[]);
  const historyUrl=(item:(typeof history)[number])=>{
    const params=new URLSearchParams({
      city:item.city,
      rooms:item.rooms,
      min:(item.min/1_000_000).toFixed(1),
      max:(item.max/1_000_000).toFixed(1),
    });
    if(item.delivery!=="Любой")params.set("delivery",item.delivery);
    if(item.sea)params.set("sea","1");
    if(item.mortgage)params.set("mortgage","1");
    return "/catalog?"+params.toString();
  };
  const money=(value:number)=>(value/1_000_000).toFixed(value%1_000_000===0?0:1).replace(".",",")+" млн";
  return <div className={styles.page}>
    <PageHeader eyebrow="Ваш PULSE.DV" title="Помощь с покупкой" subtitle="Избранное, подборы и связь с менеджером — в одном месте." action={<div className={styles.avatar}><UserRound size={23}/></div>}/>

    <section className={styles.manager}>
      <div className={styles.managerIcon}><MessageCircle size={19}/></div>
      <div><span>Персональный менеджер</span><strong>Команда PULSE.DV</strong><small>Ответим по ЖК, ипотеке и сделке</small></div>
      <LeadSheet source="profile-manager"><button aria-label="Написать менеджеру"><ChevronRight size={18}/></button></LeadSheet>
    </section>

    <section className={styles.menu}>
      <Link to="/favorites"><Heart size={18}/><span><b>Избранное</b><small>Ваш шорт-лист объектов</small></span><ChevronRight size={17}/></Link>
      <Sheet>
        <SheetTrigger asChild><button><Clock3 size={18}/><span><b>История подборов</b><small>Последние параметры поиска</small></span><ChevronRight size={17}/></button></SheetTrigger>
        <SheetContent side="bottom" className={styles.infoSheet}><SheetHeader><SheetTitle>История подборов</SheetTitle><SheetDescription>Последние сценарии, к которым можно вернуться.</SheetDescription></SheetHeader>
          <div className={styles.historyList}>
            {history.length?history.map(item=><div className={styles.historyItem} key={item.createdAt}>
              <span>{item.city} · {item.rooms==="Студия"?"Студия":item.rooms+" комнаты"}</span>
              <strong>{money(item.min)} — {money(item.max)} ₽{item.delivery!=="Любой"?" · "+item.delivery:""}</strong>
              <Link to={historyUrl(item)}>Открыть результаты</Link>
            </div>):<div className={styles.historyEmpty}>Пройдите PULSE Select — последние подборы появятся здесь.</div>}
          </div>
        </SheetContent>
      </Sheet>
      <Sheet>
        <SheetTrigger asChild><button><Info size={18}/><span><b>О сервисе PULSE.DV</b><small>Как устроен подбор и сопровождение</small></span><ChevronRight size={17}/></button></SheetTrigger>
        <SheetContent side="bottom" className={styles.infoSheet}><SheetHeader><SheetTitle>О PULSE.DV</SheetTitle><SheetDescription>Мы помогаем сравнить новостройки, условия покупки и ипотечные сценарии в одном процессе.</SheetDescription></SheetHeader><div className={styles.about}><ShieldCheck size={20}/><p>Информация в приложении — отправная точка для подбора. Перед сделкой менеджер уточняет актуальные условия по выбранному проекту.</p></div></SheetContent>
      </Sheet>
      <button onClick={()=>window.dispatchEvent(new Event("pulse:show-onboarding"))}><PlayCircle size={18}/><span><b>Показать знакомство</b><small>Повторно открыть онбординг приложения</small></span><ChevronRight size={17}/></button>
    </section>

    <LeadSheet title="Связаться с агентством" source="profile-contact"><button className={styles.contact}><Phone size={17}/>Связаться с PULSE.DV</button></LeadSheet>
    <Link to="/login" className={styles.workspace}>Для команды PULSE.DV</Link>
  </div>
}
