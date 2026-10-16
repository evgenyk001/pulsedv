import {GroupedMenu,MenuLink,MenuButton} from "../components/GroupedMenu";
import {PartnerEntryCard} from "../components/PartnerEntryCard";
import {useClientJourneys} from "../helpers/useClientJourneys";
import React from "react";
import { Link } from "react-router-dom";
import { Search, UserRound, MessageCircle, Phone, ShieldCheck, Heart, Clock3, Info, PlayCircle } from "lucide-react";
import { LeadSheet } from "../components/LeadSheet";
import { PageHeader } from "../components/PageHeader";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "../components/Sheet";
import styles from "./profile.module.css";

export default function ProfilePage(){
  const {data:journeys}=useClientJourneys();
  const active=journeys?.items.find(e=>!["closed","lost","deal"].includes(e.status));
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

    <GroupedMenu label="Ваш менеджер">
      {active?<MenuLink to={"/journey?lead="+active.leadId} icon={<MessageCircle/>} tone="blue" title="Персональный менеджер" description={active.managerName||"Команда PULSE.DV"} aria-label="Открыть переписку с менеджером"/>:<LeadSheet source="profile-manager"><MenuButton icon={<MessageCircle/>} tone="blue" title="Персональный менеджер" description="Команда PULSE.DV · поможем с покупкой" aria-label="Оставить заявку менеджеру"/></LeadSheet>}
    </GroupedMenu>

    <PartnerEntryCard/>
    <GroupedMenu title="Покупка квартиры">
      <MenuLink to="/journey" icon={<Clock3/>} tone="orange" title="Мои подборки и показы"/>
      <MenuLink to="/my-search" icon={<Search/>} tone="purple" title="Мой поиск"/>
      <MenuLink to="/favorites" icon={<Heart/>} tone="red" title="Избранное"/>
      <Sheet>
        <SheetTrigger asChild><MenuButton icon={<Clock3/>} tone="gray" title="История подборов"/></SheetTrigger>
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
    </GroupedMenu>
    <GroupedMenu title="О приложении">
      <MenuLink to="/privacy" icon={<ShieldCheck/>} tone="blue" title="Персональные данные"/>
      <Sheet>
        <SheetTrigger asChild><MenuButton icon={<Info/>} tone="gray" title="О сервисе PULSE.DV"/></SheetTrigger>
        <SheetContent side="bottom" className={styles.infoSheet}><SheetHeader><SheetTitle>О PULSE.DV</SheetTitle><SheetDescription>Мы помогаем сравнить новостройки, условия покупки и ипотечные сценарии в одном процессе.</SheetDescription></SheetHeader><div className={styles.about}><ShieldCheck size={20}/><p>Информация в приложении — отправная точка для подбора. Перед сделкой менеджер уточняет актуальные условия по выбранному проекту.</p></div></SheetContent>
      </Sheet>
      <MenuButton onClick={()=>window.dispatchEvent(new Event("pulse:show-onboarding"))} icon={<PlayCircle/>} tone="purple" title="Показать знакомство"/>
    </GroupedMenu>

    <LeadSheet title="Связаться с агентством" source="profile-contact"><button className={styles.contact}><Phone size={17}/>Связаться с PULSE.DV</button></LeadSheet>
  </div>
}
