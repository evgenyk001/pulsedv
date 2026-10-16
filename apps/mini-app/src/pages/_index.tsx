import {GroupedMenu,MenuLink} from "../components/GroupedMenu";
import {PartnerEntryCard} from "../components/PartnerEntryCard";
import {ClientUpdates} from "../components/ClientUpdates";
import {ContinueChoice} from "../components/ContinueChoice";
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Building2, MapPin, Percent, Sparkles, ChevronRight, MessageCircle, UserRound } from "lucide-react";
import { PromoCarousel } from "../components/PromoCarousel";
import { PropertyCard } from "../components/PropertyCard";
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
        <div><div className={styles.brandName}>PULSE.DV</div><div className={styles.brandSub}>Новостройки Приморья</div></div>
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

    <GroupedMenu label="Быстрые действия" className={styles.quickActions}>
      <MenuLink to="/catalog" icon={<Building2/>} tone="blue" title="Каталог" description="Все новостройки"/>
      <MenuLink to="/map" icon={<MapPin/>} tone="green" title="На карте" description="По районам"/>
      <MenuLink to="/mortgage" icon={<Percent/>} tone="orange" title="Ипотека" description="Расчёт платежа"/>
      <MenuLink to="/selection" icon={<Sparkles/>} tone="purple" title="PULSE Select" description="Подбор под вас"/>
    </GroupedMenu>

    <ContinueChoice/>

    <section className={styles.section}>
      <div className={styles.sectionHead}><div><span>Выбор PULSE.DV</span><h2>Стоит посмотреть</h2></div><Link to="/catalog">Все <ChevronRight size={15}/></Link></div>
      <div className={styles.propertyRail}>{isLoading&&<p role="status">Загружаем проекты…</p>}{error&&<p role="alert">Не удалось загрузить проекты. <button onClick={()=>void refetch()}>Повторить</button></p>}{!isLoading&&properties.map(p=><PropertyCard key={p.id} property={p}/>)}</div>
    </section>

    <GroupedMenu label="Помощь с подбором"><MenuLink to="/selection" icon={<MessageCircle/>} tone="red" title="Соберём подборку под ваш бюджет" description="Менеджер поможет сравнить варианты"/></GroupedMenu>
    <PartnerEntryCard/>
  </div>
}