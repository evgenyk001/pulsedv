import {PartnerSecurityPreferences} from '../components/PartnerSecurity';
import {IconTile} from '../components/IconTile';
import {AnnouncementPreferences} from '../components/AnnouncementPreferences';
import {GroupedMenu,MenuLink,MenuButton} from "../components/GroupedMenu";
import {useClientJourneys} from "../helpers/useClientJourneys";
import React from "react";
import { Link } from "react-router-dom";
import { Search, UsersRound, UserRound, MessageCircle, Phone, ShieldCheck, Heart, Clock3, Info, PlayCircle } from "lucide-react";
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
    <PageHeader eyebrow="Ваш PULSEDV.RU" title="Помощь с покупкой" subtitle="Избранное, подборы и связь с менеджером — в одном месте." action={<IconTile as="div" className={styles.avatar}><UserRound size={23}/></IconTile>}/>

    <GroupedMenu label="Ваш менеджер">
      {active?<MenuLink to={"/journey?lead="+active.leadId} icon={<MessageCircle/>} title="Персональный менеджер" description={active.managerName||"Команда PULSEDV.RU"} aria-label="Открыть переписку с менеджером"/>:<LeadSheet source="profile-manager"><MenuButton icon={<MessageCircle/>} title="Персональный менеджер" description="Команда PULSEDV.RU · поможем с покупкой" aria-label="Оставить заявку менеджеру"/></LeadSheet>}
    </GroupedMenu>

    <GroupedMenu label="Партнёрская программа"><MenuLink to="/partners" icon={<UsersRound/>} title="Партнёрская программа" description="Рекомендуйте покупателя и получите вознаграждение"/></GroupedMenu>
    <GroupedMenu title="Покупка квартиры">
      <MenuLink to="/journey" icon={<Clock3/>} title="Мои подборки и показы"/>
      <MenuLink to="/my-search" icon={<Search/>} title="Мой поиск"/>
      <MenuLink to="/favorites" icon={<Heart/>} title="Избранное"/>
      <Sheet>
        <SheetTrigger asChild><MenuButton icon={<Clock3/>} title="История подборов"/></SheetTrigger>
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
    <AnnouncementPreferences/>
    <PartnerSecurityPreferences/>
    <GroupedMenu title="О приложении">
      <MenuLink to="/privacy" icon={<ShieldCheck/>} title="Персональные данные"/>
      <Sheet>
        <SheetTrigger asChild><MenuButton icon={<Info/>} title="О сервисе PULSEDV.RU"/></SheetTrigger>
        <SheetContent side="bottom" className={`${styles.infoSheet} ${styles.aboutSheet}`}>
          <SheetHeader><SheetTitle>О PULSEDV.RU</SheetTitle><SheetDescription>Новостройки Приморья и помощь с покупкой квартиры — от первого выбора до сделки.</SheetDescription></SheetHeader>
          <div className={styles.aboutContent}>
            <section className={styles.aboutSection}><span className={styles.aboutEyebrow}>ОСНОВАТЕЛЬНИЦА</span><h2>Диана Козменко</h2><p>Основательница PULSE.DV — агентства недвижимости в Приморском крае. PULSEDV.RU объединяет каталог новостроек и работу с командой агентства в одном приложении.</p></section>
            <section className={styles.aboutSection}><h2>Помогаем выбрать своё</h2><p>Сравниваем жилые комплексы, планировки и варианты отделки с учётом вашего бюджета и планов. Помогаем разобраться в ипотечных программах, первоначальном взносе и ежемесячном платеже.</p></section>
            <section className={styles.aboutSection}><h2>Рядом на каждом этапе</h2><p>Консультируем, организуем показы и сопровождаем покупку. Подборки, переписка с менеджером и договорённости о встречах остаются под рукой.</p></section>
          </div>
          <div className={styles.about}><ShieldCheck size={20}/><p>Перед бронированием менеджер уточнит наличие квартиры, актуальную цену и условия покупки у застройщика.</p></div>
        </SheetContent>
      </Sheet>
      <MenuButton onClick={()=>window.dispatchEvent(new Event("pulse:show-onboarding"))} icon={<PlayCircle/>} title="Показать знакомство"/>
    </GroupedMenu>

    <GroupedMenu label="Связь с командой"><LeadSheet title="Связаться с агентством" source="profile-contact"><MenuButton icon={<Phone/>} title="Связаться с PULSEDV.RU"/></LeadSheet></GroupedMenu>
  </div>
}
