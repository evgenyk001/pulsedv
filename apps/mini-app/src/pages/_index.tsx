import {IconTile} from '../components/IconTile';
import {PartnerEntryCard} from "../components/PartnerEntryCard";
import {ClientUpdates} from "../components/ClientUpdates";
import {ContinueChoice} from "../components/ContinueChoice";
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Bell, Building2, MapPin, Percent, Sparkles, ChevronRight, MessageCircle, UserRound, BadgePercent, KeyRound } from "lucide-react";
import { PromoCarousel } from "../components/PromoCarousel";
import { PropertyCard } from "../components/PropertyCard";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "../components/Sheet";
import { useFeaturedProperties } from "../helpers/useCatalog";
import { Input } from "../components/Input";
import styles from "./_index.module.css";

export default function HomePage(){
  const navigate=useNavigate();
  const [query,setQuery]=React.useState("");
  const {data:properties=[],isLoading,error,refetch}=useFeaturedProperties(3);
  const submit=(e:React.FormEvent)=>{e.preventDefault();navigate(`/catalog${query?`?q=${encodeURIComponent(query)}`:""}`)};

  return <div className={styles.page}>
    <header className={styles.header}>
      <div className={styles.brand}>
        <div><div className={styles.brandName}>PULSEDV.RU</div><div className={styles.brandSub}>Новостройки Приморья</div></div>
      </div>
      <div className={styles.headerActions}>
        <ClientUpdates className={styles.iconButton}/>
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
      <Link to="/catalog"><IconTile><Building2 size={18}/></IconTile><div><b>Каталог</b><small>Все новостройки</small></div><ChevronRight size={16}/></Link>
      <Link to="/map"><IconTile><MapPin size={18}/></IconTile><div><b>На карте</b><small>По районам</small></div><ChevronRight size={16}/></Link>
      <Link to="/mortgage"><IconTile><Percent size={18}/></IconTile><div><b>Ипотека</b><small>Расчёт платежа</small></div><ChevronRight size={16}/></Link>
      <Link to="/selection"><IconTile><Sparkles size={18}/></IconTile><div><b>PULSE Select</b><small>Подбор под вас</small></div><ChevronRight size={16}/></Link>
    </section>

    <ContinueChoice/>

    <section className={styles.section}>
      <div className={styles.sectionHead}><div><span>Выбор PULSEDV.RU</span><h2>Стоит посмотреть</h2></div><Link to="/catalog">Все <ChevronRight size={15}/></Link></div>
      <div className={styles.propertyRail}>{isLoading&&<p role="status">Загружаем проекты…</p>}{error&&<p role="alert">Не удалось загрузить проекты. <button onClick={()=>void refetch()}>Повторить</button></p>}{!isLoading&&properties.map(p=><PropertyCard key={p.id} property={p}/>)}</div>
    </section>

    <Link to="/selection" className={styles.concierge}>
      <IconTile as="div" className={styles.conciergeIcon}><MessageCircle size={20}/></IconTile>
      <div><span>Не хочется искать самому?</span><strong>Соберём подборку под ваш бюджет</strong><small>Менеджер поможет сравнить варианты</small></div>
      <ChevronRight size={18}/>
    </Link>
    <PartnerEntryCard/>
  </div>
}