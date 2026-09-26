import { matchesBudgetAndRooms, hasSea, matchScore } from "../../../../packages/domain/propertyMatch";
import { usePulseControlState } from "../helpers/usePulseControlState";
import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, List, MapPinned, ArrowUpDown, Check, ChevronRight, MapPin } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger, SheetClose } from "../components/Sheet";
import { Slider } from "../components/Slider";
import { PropertyCard } from "../components/PropertyCard";
import { PageHeader } from "../components/PageHeader";
import { useProperties } from "../helpers/useProperties";
import { usePriceBounds } from "../helpers/usePriceBounds";
import { PropertyMap } from "../components/PropertyMap";
import { Input } from "../components/Input";
import { SegmentedControl } from "../components/SegmentedControl";
import { recordPulseEvent } from "../../../../packages/pulse-data";
import styles from "./catalog.module.css";

const FALLBACK_MIN=4_000_000;
const FALLBACK_MAX=25_000_000;
const FALLBACK_STEP=100_000;
const parsePriceParam=(value:string|null)=>{
  if(!value)return null;
  const parsed=Number(value);
  if(!Number.isFinite(parsed)||parsed<=0)return null;
  return parsed<1000?parsed*1_000_000:parsed;
};
const formatRub=(value:number)=>new Intl.NumberFormat("ru-RU").format(Math.round(value));
const shortRub=(value:number)=>{
  const mln=value/1_000_000;
  return (Number.isInteger(mln)?mln.toFixed(0):mln.toFixed(1).replace(".",","))+" млн ₽";
};
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
const snap=(value:number,step:number)=>Math.round(value/step)*step;

type SortMode="popular"|"priceAsc"|"priceDesc";
const sortLabels:Record<SortMode,string>={
  popular:"По популярности",
  priceAsc:"Сначала дешевле",
  priceDesc:"Сначала дороже",
};

export default function CatalogPage(){
  const [params,setParams]=useSearchParams();
  const control=usePulseControlState();
  const {data:properties=[],isLoading,error}=useProperties();
  const {data:bounds}=usePriceBounds();
  const minBound=bounds?.minPriceRub??FALLBACK_MIN;
  const maxBound=bounds?.maxPriceRub??FALLBACK_MAX;
  const priceStep=bounds?.stepRub??FALLBACK_STEP;
  const initialMin=parsePriceParam(params.get("min"));
  const initialMax=parsePriceParam(params.get("max"));

  const [query,setQuery]=useState(params.get("q")||"");
  const [city,setCity]=useState(params.get("city")||"Все");
  const [priceRange,setPriceRange]=useState<[number,number]>([initialMin??FALLBACK_MIN,initialMax??FALLBACK_MAX]);
  const [priceDraft,setPriceDraft]=useState<[string,string]>([formatRub(initialMin??FALLBACK_MIN),formatRub(initialMax??FALLBACK_MAX)]);
  const priceInitialized=React.useRef(false);
  const [delivery,setDelivery]=useState(params.get("delivery")||"Любой");
  const [rooms,setRooms]=useState(params.get("rooms")||"Все");
  const [sea,setSea]=useState(params.get("sea")==="1");
  const initialSort=params.get("sort") as SortMode|null;
  const [sort,setSort]=useState<SortMode>(initialSort&&sortLabels[initialSort]?initialSort:"popular");
  const view=params.get("view")==="map"?"map":"list";
  const [selectedId,setSelectedId]=useState<string|undefined>();
  const navigate=useNavigate();

  React.useEffect(()=>{
    if(initialSort&&sortLabels[initialSort])return;
    const stored=localStorage.getItem("pulse_catalog_sort") as SortMode|null;
    if(stored&&sortLabels[stored])setSort(stored);
  },[initialSort]);

  React.useEffect(()=>{
    if(!bounds||priceInitialized.current)return;
    const range:[number,number]=[initialMin??bounds.minPriceRub,initialMax??bounds.maxPriceRub];
    setPriceRange(range);setPriceDraft([formatRub(range[0]),formatRub(range[1])]);priceInitialized.current=true;
  },[bounds]);

  const visible=useMemo(()=>{
    const filtered=properties.filter((item)=>{
      const matchesQuery=(item.name+" "+item.city+" "+item.district+" "+item.developerName).toLowerCase().includes(query.toLowerCase());
      const matchesCity=city==="Все"||item.city===city;
      const matchesPrice=matchesBudgetAndRooms(item,{rooms,min:priceRange[0],max:priceRange[1]});
      const matchesDelivery=delivery==="Любой"||item.delivery.includes(delivery);
      const matchesRooms=true;
      const matchesSea=!sea||hasSea(item);
      return matchesQuery&&matchesCity&&matchesPrice&&matchesDelivery&&matchesRooms&&matchesSea;
    });
    if(sort==="priceAsc")return [...filtered].sort((a,b)=>a.priceFrom-b.priceFrom);
    if(sort==="priceDesc")return [...filtered].sort((a,b)=>b.priceFrom-a.priceFrom);
    if(params.get("pulse")==="1")return [...filtered].sort((a,b)=>matchScore(b,{city,rooms,min:priceRange[0],max:priceRange[1],delivery,sea},control.select.weights)-matchScore(a,{city,rooms,min:priceRange[0],max:priceRange[1],delivery,sea},control.select.weights)||a.sortOrder-b.sortOrder);
    return [...filtered].sort((a,b)=>a.sortOrder-b.sortOrder);
  },[properties,query,city,priceRange,delivery,rooms,sea,sort,params,control.select.weights]);

  const onQuery=(value:string)=>{
    setQuery(value);
    const next=new URLSearchParams(params);
    value?next.set("q",value):next.delete("q");
    setParams(next,{replace:true});
  };

  const setView=(nextView:"list"|"map")=>{
    const next=new URLSearchParams(params);
    if(nextView==="map")next.set("view","map");else next.delete("view");
    setParams(next,{replace:true});
  };

  const selectSort=(nextSort:SortMode)=>{
    setSort(nextSort);
    localStorage.setItem("pulse_catalog_sort",nextSort);
    const next=new URLSearchParams(params);
    nextSort==="popular"?next.delete("sort"):next.set("sort",nextSort);
    setParams(next,{replace:true});
  };

  const setPriceFromSlider=(values:number[])=>{
    const next:[number,number]=[values[0]??minBound,values[1]??maxBound];
    setPriceRange(next);
    setPriceDraft([formatRub(next[0]),formatRub(next[1])]);
  };

  const editPriceDraft=(index:0|1,value:string)=>{
    const clean=value.replace(/[^0-9]/g,"");
    setPriceDraft(prev=>{
      const next:[string,string]=[...prev] as [string,string];
      next[index]=clean?formatRub(Number(clean)):"";
      return next;
    });
  };

  const commitPriceDraft=(index:0|1)=>{
    const raw=Number(priceDraft[index].replace(/[^0-9]/g,""));
    let value=Number.isFinite(raw)&&raw>0?raw:priceRange[index];
    value=clamp(snap(value,priceStep),minBound,maxBound);
    const next:[number,number]=[...priceRange] as [number,number];
    next[index]=value;
    if(index===0&&next[0]>next[1])next[1]=next[0];
    if(index===1&&next[1]<next[0])next[0]=next[1];
    setPriceRange(next);
    setPriceDraft([formatRub(next[0]),formatRub(next[1])]);
  };

  const applyFilters=()=>{
    const next=new URLSearchParams(params);
    city==="Все"?next.delete("city"):next.set("city",city);
    next.set("min",(priceRange[0]/1_000_000).toFixed(1));
    next.set("max",(priceRange[1]/1_000_000).toFixed(1));
    delivery==="Любой"?next.delete("delivery"):next.set("delivery",delivery);
    rooms==="Все"?next.delete("rooms"):next.set("rooms",rooms);
    sea?next.set("sea","1"):next.delete("sea");
    setParams(next,{replace:true});
    recordPulseEvent({eventType:"catalog_filter",entityType:"catalog",entityId:"filters",metadata:{city,min:priceRange[0],max:priceRange[1],delivery,rooms,sea,results:visible.length}});
  };

  const resetFilters=()=>{
    setCity("Все");
    const nextRange:[number,number]=[minBound,maxBound];
    setPriceRange(nextRange);
    setPriceDraft([formatRub(nextRange[0]),formatRub(nextRange[1])]);
    setDelivery("Любой");
    setRooms("Все");
    setSea(false);
    setQuery("");
    const next=new URLSearchParams(params);
    next.delete("city");next.delete("min");next.delete("max");next.delete("delivery");next.delete("rooms");next.delete("sea");next.delete("mortgage");next.delete("q");
    setParams(next,{replace:true});
  };

  return <div className={styles.page}>
    <PageHeader eyebrow="Каталог PULSE.DV" title="Новостройки" subtitle="Подбирайте спокойно — по району, бюджету и сроку сдачи."/>

    <SegmentedControl
      value={view}
      onChange={setView}
      ariaLabel="Режим каталога"
      options={[
        {value:"list",label:<><List size={16}/>Список</>},
        {value:"map",label:<><MapPinned size={16}/>Карта</>},
      ]}
    />

    <div className={styles.search}>
      <Search size={18}/>
      <Input value={query} onChange={(e)=>onQuery(e.target.value)} placeholder="ЖК, район, застройщик" aria-label="Поиск"/>
      <Sheet>
        <SheetTrigger asChild><button aria-label="Фильтры"><SlidersHorizontal size={18}/></button></SheetTrigger>
        <SheetContent side="bottom" className={styles.filterSheet}>
          <SheetHeader><SheetTitle>Фильтры</SheetTitle><SheetDescription>Оставьте только подходящие проекты.</SheetDescription></SheetHeader>
          <div className={styles.filterBody}>
            <label className={styles.filterTitle}><span>Бюджет</span><b>{shortRub(priceRange[0])} — {shortRub(priceRange[1])}</b></label>
            <div className={styles.priceInputs}>
              <label><span>От</span><div><Input inputMode="numeric" value={priceDraft[0]} onChange={e=>editPriceDraft(0,e.target.value)} onBlur={()=>commitPriceDraft(0)} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/><b>₽</b></div></label>
              <label><span>До</span><div><Input inputMode="numeric" value={priceDraft[1]} onChange={e=>editPriceDraft(1,e.target.value)} onBlur={()=>commitPriceDraft(1)} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/><b>₽</b></div></label>
            </div>
            <div className={styles.filterSlider}><Slider min={minBound} max={maxBound} step={priceStep} value={priceRange} onValueChange={setPriceFromSlider}/><div><span>{shortRub(minBound)}</span><span>{shortRub(maxBound)}</span></div></div>
            <label className={styles.filterTitle}><span>Срок сдачи</span></label>
            <div className={styles.sheetChips}>{["Любой","2026","2027"].map(v=><button onClick={()=>setDelivery(v)} key={v} className={delivery===v?styles.sheetActive:""}>{delivery===v&&<Check size={14}/>} {v}</button>)}</div>
            <label className={styles.filterTitle}><span>Город</span></label>
            <div className={styles.sheetChips}>{["Все","Владивосток","Уссурийск","Артём"].map(v=><button onClick={()=>setCity(v)} key={v} className={city===v?styles.sheetActive:""}>{city===v&&<Check size={14}/>} {v}</button>)}</div>
            <label className={styles.filterTitle}><span>Комнатность</span></label>
            <div className={styles.sheetChips}>{["Все","Студия","1","2","3+"].map(v=><button onClick={()=>setRooms(v)} key={v} className={rooms===v?styles.sheetActive:""}>{rooms===v&&<Check size={14}/>} {v}</button>)}</div>
            <label className={styles.filterTitle}><span>Особенности</span></label>
            <div className={styles.sheetChips}><button onClick={()=>setSea(value=>!value)} className={sea?styles.sheetActive:""}>{sea&&<Check size={14}/>} Вид на море</button></div>
            <SheetClose asChild><button className={styles.apply} onClick={applyFilters}>Показать {visible.length} {visible.length===1?"проект":visible.length>1&&visible.length<5?"проекта":"проектов"}</button></SheetClose>
          </div>
        </SheetContent>
      </Sheet>
    </div>

    {view==="list"&&<div className={styles.meta}>
      <span className={styles.metaSummary}>{city!=="Все"&&<MapPin size={13}/>} {visible.length} {visible.length===1?"проект":visible.length>1&&visible.length<5?"проекта":"проектов"}{city!=="Все"?" · "+city:""}</span>
      <Sheet>
        <SheetTrigger asChild><button><ArrowUpDown size={14}/>{sortLabels[sort]}</button></SheetTrigger>
        <SheetContent side="bottom" className={styles.sortSheet}>
          <SheetHeader><SheetTitle>Сортировка</SheetTitle><SheetDescription>Выберите порядок проектов в каталоге.</SheetDescription></SheetHeader>
          <div className={styles.sortOptions}>
            {(Object.keys(sortLabels) as SortMode[]).map(mode=>
              <SheetClose asChild key={mode}>
                <button onClick={()=>selectSort(mode)} className={sort===mode?styles.sortActive:""}>
                  <span>{sortLabels[mode]}</span>
                  {sort===mode?<Check size={17}/>:<ChevronRight size={17}/>}
                </button>
              </SheetClose>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>}

    {view==="list"?<div className={styles.list}>
      {isLoading&&<div className={styles.empty}><strong>Загружаем каталог</strong><span>Объекты появятся через секунду.</span></div>}
      {error&&<div className={styles.empty}><strong>Не удалось загрузить каталог</strong><span>Проверьте соединение и попробуйте снова.</span></div>}
      {!isLoading&&!error&&visible.map(property=><PropertyCard
        key={property.id}
        property={property}
        catalog
        initialRoom={rooms}
        pulseScore={params.get("pulse")==="1"
          ?matchScore(property,{city,rooms,min:priceRange[0],max:priceRange[1],delivery,sea},control.select.weights)
          :null}
      />)}
      {!isLoading&&!error&&visible.length===0&&<div className={styles.empty}><strong>Ничего не нашли</strong><span>Попробуйте изменить фильтры или город.</span><button onClick={resetFilters}>Сбросить фильтры</button></div>}
    </div>:<div className={styles.mapMode}><PropertyMap properties={visible} selectedId={selectedId} onSelect={setSelectedId} onOpen={id=>navigate("/property/"+id)} city={city==="Все"?undefined:city}/></div>}
  </div>
}
