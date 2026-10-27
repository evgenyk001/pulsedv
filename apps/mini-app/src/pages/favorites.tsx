import {LoadRecovery} from '../components/LoadRecovery';
import {IconTile} from '../components/IconTile';
import { Link } from "react-router-dom";
import { Heart, ChevronRight, Sparkles, GitCompareArrows } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { PropertyCard } from "../components/PropertyCard";
import { useFavoriteProperties } from "../helpers/useCatalog";
import { useFavoriteIds } from "../helpers/useFavoriteIds";
import styles from "./favorites.module.css";

export default function Favorites(){
  const {ids,notice}=useFavoriteIds();
  const {data:saved=[],isLoading,error:catalogError,refetch}=useFavoriteProperties(ids);
  return <div className={styles.page}>
    <PageHeader eyebrow="Ваш шорт-лист" title="Избранное" subtitle="Сохраняйте понравившиеся ЖК и сравнивайте два варианта рядом."/>

    {notice&&<p role="status">{notice}</p>}
    {catalogError&&!saved.length&&<LoadRecovery label="Обновить избранное" onRetry={()=>void refetch()}/>}
    {saved.length>0&&<Link to="/compare" className={styles.compareEntry}>
      <IconTile><GitCompareArrows size={21}/></IconTile>
      <span><strong>Сравнить ЖК</strong><small>{saved.length===2?'Два сохранённых ЖК — сразу рядом':saved.length>2?'Выберите два ЖК и посмотрите различия':'Сохраните ещё один ЖК для сравнения'}</small></span><ChevronRight size={19}/>
    </Link>}
    <div className={styles.list}>
      {!isLoading&&saved.map(property=><PropertyCard key={property.id} property={property} compact/>)}
      {!isLoading&&!catalogError&&saved.length===0&&<div className={styles.helper}><IconTile as="div"><Heart size={19}/></IconTile><span><strong>Пока ничего не сохранено</strong><small>Нажмите сердечко на карточке ЖК — объект появится здесь.</small></span></div>}
    </div>

    <Link to="/selection" className={styles.helper}>
      <IconTile as="div"><Sparkles size={19}/></IconTile>
      <span><strong>Слишком много вариантов?</strong><small>Соберём короткую подборку под ваши параметры.</small></span>
      <ChevronRight size={17}/>
    </Link>
    <Link to="/catalog" className={styles.catalog}><Heart size={16}/>Добавить ещё проекты</Link>
  </div>
}
