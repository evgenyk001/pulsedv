import React from "react";
import { Link } from "react-router-dom";
import { Heart, ChevronRight, Sparkles, GitCompareArrows, Check } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { PropertyCard } from "../components/PropertyCard";
import { useProperties } from "../helpers/useProperties";
import { useFavoriteIds } from "../helpers/useFavoriteIds";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../components/Sheet";
import styles from "./favorites.module.css";

export default function Favorites(){
  const {data:properties=[],isLoading}=useProperties();
  const {ids}=useFavoriteIds();
  const saved=properties.filter(x=>ids.includes(x.id));
  const [compareIds,setCompareIds]=React.useState<string[]>([]);

  React.useEffect(()=>{
    setCompareIds(current=>current.filter(id=>saved.some(property=>property.id===id)));
  },[ids.join("|")]);

  const toggleCompare=(id:string)=>{
    setCompareIds(current=>{
      if(current.includes(id))return current.filter(item=>item!==id);
      if(current.length>=3)return current;
      return [...current,id];
    });
  };

  const compared=saved.filter(property=>compareIds.includes(property.id));

  const compareButton=<button className={styles.compareCta} disabled={compareIds.length<2}>
    <GitCompareArrows size={17}/>
    Сравнить {compareIds.length>0?compareIds.length:""}
  </button>;

  return <div className={styles.page}>
    <PageHeader eyebrow="Ваш шорт-лист" title="Избранное" subtitle="Сохраняйте сильные варианты, отмечайте 2–3 проекта и сравнивайте их рядом."/>

    <div className={styles.list}>
      {!isLoading&&saved.map(property=>{
        const selected=compareIds.includes(property.id);
        const disabled=!selected&&compareIds.length>=3;
        return <div className={styles.savedItem} key={property.id}>
          <PropertyCard property={property} compact/>
          <button className={styles.compareToggle+" "+(selected?styles.compareSelected:"")} disabled={disabled} onClick={()=>toggleCompare(property.id)}>
            <span>{selected?<Check size={14}/>:<GitCompareArrows size={14}/>}</span>
            {selected?"В сравнении":"Добавить к сравнению"}
          </button>
        </div>;
      })}
      {!isLoading&&saved.length===0&&<div className={styles.helper}><div><Heart size={19}/></div><span><strong>Пока ничего не сохранено</strong><small>Нажмите сердечко на карточке ЖК — объект появится здесь.</small></span></div>}
    </div>

    {saved.length>0&&<div className={styles.compareBar}>
      <div><GitCompareArrows size={17}/><span><strong>Сравнение</strong><small>{compareIds.length<2?"Выберите минимум 2 проекта":compareIds.length+" проекта выбрано"}</small></span></div>
      {compareIds.length>=2?<Sheet>
        <SheetTrigger asChild>{compareButton}</SheetTrigger>
        <SheetContent side="bottom" className={styles.compareSheet}>
          <SheetHeader><SheetTitle>Сравнение проектов</SheetTitle><SheetDescription>Ключевые параметры выбранных ЖК — рядом.</SheetDescription></SheetHeader>
          <div className={styles.compareScroll}>
            <div className={styles.compareTable} style={{"--compare-count":compared.length} as React.CSSProperties}>
              <div className={styles.compareLabel}/>
              {compared.map(property=><div className={styles.compareProject} key={property.id}><strong>{property.name}</strong><span>{property.city} · {property.district}</span></div>)}

              <div className={styles.compareLabel}>Цена от</div>
              {compared.map(property=><b key={property.id}>{property.priceFrom.toFixed(1).replace(".",",")} млн ₽</b>)}

              <div className={styles.compareLabel}>Срок сдачи</div>
              {compared.map(property=><span key={property.id}>{property.delivery}</span>)}

              <div className={styles.compareLabel}>Класс</div>
              {compared.map(property=><span key={property.id}>{property.className}</span>)}

              <div className={styles.compareLabel}>Застройщик</div>
              {compared.map(property=><span key={property.id}>{property.developerName||"Уточняется"}</span>)}

              <div className={styles.compareLabel}>Планировки</div>
              {compared.map(property=><span key={property.id}>{property.floorplans.length?property.floorplans.length+" вариантов":"Уточняются"}</span>)}
            </div>
          </div>
          <div className={styles.compareLinks}>{compared.map(property=><Link key={property.id} to={"/property/"+property.id}>{property.name}<ChevronRight size={15}/></Link>)}</div>
        </SheetContent>
      </Sheet>:compareButton}
    </div>}

    <Link to="/selection" className={styles.helper}>
      <div><Sparkles size={19}/></div>
      <span><strong>Слишком много вариантов?</strong><small>Соберём короткую подборку под ваши параметры.</small></span>
      <ChevronRight size={17}/>
    </Link>
    <Link to="/catalog" className={styles.catalog}><Heart size={16}/>Добавить ещё проекты</Link>
  </div>
}