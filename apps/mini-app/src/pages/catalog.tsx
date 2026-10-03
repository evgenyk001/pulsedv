import { hasSea, matchScore, matchesBudgetAndRooms } from "../../../../packages/domain/propertyMatch";
import { usePulseControlState } from "../helpers/usePulseControlState";
import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, List, MapPinned, ArrowUpDown, Check, ChevronRight, MapPin, X, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger, SheetClose } from "../components/Sheet";
import { Slider } from "../components/Slider";
import { PropertyCard } from "../components/PropertyCard";
import { PageHeader } from "../components/PageHeader";
import { useCatalogInfinite, useMapCatalog, useSelectionProperties } from "../helpers/useCatalog";
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
type ActiveFilterKey="q"|"city"|"price"|"delivery"|"rooms"|"sea";
const sortLabels:Record<SortMode,string>={
  popular:"По популярности",
  priceAsc:"Сначала дешевле",
  priceDesc:"Сначала дороже",
};

export default function CatalogPage(){
  const [params,setParams]=useSearchParams();
  const control=usePulseControlState();
  const {data:bounds}=usePriceBounds();
  const minBound=bounds?.minPriceRub??FALLBACK_MIN;
  const maxBound=bounds?.maxPriceRub??FALLBACK_MAX;
  const priceStep=bounds?.stepRub??FALLBACK_STEP;
  const initialMin=parsePriceParam(params.get("min"));
  const initialMax=parsePriceParam(params.get("max"));

  const [query,setQuery]=useState(params.get("q")||"");
  const deferredQuery=React.useDeferredValue(query);
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
  const [filterOpen,setFilterOpen]=useState(false);
  const navigate=useNavigate();
  const pulseMode=params.get("pulse")==="1";

  const appliedCity=params.get("city")||"Все";
  const appliedDelivery=params.get("delivery")||"Любой";
  const appliedRooms=params.get("rooms")||"Все";
  const appliedSea=params.get("sea")==="1";
  const appliedMin=parsePriceParam(params.get("min"))??minBound;
  const appliedMax=parsePriceParam(params.get("max"))??maxBound;

  const cityOptions=React.useMemo(()=>["Все",...new Set(control.select.cities.filter(Boolean))],[control.select.cities]);
  const roomOptions=React.useMemo(()=>["Все",...new Set(control.select.roomOptions.filter(value=>value&&value!=="Все"&&value!=="Не важно"))],[control.select.roomOptions]);
  const deliveryOptions=React.useMemo(()=>["Любой",...new Set(control.select.deliveryOptions.filter(value=>value&&value!=="Любой"&&value!=="Не важно"))],[control.select.deliveryOptions]);

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

  const serverFilters=React.useMemo(()=>({
    limit:20,
    q:params.get("q")||undefined,
    city:appliedCity,
    min:appliedMin,
    max:appliedMax,
    delivery:appliedDelivery,
    rooms:appliedRooms,
    sea:appliedSea,
    sort,
    view:"card" as const,
  }),[params,appliedCity,appliedMin,appliedMax,appliedDelivery,appliedRooms,appliedSea,sort]);

  const listQuery=useCatalogInfinite(serverFilters,view==="list"&&!pulseMode);
  const mapQuery=useMapCatalog({
    q:params.get("q")||undefined,city:appliedCity,min:appliedMin,max:appliedMax,
    delivery:appliedDelivery,rooms:appliedRooms,sea:appliedSea,sort,
  },view==="map"&&!pulseMode);
  const pulseQuery=useSelectionProperties(pulseMode);

  const serverItems=React.useMemo(()=>listQuery.data?.pages.flatMap(page=>page.items)??[],[listQuery.data]);
  const serverTotal=listQuery.data?.pages[0]?.total??0;

  const pulseMatches=React.useCallback((item:(NonNullable<typeof pulseQuery.data>)[number],filter:{
    city:string;delivery:string;rooms:string;min:number;max:number;sea:boolean;
  })=>{
    const matchesQuery=(item.name+" "+item.city+" "+item.district+" "+item.developerName).toLowerCase().includes((params.get("q")||"").trim().toLowerCase());
    const matchesCity=filter.city==="Все"||item.city===filter.city;
    const matchesDelivery=filter.delivery==="Любой"||filter.delivery==="Не важно"||(
      filter.delivery==="Сдан"
        ?/сдан|готов|введ[её]н/i.test(item.delivery)
        :item.delivery.includes(filter.delivery)
    );
    const matchesPriceAndRooms=matchesBudgetAndRooms(item,{rooms:filter.rooms,min:filter.min,max:filter.max});
    const matchesSea=!filter.sea||hasSea(item);
    return matchesQuery&&matchesCity&&matchesDelivery&&matchesPriceAndRooms&&matchesSea;
  },[params]);

  const pulseItems=useMemo(()=>{
    if(!pulseMode)return [];
    const properties=pulseQuery.data??[];
    const filter={city:appliedCity,delivery:appliedDelivery,rooms:appliedRooms,min:appliedMin,max:appliedMax,sea:appliedSea};
    const filtered=properties.filter(item=>pulseMatches(item,filter));
    if(sort==="priceAsc")return [...filtered].sort((a,b)=>a.priceFrom-b.priceFrom);
    if(sort==="priceDesc")return [...filtered].sort((a,b)=>b.priceFrom-a.priceFrom);
    return [...filtered].sort((a,b)=>matchScore(b,{city:appliedCity,rooms:appliedRooms,min:appliedMin,max:appliedMax,delivery:appliedDelivery,sea:appliedSea},control.select.weights)-matchScore(a,{city:appliedCity,rooms:appliedRooms,min:appliedMin,max:appliedMax,delivery:appliedDelivery,sea:appliedSea},control.select.weights)||a.sortOrder-b.sortOrder);
  },[pulseMode,pulseQuery.data,pulseMatches,appliedCity,appliedDelivery,appliedRooms,appliedMin,appliedMax,appliedSea,sort,control.select.weights]);

  const previewFilters=React.useMemo(()=>({
    limit:1,
    q:params.get("q")||undefined,
    city,
    min:priceRange[0],
    max:priceRange[1],
    delivery,
    rooms,
    sea,
    sort,
    view:"card" as const,
  }),[params,city,priceRange,delivery,rooms,sea,sort]);
  const previewQuery=useCatalogInfinite(previewFilters,filterOpen&&!pulseMode);
  const pulsePreviewTotal=React.useMemo(()=>{
    if(!pulseMode||!filterOpen)return 0;
    const filter={city,delivery,rooms,min:priceRange[0],max:priceRange[1],sea};
    return (pulseQuery.data??[]).filter(item=>pulseMatches(item,filter)).length;
  },[pulseMode,filterOpen,pulseQuery.data,pulseMatches,city,delivery,rooms,priceRange,sea]);

  const visible=pulseMode?pulseItems:serverItems;
  const total=pulseMode?pulseItems.length:serverTotal;
  const mapProperties=pulseMode?pulseItems:(mapQuery.data??[]);
  const isLoading=pulseMode?pulseQuery.isLoading:view==="map"?mapQuery.isLoading:listQuery.isLoading;
  const error=pulseMode?pulseQuery.error:view==="map"?mapQuery.error:listQuery.error;
  const previewTotal=pulseMode
    ?pulsePreviewTotal
    :(previewQuery.data?.pages[0]?.total??total);
  const previewLoading=filterOpen&&!pulseMode&&previewQuery.isLoading;

  const onQuery=(value:string)=>{setQuery(value);const next=new URLSearchParams(params);value?next.set("q",value):next.delete("q");setParams(next,{replace:true,flushSync:true});};
  const catalogReturnTo=React.useMemo(()=>{const next=new URLSearchParams(params);query?next.set("q",query):next.delete("q");const search=next.toString();return "/catalog"+(search?"?"+search:"")},[params,query]);

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

  const selectCity=(value:string)=>{
    setCity(value);
    if(value!=="Все"&&value!=="Владивосток")setSea(false);
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

  const syncFilterDraft=()=>{
    setCity(appliedCity);
    const nextRange:[number,number]=[appliedMin,appliedMax];
    setPriceRange(nextRange);
    setPriceDraft([formatRub(nextRange[0]),formatRub(nextRange[1])]);
    setDelivery(appliedDelivery);
    setRooms(appliedRooms);
    setSea(appliedSea);
  };

  const applyFilters=()=>{
    const next=new URLSearchParams(params);
    city==="Все"?next.delete("city"):next.set("city",city);
    priceRange[0]<=minBound?next.delete("min"):next.set("min",(priceRange[0]/1_000_000).toFixed(1));
    priceRange[1]>=maxBound?next.delete("max"):next.set("max",(priceRange[1]/1_000_000).toFixed(1));
    delivery==="Любой"?next.delete("delivery"):next.set("delivery",delivery);
    rooms==="Все"?next.delete("rooms"):next.set("rooms",rooms);
    sea?next.set("sea","1"):next.delete("sea");
    setParams(next,{replace:true});
    recordPulseEvent({eventType:"catalog_filter",entityType:"catalog",entityId:"filters",metadata:{city,min:priceRange[0],max:priceRange[1],delivery,rooms,sea,results:previewTotal}});
  };

  const resetFilterDraft=()=>{
    setCity("Все");
    const nextRange:[number,number]=[minBound,maxBound];
    setPriceRange(nextRange);
    setPriceDraft([formatRub(nextRange[0]),formatRub(nextRange[1])]);
    setDelivery("Любой");
    setRooms("Все");
    setSea(false);
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

  const clearAppliedFilter=(key:ActiveFilterKey)=>{
    const next=new URLSearchParams(params);
    if(key==="q"){next.delete("q");setQuery("");}
    if(key==="city"){next.delete("city");setCity("Все");}
    if(key==="price"){next.delete("min");next.delete("max");const range:[number,number]=[minBound,maxBound];setPriceRange(range);setPriceDraft([formatRub(range[0]),formatRub(range[1])]);}
    if(key==="delivery"){next.delete("delivery");setDelivery("Любой");}
    if(key==="rooms"){next.delete("rooms");setRooms("Все");}
    if(key==="sea"){next.delete("sea");setSea(false);}
    setParams(next,{replace:true});
  };

  const activeFilters:{key:ActiveFilterKey;label:string}[]=[];
  const appliedQuery=params.get("q")?.trim();
  if(appliedQuery)activeFilters.push({key:"q",label:"«"+appliedQuery+"»"});
  if(appliedCity!=="Все")activeFilters.push({key:"city",label:appliedCity});
  if(appliedRooms!=="Все")activeFilters.push({key:"rooms",label:appliedRooms==="Студия"?"Студия":appliedRooms+" комн."});
  if(appliedDelivery!=="Любой")activeFilters.push({key:"delivery",label:appliedDelivery==="Сдан"?"Сдан":appliedDelivery});
  if(appliedSea)activeFilters.push({key:"sea",label:"Вид на море"});
  if(appliedMin>minBound||appliedMax<maxBound)activeFilters.push({key:"price",label:shortRub(appliedMin)+" — "+shortRub(appliedMax)});

  const pluralProject=(count:number)=>{
    const n=Math.abs(count)%100;
    const n1=n%10;
    if(n>10&&n<20)return "проектов";
    if(n1===1)return "проект";
    if(n1>=2&&n1<=4)return "проекта";
    return "проектов";
  };
  const draftFilterCount=
    Number(city!=="Все")+
    Number(delivery!=="Любой")+
    Number(rooms!=="Все")+
    Number(sea)+
    Number(priceRange[0]>minBound||priceRange[1]<maxBound);

  return <div className={styles.page}>
    <PageHeader eyebrow="Каталог PULSE.DV" title="Новостройки" subtitle="Подбирайте спокойно — по району, бюджету и сроку сдачи."/>

    <SegmentedControl value={view} onChange={setView} ariaLabel="Режим каталога" options={[
      {value:"list",label:<><List size={16}/>Список</>},
      {value:"map",label:<><MapPinned size={16}/>Карта</>},
    ]}/>

    <div className={styles.search}>
      <Search size={18}/>
      <Input value={query} onChange={(e)=>onQuery(e.target.value)} placeholder="ЖК, район, застройщик" aria-label="Поиск"/>
      <Sheet open={filterOpen} onOpenChange={open=>{setFilterOpen(open);if(open)syncFilterDraft();}}>
        <SheetTrigger asChild>
          <button className={styles.filterTrigger} aria-label={activeFilters.length?"Фильтры, выбрано "+activeFilters.length:"Фильтры"}>
            <SlidersHorizontal size={18}/>
            {activeFilters.length>0&&<span>{activeFilters.length}</span>}
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className={styles.filterSheet}>
          <SheetHeader className={styles.filterHeader}>
            <SheetTitle className={styles.filterSheetTitle}>Фильтры</SheetTitle>
            <SheetDescription className={styles.filterSheetDescription}>Оставьте только подходящие проекты.</SheetDescription>
          </SheetHeader>

          <div className={styles.filterBody}>
            <section className={styles.filterGroup}>
              <label className={styles.filterTitle}><span>Бюджет</span><b>{shortRub(priceRange[0])} — {shortRub(priceRange[1])}</b></label>
              <div className={styles.priceInputs}>
                <label><span>От</span><div><Input inputMode="numeric" value={priceDraft[0]} onChange={e=>editPriceDraft(0,e.target.value)} onBlur={()=>commitPriceDraft(0)} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/><b>₽</b></div></label>
                <label><span>До</span><div><Input inputMode="numeric" value={priceDraft[1]} onChange={e=>editPriceDraft(1,e.target.value)} onBlur={()=>commitPriceDraft(1)} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/><b>₽</b></div></label>
              </div>
              <div className={styles.filterSlider}><Slider min={minBound} max={maxBound} step={priceStep} value={priceRange} onValueChange={setPriceFromSlider}/><div><span>{shortRub(minBound)}</span><span>{shortRub(maxBound)}</span></div></div>
            </section>

            <section className={styles.filterGroup}>
              <label className={styles.filterTitle}><span>Срок сдачи</span></label>
              <div className={styles.sheetChips}>{deliveryOptions.map(v=><button type="button" onClick={()=>setDelivery(v)} key={v} className={delivery===v?styles.sheetActive:""}>{delivery===v&&<Check size={13}/>} {v}</button>)}</div>
            </section>

            <section className={styles.filterGroup}>
              <label className={styles.filterTitle}><span>Город</span></label>
              <div className={styles.sheetChips}>{cityOptions.map(v=><button type="button" onClick={()=>selectCity(v)} key={v} className={city===v?styles.sheetActive:""}>{city===v&&<Check size={13}/>} {v}</button>)}</div>
            </section>

            <section className={styles.filterGroup}>
              <label className={styles.filterTitle}><span>Комнатность</span></label>
              <div className={styles.sheetChips}>{roomOptions.map(v=><button type="button" onClick={()=>setRooms(v)} key={v} className={rooms===v?styles.sheetActive:""}>{rooms===v&&<Check size={13}/>} {v}</button>)}</div>
            </section>

            {control.select.seaEnabled&&(city==="Все"||city==="Владивосток")&&<section className={styles.filterGroup}>
              <label className={styles.filterTitle}><span>Особенности</span></label>
              <div className={styles.sheetChips}><button type="button" onClick={()=>setSea(value=>!value)} className={sea?styles.sheetActive:""}>{sea&&<Check size={13}/>} Вид на море</button></div>
            </section>}
          </div>

          <div className={styles.filterActions} data-sheet-no-drag>
            <button type="button" className={styles.resetFilter} onClick={resetFilterDraft} disabled={draftFilterCount===0}>Сбросить</button>
            <SheetClose asChild>
              <button className={styles.apply} onClick={applyFilters} disabled={previewLoading}>
                {previewLoading?"Считаем…":"Показать "+previewTotal+" "+pluralProject(previewTotal)}
              </button>
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>
    </div>

    {activeFilters.length>0&&<div className={styles.activeFilters} aria-label="Активные фильтры">
      {activeFilters.map(filter=><button type="button" key={filter.key} onClick={()=>clearAppliedFilter(filter.key)}>{filter.label}<X size={12}/></button>)}
    </div>}

    {view==="list"&&<div className={styles.meta}>
      <span className={styles.metaSummary}>{pulseMode?<Sparkles size={13}/>:appliedCity!=="Все"?<MapPin size={13}/>:null} {pulseMode?"Лучшие совпадения · ":""}{total} {pluralProject(total)}{!pulseMode&&appliedCity!=="Все"?" · "+appliedCity:""}</span>
      <Sheet>
        <SheetTrigger asChild><button><ArrowUpDown size={14}/>{sortLabels[sort]}</button></SheetTrigger>
        <SheetContent side="bottom" className={styles.sortSheet}>
          <SheetHeader><SheetTitle>Сортировка</SheetTitle><SheetDescription>Выберите порядок проектов в каталоге.</SheetDescription></SheetHeader>
          <div className={styles.sortOptions}>
            {(Object.keys(sortLabels) as SortMode[]).map(mode=><SheetClose asChild key={mode}>
              <button onClick={()=>selectSort(mode)} className={sort===mode?styles.sortActive:""}><span>{sortLabels[mode]}</span>{sort===mode?<Check size={17}/>:<ChevronRight size={17}/>}</button>
            </SheetClose>)}
          </div>
        </SheetContent>
      </Sheet>
    </div>}

    {view==="list"?<div className={styles.list}>
      {isLoading&&<div className={styles.empty}><strong>Загружаем каталог</strong><span>Объекты появятся через секунду.</span></div>}
      {error&&<div className={styles.empty}><strong>Не удалось загрузить каталог</strong><span>Проверьте соединение и попробуйте снова.</span></div>}
      {!isLoading&&!error&&visible.map(property=><PropertyCard key={property.id} property={property} compact returnTo={catalogReturnTo}/>)}
      {!isLoading&&!error&&visible.length===0&&<div className={styles.empty}><strong>Ничего не нашли</strong><span>Попробуйте изменить фильтры или город.</span><button onClick={resetFilters}>Сбросить фильтры</button></div>}
      {!pulseMode&&listQuery.hasNextPage&&<button className={styles.loadMore} disabled={listQuery.isFetchingNextPage} onClick={()=>void listQuery.fetchNextPage()}>
        {listQuery.isFetchingNextPage?"Загружаем…":`Показать ещё · ${Math.max(0,total-visible.length)}`}
      </button>}
    </div>:<div className={styles.mapMode}>
      {isLoading?<div className={styles.empty}><strong>Загружаем карту</strong><span>Получаем объекты для отображения.</span></div>:
       error?<div className={styles.empty}><strong>Не удалось загрузить объекты</strong><span>Проверьте соединение.</span></div>:
       <PropertyMap properties={mapProperties} selectedId={selectedId} onSelect={setSelectedId} onOpen={id=>navigate("/property/"+id)} city={appliedCity==="Все"?undefined:appliedCity}/>}
    </div>}
  </div>;
}
