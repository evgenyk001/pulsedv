import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Bell, Building2, MapPin, Percent, Sparkles, ChevronRight, MessageCircle, UserRound, BadgePercent, KeyRound } from "lucide-react";
import { PromoCarousel } from "../components/PromoCarousel";
import { PropertyCard } from "../components/PropertyCard";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "../components/Sheet";
import { useProperties } from "../helpers/useProperties";
import { Input } from "../components/Input";
import styles from "./_index.module.css";

export default function HomePage(){
  const navigate=useNavigate();
  const [query,setQuery]=React.useState("");
  const {data:properties=[],isLoading}=useProperties();
  const submit=(e:React.FormEvent)=>{e.preventDefault();navigate(`/catalog${query?`?q=${encodeURIComponent(query)}`:""}`)};

  return <div className={styles.page}>
    <header className={styles.header}>
      <div className={styles.brand}>
        <div className={styles.mark}><span/><span/><span/></div>
        <div><div className={styles.brandName}>PULSE.DV</div><div className={styles.brandSub}>Новостройки Приморья</div></div>
      </div>
      <div className={styles.headerActions}>
        <Sheet>
          <SheetTrigger asChild><button className={styles.iconButton} aria-label="Уведомления"><Bell size={18}/><i/></button></SheetTrigger>
          <SheetContent side="bottom" className={styles.notificationSheet}>
            <SheetHeader><SheetTitle>Уведомления</SheetTitle><SheetDescription>Важное по вашим объектам и новым предложениям.</SheetDescription></SheetHeader>
            <div className={styles.noticeList}>
              <div><KeyRound size={18}/><span><b>Старт продаж</b><small>Открылись продажи новой очереди у моря.</small></span></div>
              <div><BadgePercent size={18}/><span><b>Ставка обновилась</b><small>Есть новые ипотечные предложения.</small></span></div>
            </div>
          </SheetContent>
        </Sheet>
        <Link to="/profile" className={styles.profileButton} aria-label="Профиль"><UserRound size={18}/></Link>
      </div>
    </header>

    <form className={styles.searchBar} onSubmit={submit}>
      <Search size={18}/>
      <Input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="ЖК, район или застройщик" aria-label="Поиск"/>
      <button type="submit" aria-label="Найти"><ChevronRight size={17}/></button>
    </form>

    <PromoCarousel/>

    <section className={styles.quickActions}>
      <Link to="/catalog"><span><Building2 size={18}/></span><div><b>Каталог</b><small>Все новостройки</small></div><ChevronRight size={16}/></Link>
      <Link to="/map"><span><MapPin size={18}/></span><div><b>На карте</b><small>По районам</small></div><ChevronRight size={16}/></Link>
      <Link to="/mortgage"><span><Percent size={18}/></span><div><b>Ипотека</b><small>Расчёт платежа</small></div><ChevronRight size={16}/></Link>
      <Link to="/selection"><span><Sparkles size={18}/></span><div><b>PULSE Select</b><small>Подбор под вас</small></div><ChevronRight size={16}/></Link>
    </section>

    <section className={styles.section}>
      <div className={styles.sectionHead}><div><span>Выбор PULSE.DV</span><h2>Стоит посмотреть</h2></div><Link to="/catalog">Все <ChevronRight size={15}/></Link></div>
      <div className={styles.propertyRail}>{!isLoading&&properties.slice(0,3).map(p=><PropertyCard key={p.id} property={p}/>)}</div>
    </section>

    <Link to="/selection" className={styles.concierge}>
      <div className={styles.conciergeIcon}><MessageCircle size={20}/></div>
      <div><span>Не хочется искать самому?</span><strong>Соберём подборку под ваш бюджет</strong><small>Менеджер поможет сравнить варианты</small></div>
      <ChevronRight size={18}/>
    </Link>
  </div>
}