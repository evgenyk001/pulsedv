import React from "react";
import {
  Archive,Building2,CheckCircle2,ChevronLeft,ChevronRight,Clock3,Download,FileSpreadsheet,
  FileText,HardDrive,ImagePlus,Images,MapPin,PackageOpen,Plus,Save,Search,Trash2,Upload,X
} from "lucide-react";
import { PageFrame } from "../components/PageFrame";
import type { PulseProperty } from "../../../../packages/pulse-data";
import {
  createAdminProperty,deleteAdminMedia,getAdminProperty,importAdminCatalog,listAdminCatalog,
  saveAdminProperty,uploadAdminMedia,uploadAdminMediaCompact
} from "../catalogApi";

type StatusFilter="all"|"draft"|"published"|"archived";
type CsvRow=Record<string,string>;
type CatalogCounts={all:number;published:number;draft:number;archived:number};

const fresh=():PulseProperty=>({
  id:crypto.randomUUID(),name:"Новый ЖК",city:"Владивосток",district:"",address:null,
  latitude:null,longitude:null,priceFrom:0,delivery:"",className:"",status:"draft",
  description:"",developerName:"",tags:[],coverImageUrl:null,sortOrder:999,
  images:[],features:[],floorplans:[],documents:[]
});

const numberOrNull=(value:string|undefined)=>{
  if(!value?.trim())return null;
  const parsed=Number(value.replace(",","."));
  return Number.isFinite(parsed)?parsed:null;
};
const numberOr=(value:string|undefined,fallback:number)=>{
  const parsed=numberOrNull(value);
  return parsed===null?fallback:parsed;
};
const formatPrice=(value:number)=>value?value.toFixed(1).replace(".",",")+" млн ₽":"Цена не указана";

function parseCsv(text:string):CsvRow[]{
  const source=text.replace(/^\uFEFF/,"");
  const first=source.split(/\r?\n/,1)[0]||"";
  const delimiter=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?";":",";
  const rows:string[][]=[];
  let row:string[]=[];let cell="";let quoted=false;
  for(let i=0;i<source.length;i++){
    const char=source[i];
    if(char==='"'){
      if(quoted&&source[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;
    }else if(char===delimiter&&!quoted){row.push(cell);cell="";}
    else if((char==="\n"||char==="\r")&&!quoted){
      if(char==="\r"&&source[i+1]==="\n")i++;
      row.push(cell);cell="";
      if(row.some(value=>value.trim()!==""))rows.push(row);
      row=[];
    }else cell+=char;
  }
  row.push(cell);if(row.some(value=>value.trim()!==""))rows.push(row);
  if(rows.length<2)return[];
  const headers=rows[0].map(value=>value.trim());
  return rows.slice(1).map(values=>Object.fromEntries(headers.map((header,index)=>[header,(values[index]||"").trim()])));
}

function csvEscape(value:unknown){
  const text=String(value??"");
  return /[;"\n\r]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text;
}
function downloadCsv(name:string,headers:string[],example:string[]){
  const body="\uFEFF"+headers.map(csvEscape).join(";")+"\r\n"+example.map(csvEscape).join(";")+"\r\n";
  const url=URL.createObjectURL(new Blob([body],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
}
function downloadTemplates(){
  const files=[
    ["pulse-objects.csv",
      ["id","name","city","district","address","developerName","delivery","className","priceFrom","description","tags","latitude","longitude","status","coverImageUrl","sortOrder"],
      ["solnechniy","ЖК Солнечный","Владивосток","Патрокл","Владивосток, Патрокл","Застройщик","IV кв. 2026","Комфорт+","6.2","Описание ЖК","Вид на море|Семейный","","","draft","","10"]],
    ["pulse-floorplans.csv",
      ["propertyId","id","roomLabel","areaFrom","areaTo","priceFrom","imageUrl","sortOrder"],
      ["solnechniy","2room-56","2","52","69","8.6","","1"]],
    ["pulse-features.csv",
      ["propertyId","id","label","icon","sortOrder"],
      ["solnechniy","","Вид на море","waves","1"]],
    ["pulse-images.csv",
      ["propertyId","id","url","alt","sortOrder"],
      ["solnechniy","","https://example.com/photo.jpg","ЖК Солнечный","1"]],
    ["pulse-documents.csv",
      ["propertyId","id","kind","name","url","mimeType","sizeBytes","sortOrder"],
      ["solnechniy","","presentation","Презентация ЖК","https://example.com/presentation.pdf","application/pdf","","1"]],
  ] as const;
  files.forEach((file,index)=>setTimeout(()=>downloadCsv(file[0],[...file[1]],[...file[2]]),index*100));
}
function fileKind(name:string){
  const lower=name.toLowerCase();
  if(lower.includes("floorplan"))return"floorplans";
  if(lower.includes("feature"))return"features";
  if(lower.includes("image"))return"images";
  if(lower.includes("document")||lower.includes("presentation"))return"documents";
  return"objects";
}
function readiness(property:PulseProperty){
  const checks=[!!property.coverImageUrl,property.priceFrom>0,!!property.developerName.trim(),!!property.delivery.trim()];
  return Math.round(checks.filter(Boolean).length/checks.length*100);
}

export function ServerObjectsPage(){
  const [page,setPage]=React.useState(1);
  const [status,setStatus]=React.useState<StatusFilter>("all");
  const [query,setQuery]=React.useState("");
  const deferredQuery=React.useDeferredValue(query);
  const [data,setData]=React.useState<{items:PulseProperty[];total:number;hasMore:boolean}>({items:[],total:0,hasMore:false});
  const [counts,setCounts]=React.useState<CatalogCounts>({all:0,published:0,draft:0,archived:0});
  const [selected,setSelected]=React.useState<PulseProperty|null>(null);
  const [dirty,setDirty]=React.useState(false);
  const [loading,setLoading]=React.useState(true);
  const [busy,setBusy]=React.useState(false);
  const [error,setError]=React.useState("");
  const [notice,setNotice]=React.useState("");

  const loadCounts=React.useCallback(async()=>{
    const [all,published,draft,archived]=await Promise.all([
      listAdminCatalog({page:1,limit:1,status:"all"}),
      listAdminCatalog({page:1,limit:1,status:"published"}),
      listAdminCatalog({page:1,limit:1,status:"draft"}),
      listAdminCatalog({page:1,limit:1,status:"archived"}),
    ]);
    setCounts({all:all.total,published:published.total,draft:draft.total,archived:archived.total});
  },[]);

  const load=React.useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const result=await listAdminCatalog({page,limit:24,q:deferredQuery||undefined,status});
      setData({items:result.items,total:result.total,hasMore:result.hasMore});
    }catch(e){setError(e instanceof Error?e.message:"Не удалось загрузить каталог")}
    finally{setLoading(false)}
  },[page,status,deferredQuery]);

  React.useEffect(()=>{void load()},[load]);
  React.useEffect(()=>{void loadCounts().catch(()=>{})},[loadCounts]);
  React.useEffect(()=>{setPage(1)},[status,deferredQuery]);

  const reload=async()=>{await Promise.all([load(),loadCounts()])};

  const open=async(id:string)=>{
    setBusy(true);setError("");
    try{setSelected(await getAdminProperty(id));setDirty(false)}
    catch(e){setError(e instanceof Error?e.message:"Не удалось открыть объект")}
    finally{setBusy(false)}
  };

  const patch=(change:Partial<PulseProperty>)=>{
    setSelected(current=>current?{...current,...change}:current);
    setDirty(true);
  };

  const save=async()=>{
    if(!selected)return null;
    setBusy(true);setError("");
    try{
      const next=await saveAdminProperty({...selected,documents:selected.documents??[]});
      setSelected(next);setDirty(false);await reload();setNotice("Объект сохранён");
      return next;
    }catch(e){setError(e instanceof Error?e.message:"Не удалось сохранить");return null}
    finally{setBusy(false)}
  };

  const ensureSaved=async()=>dirty?await save():selected;

  const add=async()=>{
    setBusy(true);setError("");
    try{
      const created=await createAdminProperty(fresh());
      setSelected(created);setDirty(false);await reload();
    }catch(e){setError(e instanceof Error?e.message:"Не удалось создать ЖК")}
    finally{setBusy(false)}
  };

  const upload=async(files:FileList|null,kind:"cover"|"gallery"|"presentation",floorplanId?:string)=>{
    if(!files?.length||!selected)return;
    const base=await ensureSaved();if(!base)return;
    setBusy(true);setError("");
    try{
      let current=base;
      for(const file of Array.from(files))current=await uploadAdminMedia(current.id,file,kind,floorplanId);
      setSelected(current);setDirty(false);await reload();setNotice("Файлы загружены");
    }catch(e){setError(e instanceof Error?e.message:"Не удалось загрузить файл")}
    finally{setBusy(false)}
  };

  const uploadFloorplan=async(file:File|undefined,planId:string|undefined)=>{
    if(!file||!planId||!selected)return;
    const base=await ensureSaved();if(!base)return;
    setBusy(true);setError("");
    try{
      const current=await uploadAdminMedia(base.id,file,"floorplan",planId);
      setSelected(current);setDirty(false);setNotice("Планировка загружена");
    }catch(e){setError(e instanceof Error?e.message:"Не удалось загрузить планировку")}
    finally{setBusy(false)}
  };

  const removeMedia=async(mediaId:string|undefined,kind:"gallery"|"presentation"|"document"|"floorplan")=>{
    if(!selected||!mediaId)return;
    const base=await ensureSaved();if(!base)return;
    setBusy(true);setError("");
    try{
      const current=await deleteAdminMedia(base.id,mediaId,kind);
      setSelected(current);setDirty(false);
    }catch(e){setError(e instanceof Error?e.message:"Не удалось удалить файл")}
    finally{setBusy(false)}
  };

  const importMediaBatch=async(files:FileList|null)=>{
    if(!files?.length)return;
    setBusy(true);setError("");setNotice("");
    let uploaded=0;const failed:string[]=[];
    try{
      for(const file of Array.from(files)){
        const stem=file.name.replace(/\.[^.]+$/,"");
        const parts=stem.split("__").filter(Boolean);
        const propertyId=parts[0];
        const token=(parts[1]||"").toLowerCase();
        if(!propertyId||!token){failed.push(file.name);continue}
        try{
          if(token==="cover")await uploadAdminMediaCompact(propertyId,file,"cover");
          else if(token==="gallery")await uploadAdminMediaCompact(propertyId,file,"gallery");
          else if(token==="presentation")await uploadAdminMediaCompact(propertyId,file,"presentation");
          else if(token==="document")await uploadAdminMediaCompact(propertyId,file,"document");
          else if(token==="floorplan"&&parts[2])await uploadAdminMediaCompact(propertyId,file,"floorplan",parts[2]);
          else{failed.push(file.name);continue}
          uploaded++;
        }catch{failed.push(file.name)}
      }
      setNotice(`Медиа: загружено ${uploaded}${failed.length?`, не разобрано ${failed.length}`:""}`);
      if(failed.length)setError("Проверьте имена файлов: "+failed.slice(0,5).join(", ")+(failed.length>5?"…":""));
      await reload();
    }finally{setBusy(false)}
  };

  const importCsv=async(files:FileList|null)=>{
    if(!files?.length)return;
    setBusy(true);setError("");setNotice("");
    try{
      const parsed=new Map<string,CsvRow[]>();
      for(const file of Array.from(files))parsed.set(fileKind(file.name),parseCsv(await file.text()));
      const objectRows=parsed.get("objects")??[];
      if(!objectRows.length)throw new Error("Нужен CSV с объектами. Имя файла — например pulse-objects.csv");

      const floorplansBy=new Map<string,any[]>();
      for(const row of parsed.get("floorplans")??[]){
        if(!row.propertyId)continue;
        const list=floorplansBy.get(row.propertyId)??[];
        list.push({id:row.id||crypto.randomUUID(),roomLabel:row.roomLabel||"1",areaFrom:numberOrNull(row.areaFrom),areaTo:numberOrNull(row.areaTo),priceFrom:numberOrNull(row.priceFrom),imageUrl:row.imageUrl||null,sortOrder:numberOr(row.sortOrder,list.length)});
        floorplansBy.set(row.propertyId,list);
      }
      const featuresBy=new Map<string,any[]>();
      for(const row of parsed.get("features")??[]){
        if(!row.propertyId||!row.label)continue;
        const list=featuresBy.get(row.propertyId)??[];
        list.push({id:row.id||crypto.randomUUID(),label:row.label,icon:row.icon||"building",sortOrder:numberOr(row.sortOrder,list.length)});
        featuresBy.set(row.propertyId,list);
      }
      const imagesBy=new Map<string,any[]>();
      for(const row of parsed.get("images")??[]){
        if(!row.propertyId||!row.url)continue;
        const list=imagesBy.get(row.propertyId)??[];
        list.push({id:row.id||crypto.randomUUID(),url:row.url,alt:row.alt||"",sortOrder:numberOr(row.sortOrder,list.length)});
        imagesBy.set(row.propertyId,list);
      }
      const documentsBy=new Map<string,any[]>();
      for(const row of parsed.get("documents")??[]){
        if(!row.propertyId||!row.url)continue;
        const list=documentsBy.get(row.propertyId)??[];
        list.push({id:row.id||crypto.randomUUID(),kind:row.kind==="document"?"document":"presentation",name:row.name||"Документ",url:row.url,mimeType:row.mimeType||null,sizeBytes:numberOrNull(row.sizeBytes),sortOrder:numberOr(row.sortOrder,list.length)});
        documentsBy.set(row.propertyId,list);
      }

      const properties:PulseProperty[]=objectRows.map((row,index)=>({
        id:row.id||crypto.randomUUID(),name:row.name||"Новый ЖК",city:row.city||"Владивосток",district:row.district||"",
        address:row.address||null,latitude:numberOrNull(row.latitude),longitude:numberOrNull(row.longitude),
        priceFrom:numberOr(row.priceFrom,0),delivery:row.delivery||"",className:row.className||"",
        status:row.status==="published"||row.status==="archived"?row.status:"draft",description:row.description||"",
        developerName:row.developerName||"",tags:(row.tags||"").split("|").map(x=>x.trim()).filter(Boolean),
        coverImageUrl:row.coverImageUrl||null,sortOrder:numberOr(row.sortOrder,index),
        images:imagesBy.get(row.id)||[],features:featuresBy.get(row.id)||[],floorplans:floorplansBy.get(row.id)||[],
        documents:documentsBy.get(row.id)||[],
      }));

      const replace={images:parsed.has("images"),features:parsed.has("features"),floorplans:parsed.has("floorplans"),documents:parsed.has("documents")};
      const replacing=[replace.floorplans&&"планировки",replace.features&&"особенности",replace.images&&"фото по URL",replace.documents&&"документы по URL"].filter(Boolean).join(", ");
      const confirmed=window.confirm(`Импортировать ${properties.length} ЖК?\n\nСуществующие объекты с тем же ID будут обновлены.${replacing?`\nБудут заменены: ${replacing}.`:"\nМедиа и дочерние данные без отдельного CSV сохранятся."}`);
      if(!confirmed){setNotice("Импорт отменён");return}
      const result=await importAdminCatalog(properties,replace);
      setNotice(`Импортировано ${result.total}: новых ${result.created}, обновлено ${result.updated}`);
      setPage(1);await reload();
    }catch(e){setError(e instanceof Error?e.message:"Не удалось импортировать CSV")}
    finally{setBusy(false)}
  };

  const totalPages=Math.max(1,Math.ceil(data.total/24));
  const p=selected;
  const ready=p?readiness(p):0;

  return <PageFrame
    eyebrow="CATALOG ENGINE"
    title="Объекты"
    description="Единый центр каталога: добавляйте ЖК по одному, импортируйте сотнями и управляйте медиа без GitHub."
    action={<button className="primaryAction catalogPrimaryCreate" disabled={busy} onClick={()=>void add()}><Plus size={16}/>Добавить ЖК</button>}
  >
    {(error||notice)&&<div className={error?"errorNotice":"successNotice"}>{error||notice}</div>}

    <section className="catalogOverview">
      <article><span><Building2 size={17}/></span><div><small>Всего в каталоге</small><strong>{counts.all}</strong><p>ЖК в рабочей базе</p></div></article>
      <article><span className="success"><CheckCircle2 size={17}/></span><div><small>Опубликовано</small><strong>{counts.published}</strong><p>Видят пользователи</p></div></article>
      <article><span className="warning"><Clock3 size={17}/></span><div><small>Черновики</small><strong>{counts.draft}</strong><p>Требуют подготовки</p></div></article>
      <article><span className="muted"><Archive size={17}/></span><div><small>Архив</small><strong>{counts.archived}</strong><p>Скрыты из Mini App</p></div></article>
    </section>

    <section className="catalogImportHub">
      <div className="catalogImportIntro">
        <span className="kicker">МАССОВАЯ ЗАГРУЗКА</span>
        <h2>Добавляйте десятки и сотни ЖК за один проход</h2>
        <p>Данные импортируются отдельно от фото и PDF. Уже загруженные медиа не удаляются, если вы обновляете только основной CSV.</p>
      </div>
      <div className="catalogImportActions">
        <button onClick={downloadTemplates}><span><Download size={19}/></span><div><b>Скачать шаблоны</b><small>5 CSV-файлов для Excel</small></div><ChevronRight size={17}/></button>
        <label><span><FileSpreadsheet size={19}/></span><div><b>Импортировать данные</b><small>ЖК, планировки, параметры</small></div><ChevronRight size={17}/><input type="file" accept=".csv,text/csv" multiple onChange={e=>void importCsv(e.target.files)}/></label>
        <label><span><Images size={19}/></span><div><b>Загрузить медиа</b><small>Фото и PDF пачкой</small></div><ChevronRight size={17}/><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onChange={e=>void importMediaBatch(e.target.files)}/></label>
      </div>
      <div className="catalogImportFoot"><HardDrive size={14}/><span>Файлы хранятся в media volume на VPS. GitHub остаётся только для кода.</span></div>
    </section>

    <section className="catalogWorkspace">
      <div className="catalogWorkspaceTop">
        <div>
          <span className="kicker">БАЗА ОБЪЕКТОВ</span>
          <h2>{status==="all"?"Все ЖК":status==="published"?"Опубликованные":status==="draft"?"Черновики":"Архив"}</h2>
        </div>
        <label className="controlSearch catalogSearch"><Search size={17}/><input placeholder="ЖК, город, застройщик" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      </div>

      <div className="catalogFilters">
        <div className="segmented">
          {([["all","Все"],["published","Опубликованы"],["draft","Черновики"],["archived","Архив"]] as [StatusFilter,string][]).map(([value,label])=>
            <button key={value} className={status===value?"active":""} onClick={()=>setStatus(value)}>{label}</button>
          )}
        </div>
        <div className="catalogPageMeta"><b>{data.total}</b><span>объектов · страница {page} из {totalPages}</span></div>
      </div>

      {loading?<div className="emptyState catalogLoading"><PackageOpen size={26}/><strong>Загружаем каталог</strong><span>Получаем только текущую страницу — каталог не перегружает Control даже при 1000+ ЖК.</span></div>:
        data.items.length?<div className="catalogObjectGrid">{data.items.map(item=><button key={item.id} className="catalogObjectCard" onClick={()=>void open(item.id)}>
          <div className="catalogObjectImage">
            {item.coverImageUrl?<img src={item.coverImageUrl} alt=""/>:<div className="objectPlaceholder"><Building2 size={24}/><span>PULSE.DV</span></div>}
            <span className={"statusChip "+item.status}>{item.status==="published"?"Опубликован":item.status==="draft"?"Черновик":"Архив"}</span>
          </div>
          <div className="catalogObjectBody">
            <div className="catalogObjectTitle"><div><h3>{item.name}</h3><p><MapPin size={12}/>{item.city}{item.district?" · "+item.district:""}</p></div><ChevronRight size={18}/></div>
            <div className="catalogObjectFacts">
              <span><small>Цена от</small><b>{formatPrice(item.priceFrom)}</b></span>
              <span><small>Срок</small><b>{item.delivery||"Не указан"}</b></span>
            </div>
            <div className="catalogObjectDeveloper">{item.developerName||"Застройщик не указан"}</div>
          </div>
        </button>)}</div>:
        <div className="emptyState"><PackageOpen size={26}/><strong>Объекты не найдены</strong><span>Измените фильтр или добавьте новый ЖК.</span></div>}

      <div className="catalogPager">
        <button disabled={page<=1||loading} onClick={()=>setPage(value=>Math.max(1,value-1))}><ChevronLeft size={16}/>Назад</button>
        <span>{page} / {totalPages}</span>
        <button disabled={!data.hasMore||loading} onClick={()=>setPage(value=>value+1)}>Дальше<ChevronRight size={16}/></button>
      </div>
    </section>

    {p&&<div className="drawerBackdrop"><section className="detailDrawer wideDrawer catalogEditor" role="dialog" aria-modal="true" aria-label="Редактор объекта" onClick={e=>e.stopPropagation()}>
      <div className="drawerHeader catalogDrawerHeader">
        <div><div className="catalogDrawerEyebrow"><span className={"statusChip "+p.status}>{p.status==="published"?"Опубликован":p.status==="draft"?"Черновик":"Архив"}</span><small>{p.id}</small></div><h2>{p.name}</h2></div>
        <button aria-label="Закрыть редактор" onClick={()=>setSelected(null)}><X/></button>
      </div>

      <div className="catalogReadiness">
        <div><span>Готовность карточки</span><b>{ready}%</b></div>
        <div><i style={{width:ready+"%"}}/></div>
        <small>{ready===100?"Основные данные заполнены — объект можно публиковать.":"Для публикации нужны обложка, цена, застройщик и срок сдачи."}</small>
      </div>

      <div className="editorStickyActions">
        <span>{dirty?"Есть несохранённые изменения":"Все изменения сохранены"}</span>
        <button className="primaryAction" disabled={!dirty||busy} onClick={()=>void save()}><Save size={15}/>{busy?"Сохраняем…":"Сохранить"}</button>
      </div>

      <section className="catalogEditorSection">
        <div className="catalogEditorSectionHead"><span><Building2 size={16}/></span><div><b>Основная информация</b><small>То, что формирует карточку и страницу ЖК</small></div></div>
        <div className="formGrid">
          {([["name","Название"],["city","Город"],["district","Район"],["address","Адрес"],["developerName","Застройщик"],["delivery","Срок сдачи"],["className","Класс"],["coverImageUrl","Обложка · URL"]] as const).map(([key,label])=><label key={key} className="controlField"><span>{label}</span><input value={(p as any)[key]||""} onChange={e=>patch({[key]:e.target.value||(["address","coverImageUrl"].includes(key)?null:"")} as any)}/></label>)}
          {([["priceFrom","Цена от, млн ₽"],["latitude","Широта"],["longitude","Долгота"],["sortOrder","Порядок"]] as const).map(([key,label])=><label key={key} className="controlField"><span>{label}</span><input type="number" step="any" value={(p as any)[key]??""} onChange={e=>patch({[key]:e.target.value===""&&["latitude","longitude"].includes(key)?null:Number(e.target.value)} as any)}/></label>)}
          <label className="controlField"><span>Статус</span><select value={p.status} onChange={e=>patch({status:e.target.value as PulseProperty["status"]})}><option value="draft">Черновик</option><option value="published">Опубликован</option><option value="archived">Архив</option></select></label>
          <label className="controlField"><span>Теги через запятую</span><input value={p.tags.join(", ")} onChange={e=>patch({tags:e.target.value.split(",").map(s=>s.trim()).filter(Boolean)})}/></label>
          <label className="controlField wide"><span>Описание</span><textarea rows={5} value={p.description} onChange={e=>patch({description:e.target.value})}/></label>
        </div>
      </section>

      <section className="catalogEditorSection">
        <div className="catalogEditorSectionHead"><span><Images size={16}/></span><div><b>Фото объекта</b><small>Обложка + галерея для страницы ЖК</small></div></div>
        <div className="mediaUploader">
          <div><h3>Обложка и галерея</h3><p>JPG, PNG или WebP до 15 МБ. Можно выделить сразу несколько фотографий.</p></div>
          <div className="mediaButtons">
            <label className="secondaryAction fileButton"><ImagePlus size={15}/>Обложка<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void upload(e.target.files,"cover")}/></label>
            <label className="secondaryAction fileButton"><Images size={15}/>Добавить фото<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>void upload(e.target.files,"gallery")}/></label>
          </div>
        </div>
        <div className="mediaGrid">
          {p.coverImageUrl&&<div className="mediaThumb coverThumb"><img src={p.coverImageUrl} alt=""/><span>Обложка</span></div>}
          {p.images.map((photo,index)=><div className="mediaThumb" key={photo.id||index}><img src={photo.url} alt=""/><button aria-label="Удалить фото" onClick={()=>photo.id&&photo.url.startsWith("/media/")?void removeMedia(photo.id,"gallery"):patch({images:p.images.filter((_,i)=>i!==index)})}><Trash2 size={14}/></button><span>Фото {index+1}</span></div>)}
        </div>
      </section>

      <section className="catalogEditorSection">
        <div className="catalogEditorSectionHead"><span><PackageOpen size={16}/></span><div><b>Планировки</b><small>Комнатность, площадь, цена и изображение</small></div><button onClick={()=>patch({floorplans:[...p.floorplans,{id:crypto.randomUUID(),roomLabel:"1",areaFrom:null,areaTo:null,priceFrom:null,imageUrl:null,sortOrder:p.floorplans.length}]})}><Plus size={15}/>Добавить</button></div>
        <div className="catalogEditorStack">{p.floorplans.map((plan,i)=><div className="editorRow floorplanEditor" key={plan.id||i}>
          <div className="formGrid">
            {([["roomLabel","Комнатность"],["areaFrom","Площадь от, м²"],["areaTo","Площадь до, м²"],["priceFrom","Цена от, млн ₽"],["imageUrl","Изображение · URL"]] as const).map(([key,label])=><label className="controlField" key={key}><span>{label}</span><input type={["roomLabel","imageUrl"].includes(key)?"text":"number"} step="any" value={(plan as any)[key]??""} onChange={e=>patch({floorplans:p.floorplans.map((x,j)=>j!==i?x:{...x,[key]:["roomLabel","imageUrl"].includes(key)?e.target.value||null:e.target.value===""?null:Number(e.target.value)})})}/></label>)}
          </div>
          <div className="rowActions">
            <label className="secondaryAction fileButton"><Upload size={14}/>Фото планировки<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void uploadFloorplan(e.target.files?.[0],plan.id)}/></label>
            {plan.imageUrl&&plan.id&&plan.imageUrl.startsWith("/media/")&&<button className="textDanger" onClick={()=>void removeMedia(plan.id,"floorplan")}>Удалить фото</button>}
            <button className="textDanger" onClick={()=>patch({floorplans:p.floorplans.filter((_,j)=>i!==j)})}>Удалить планировку</button>
          </div>
        </div>)}
        {!p.floorplans.length&&<div className="catalogEditorEmpty">Планировок пока нет. Добавьте первую вручную или импортируйте CSV.</div>}
        </div>
      </section>

      <section className="catalogEditorSection">
        <div className="catalogEditorSectionHead"><span><CheckCircle2 size={16}/></span><div><b>Особенности</b><small>Преимущества ЖК для карточки и PULSE Select</small></div><button onClick={()=>patch({features:[...p.features,{id:crypto.randomUUID(),label:"",icon:"building",sortOrder:p.features.length}]})}><Plus size={15}/>Добавить</button></div>
        <div className="catalogEditorStack">{p.features.map((feature,i)=><div className="inlineEditor" key={feature.id||i}><input aria-label="Особенность" value={feature.label} onChange={e=>patch({features:p.features.map((x,j)=>i===j?{...x,label:e.target.value}:x)})}/><select value={feature.icon} aria-label="Иконка особенности" onChange={e=>patch({features:p.features.map((x,j)=>i===j?{...x,icon:e.target.value}:x)})}>{[["building","Дом"],["waves","Море"],["trees","Парк"],["car","Парковка"],["baby","Дети"],["map-pin","Расположение"]].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button aria-label="Удалить особенность" onClick={()=>patch({features:p.features.filter((_,j)=>i!==j)})}><X size={16}/></button></div>)}
        {!p.features.length&&<div className="catalogEditorEmpty">Добавьте преимущества: море, двор, парковка, инфраструктура и другие.</div>}
        </div>
      </section>

      <section className="catalogEditorSection">
        <div className="catalogEditorSectionHead"><span><FileText size={16}/></span><div><b>Презентации и документы</b><small>PDF до 50 МБ — хранится рядом с объектом</small></div></div>
        <div className="mediaUploader documentUploader">
          <div><h3>Материалы ЖК</h3><p>Можно хранить несколько презентаций и рабочих документов.</p></div>
          <label className="secondaryAction fileButton"><FileText size={15}/>Загрузить PDF<input type="file" accept="application/pdf" multiple onChange={e=>void upload(e.target.files,"presentation")}/></label>
        </div>
        <div className="documentList">{(p.documents??[]).map(doc=><div key={doc.id||doc.url}><FileText size={17}/><span><b>{doc.name}</b><small>{doc.mimeType||"PDF"}{doc.sizeBytes?" · "+Math.round(doc.sizeBytes/1024/1024*10)/10+" МБ":""}</small></span><a href={doc.url} target="_blank" rel="noreferrer">Открыть</a>{doc.id&&<button aria-label="Удалить документ" onClick={()=>void removeMedia(doc.id,doc.kind)}><Trash2 size={14}/></button>}</div>)}</div>
        {!p.documents?.length&&<div className="catalogEditorEmpty">Презентаций пока нет.</div>}
      </section>

      <div className="catalogEditorFooter"><div><HardDrive size={15}/><span>PostgreSQL + media volume</span></div><button className="primaryAction" disabled={!dirty||busy} onClick={()=>void save()}><Save size={16}/>Сохранить объект</button></div>
    </section></div>}
  </PageFrame>;
}
