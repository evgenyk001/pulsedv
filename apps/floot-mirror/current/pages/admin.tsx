import React from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, LogOut, ChevronRight, ImagePlus, Save, Eye, EyeOff, ArrowLeft, MapPin, CheckCircle2, Trash2, LayoutDashboard, UsersRound, Handshake, Home, BadgePercent, Images, Database, ChartNoAxesCombined, Settings2 } from "lucide-react";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { Switch } from "../components/Switch";
import { FileDropzone } from "../components/FileDropzone";
import { AdminLocationPicker } from "../components/AdminLocationPicker";
import { getAdminProperties } from "../endpoints/admin/properties_GET.schema";
import { postAdminProperty, type InputType } from "../endpoints/admin/properties_POST.schema";
import { postPropertyUpload } from "../endpoints/admin/property_upload_POST.schema";
import { getAdminLeads } from "../endpoints/admin/leads_GET.schema";
import { postLeadPipeline } from "../endpoints/admin/lead_pipeline_POST.schema";
import { getAdminBanners, postAdminBanner, type AdminPromoBanner, type SaveInputType as BannerInputType } from "../endpoints/admin/banners_GET.schema";
import { getControlCenter } from "../endpoints/admin/control_center_GET.schema";
import { useAuth } from "../helpers/useAuth";
import { PropertyRecord } from "../helpers/propertyTypes";
import { PROPERTIES_QUERY_KEY } from "../helpers/useProperties";
import styles from "./admin.module.css";

const emptyProperty:InputType={
  id:"",
  name:"",
  city:"Владивосток",
  district:"",
  address:"",
  latitude:null,
  longitude:null,
  priceFrom:0,
  delivery:"",
  className:"Комфорт",
  status:"draft",
  description:"",
  developerName:"",
  tags:[],
  coverImageUrl:null,
  sortOrder:100,
  images:[],
  features:[],
  floorplans:[],
};

const emptyBanner:BannerInputType={
  id:null,
  title:"",
  body:"",
  ctaLabel:"Подробнее",
  actionUrl:"/catalog",
  imageUrl:null,
  sortOrder:100,
  isActive:true,
  startsAt:null,
  endsAt:null,
  audience:"all",
  city:null,
};

const fromRecord=(p:PropertyRecord):InputType=>({
  id:p.id,
  name:p.name,
  city:p.city,
  district:p.district,
  address:p.address,
  latitude:p.latitude,
  longitude:p.longitude,
  priceFrom:p.priceFrom,
  delivery:p.delivery,
  className:p.className,
  status:p.status,
  description:p.description,
  developerName:p.developerName,
  tags:p.tags,
  coverImageUrl:p.coverImageUrl,
  sortOrder:p.sortOrder,
  images:p.images.length
    ?p.images.map(x=>({url:x.url,alt:x.alt,sortOrder:x.sortOrder}))
    :(p.coverImageUrl?[{url:p.coverImageUrl,alt:p.name,sortOrder:0}]:[]),
  features:p.features.map(x=>({label:x.label,icon:x.icon,sortOrder:x.sortOrder})),
  floorplans:p.floorplans.map(x=>({
    roomLabel:x.roomLabel,
    areaFrom:x.areaFrom,
    areaTo:x.areaTo,
    priceFrom:x.priceFrom,
    imageUrl:x.imageUrl,
    sortOrder:x.sortOrder
  })),
});

const toLocalDateTime=(value:Date|null)=>value?new Date(value).toISOString().slice(0,16):null;
const bannerFromRecord=(banner:AdminPromoBanner):BannerInputType=>({
  id:banner.id,
  title:banner.title,
  body:banner.body,
  ctaLabel:banner.ctaLabel,
  actionUrl:banner.actionUrl,
  imageUrl:banner.imageUrl,
  sortOrder:banner.sortOrder,
  isActive:banner.isActive,
  startsAt:toLocalDateTime(banner.startsAt),
  endsAt:toLocalDateTime(banner.endsAt),
  audience:banner.audience,
  city:banner.city,
});

export default function AdminPage(){
  const queryClient=useQueryClient();
  const {logout}=useAuth();
  const {data=[],isLoading,error,refetch}=useQuery({
    queryKey:["admin-properties"],
    queryFn:async()=>(await getAdminProperties()).properties,
  });
  const {data:leads=[]}=useQuery({
    queryKey:["admin-leads"],
    queryFn:async()=>(await getAdminLeads()).leads,
  });
  const {data:banners=[]}=useQuery({
    queryKey:["admin-banners"],
    queryFn:async()=>(await getAdminBanners()).banners,
  });
  const {data:control}=useQuery({queryKey:["control-center"],queryFn:getControlCenter});
  const [editing,setEditing]=React.useState<InputType|null>(null);
  const [saving,setSaving]=React.useState(false);
  const [uploading,setUploading]=React.useState(false);
  const [message,setMessage]=React.useState<string|null>(null);
  const [tagsText,setTagsText]=React.useState("");
  const [featuresText,setFeaturesText]=React.useState("");
  const [adminSection,setAdminSection]=React.useState("Dashboard");
  const [leadSearch,setLeadSearch]=React.useState("");
  const [selectedLeadId,setSelectedLeadId]=React.useState<string|null>(null);
  const [leadStageSaving,setLeadStageSaving]=React.useState(false);
  const [editingBanner,setEditingBanner]=React.useState<BannerInputType|null>(null);
  const [bannerSaving,setBannerSaving]=React.useState(false);
  const [bannerUploading,setBannerUploading]=React.useState(false);

  const startEdit=(property?:PropertyRecord)=>{
    const next=property?fromRecord(property):{...emptyProperty};
    setEditing(next);
    setTagsText(next.tags.join(", "));
    setFeaturesText(next.features.map(x=>x.label).join(", "));
    setMessage(null);
    window.scrollTo({top:0,behavior:"smooth"});
  };

  const update=<K extends keyof InputType>(key:K,value:InputType[K])=>{
    setEditing(prev=>prev?{...prev,[key]:value}:prev);
  };

  const uploadFiles=async(files:File[])=>{
    if(!editing?.id){
      setMessage("Сначала задайте ID объекта, например: more-vladivostok");
      return;
    }
    setUploading(true);
    setMessage(null);
    try{
      const uploaded:InputType["images"]=[];
      for(const file of files){
        const prep=await postPropertyUpload({
          propertyId:editing.id,
          fileName:file.name,
          contentType:file.type as any,
          sizeBytes:file.size,
        });
        const put=await fetch(prep.presignedUrl,{method:"PUT",headers:{"Content-Type":file.type},body:file});
        if(!put.ok)throw new Error(`Не удалось загрузить ${file.name}`);
        uploaded.push({url:prep.url,alt:editing.name||file.name,sortOrder:editing.images.length+uploaded.length});
      }
      setEditing(prev=>prev?{
        ...prev,
        images:[...prev.images,...uploaded],
        coverImageUrl:prev.coverImageUrl||uploaded[0]?.url||null,
      }:prev);
    }catch(err){
      setMessage(err instanceof Error?err.message:"Ошибка загрузки фото");
    }finally{
      setUploading(false);
    }
  };

  const save=async()=>{
    if(!editing)return;
    setSaving(true);
    setMessage(null);
    try{
      const normalized:InputType={
        ...editing,
        tags:tagsText.split(",").map(x=>x.trim()).filter(Boolean),
        features:featuresText.split(",").map((label,index)=>{
          const clean=label.trim();
          const existing=editing.features.find(x=>x.label.toLowerCase()===clean.toLowerCase());
          const lower=clean.toLowerCase();
          const icon=existing?.icon
            ??(lower.includes("мор")?"waves"
              :lower.includes("дет")?"baby"
                :lower.includes("парк")||lower.includes("двор")||lower.includes("зел")?"trees"
                  :lower.includes("маш")||lower.includes("паркин")?"car"
                    :lower.includes("центр")||lower.includes("адрес")?"map-pin"
                      :"sparkles");
          return {label:clean,icon,sortOrder:index*10};
        }).filter(x=>x.label),
      };
      const result=await postAdminProperty(normalized);
      setEditing(fromRecord(result.property));
      setTagsText(result.property.tags.join(", "));
      setFeaturesText(result.property.features.map(x=>x.label).join(", "));
      await Promise.all([
        queryClient.invalidateQueries({queryKey:["admin-properties"]}),
        queryClient.invalidateQueries({queryKey:PROPERTIES_QUERY_KEY}),
      ]);
      setMessage("Объект сохранён");
    }catch(err){
      setMessage(err instanceof Error?err.message:"Не удалось сохранить объект");
    }finally{
      setSaving(false);
    }
  };

  const startBannerEdit=(banner?:AdminPromoBanner)=>{
    setEditingBanner(banner?bannerFromRecord(banner):{...emptyBanner});
    setMessage(null);
    window.scrollTo({top:0,behavior:"smooth"});
  };

  const updateBanner=<K extends keyof BannerInputType>(key:K,value:BannerInputType[K])=>{
    setEditingBanner(prev=>prev?{...prev,[key]:value}:prev);
  };

  const uploadBannerFiles=async(files:File[])=>{
    const file=files[0];
    if(!file||!editingBanner)return;
    setBannerUploading(true);
    try{
      const prep=await postPropertyUpload({
        propertyId:"promo-banners",
        fileName:file.name,
        contentType:file.type as any,
        sizeBytes:file.size,
      });
      const put=await fetch(prep.presignedUrl,{method:"PUT",headers:{"Content-Type":file.type},body:file});
      if(!put.ok)throw new Error("Не удалось загрузить изображение баннера");
      updateBanner("imageUrl",prep.url);
    }catch(err){
      setMessage(err instanceof Error?err.message:"Ошибка загрузки баннера");
    }finally{
      setBannerUploading(false);
    }
  };

  const saveBanner=async()=>{
    if(!editingBanner)return;
    setBannerSaving(true);
    setMessage(null);
    try{
      const result=await postAdminBanner(editingBanner);
      setEditingBanner(bannerFromRecord(result.banner));
      await Promise.all([
        queryClient.invalidateQueries({queryKey:["admin-banners"]}),
        queryClient.invalidateQueries({queryKey:["promo-banners"]}),
        queryClient.invalidateQueries({queryKey:["control-center"]}),
      ]);
      setMessage("Баннер сохранён");
    }catch(err){
      setMessage(err instanceof Error?err.message:"Не удалось сохранить баннер");
    }finally{
      setBannerSaving(false);
    }
  };

  const updateLeadStage=async(status:"new"|"qualified"|"selection_sent"|"interested"|"meeting"|"booking"|"deal"|"lost")=>{
    if(!selectedLead)return;
    setLeadStageSaving(true);
    try{
      await postLeadPipeline({leadId:selectedLead.id,status});
      await Promise.all([
        queryClient.invalidateQueries({queryKey:["admin-leads"]}),
        queryClient.invalidateQueries({queryKey:["control-center"]}),
      ]);
      (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
    }catch(err){
      setMessage(err instanceof Error?err.message:"Не удалось обновить этап лида");
    }finally{
      setLeadStageSaving(false);
    }
  };

  const normalizedLeadSearch=leadSearch.trim().toLowerCase();
  const filteredLeads=normalizedLeadSearch
    ?leads.filter(lead=>[lead.name,lead.phone,lead.source,lead.propertyName||"",lead.qualificationLabel||"",lead.pipelineStatus].join(" ").toLowerCase().includes(normalizedLeadSearch))
    :leads;
  const selectedLead=leads.find(lead=>lead.id===selectedLeadId)??filteredLeads[0]??null;
  const pipelineStages=["new","qualified","selection_sent","interested","meeting","booking","deal","lost"] as const;
  const pipelineLabels:Record<string,string>={new:"Новый",qualified:"Квалифицирован",selection_sent:"Подборка отправлена",interested:"Заинтересован",meeting:"Встреча",booking:"Бронь",deal:"Сделка",lost:"Потерян"};

  return <main className={styles.page}>
    <header className={styles.header}>
      <div>
        <span>PULSE.DV workspace</span>
        <h1>База объектов</h1>
        <p>Добавление, публикация и обновление новостроек.</p>
      </div>
      <div className={styles.headerActions}>
        <Link to="/" aria-label="Открыть приложение"><ArrowLeft size={18}/></Link>
        <button onClick={()=>logout()} aria-label="Выйти"><LogOut size={18}/></button>
      </div>
    </header>
    <nav className={styles.controlNav} aria-label="PULSE Control Center">
      {[{icon:LayoutDashboard,label:"Dashboard"},{icon:UsersRound,label:"Лиды"},{icon:Handshake,label:"Сделки"},{icon:Building2,label:"Застройщики"},{icon:Home,label:"ЖК"},{icon:Database,label:"Квартиры"},{icon:BadgePercent,label:"Офферы"},{icon:Images,label:"Контент"},{icon:ChartNoAxesCombined,label:"Аналитика"},{icon:Settings2,label:"Настройки"}].map(({icon:Icon,label})=><button type="button" key={label} onClick={()=>setAdminSection(label)} className={adminSection===label?styles.controlNavActive:""}><Icon size={15}/>{label}</button>)}
    </nav>
    {!editing&&adminSection==="Лиды"&&<section className={styles.crmPanel}>
      <div className={styles.crmHead}><div><span>PULSE CRM</span><h2>Лиды</h2><p>Квалификация, источник, запрос и следующий шаг по каждому клиенту.</p></div><strong>{filteredLeads.length}</strong></div>
      <div className={styles.crmSearch}><Input value={leadSearch} onChange={e=>setLeadSearch(e.target.value)} placeholder="Имя, телефон, источник, статус"/></div>
      <div className={styles.crmLayout}>
        <div className={styles.crmList}>{filteredLeads.map(lead=><button type="button" key={lead.id} onClick={()=>setSelectedLeadId(lead.id)} className={selectedLead?.id===lead.id?styles.crmLeadActive:""}>
          <div className={styles.crmLeadTop}><strong>{lead.name}</strong><i>{pipelineLabels[lead.pipelineStatus]||lead.pipelineStatus}</i></div>
          <span>{lead.phone} · {lead.source}</span>
          <small>{lead.purchaseType||"Способ покупки не указан"}{lead.budgetMln!=null?" · до "+lead.budgetMln+" млн ₽":""}</small>
        </button>)}</div>
        <div className={styles.crmDetail}>{selectedLead?<><div className={styles.crmDetailHead}><div><span>{selectedLead.qualificationLabel||"Требует проверки"}</span><h3>{selectedLead.name}</h3><a href={"tel:"+selectedLead.phone}>{selectedLead.phone}</a></div><i>{pipelineLabels[selectedLead.pipelineStatus]||selectedLead.pipelineStatus}</i></div>
          <div className={styles.crmFacts}>
            <div><span>Покупка</span><b>{selectedLead.purchaseType||"—"}</b></div><div><span>Бюджет</span><b>{selectedLead.budgetMln!=null?selectedLead.budgetMln+" млн ₽":"—"}</b></div>
            <div><span>Первый взнос</span><b>{selectedLead.downPaymentMln!=null?selectedLead.downPaymentMln+" млн ₽":"—"}</b></div><div><span>Возраст</span><b>{selectedLead.borrowerAge??"—"}</b></div>
            <div><span>Гражданство РФ</span><b>{selectedLead.citizenshipRf==null?"—":selectedLead.citizenshipRf?"Да":"Нет"}</b></div><div><span>Семейное положение</span><b>{selectedLead.maritalStatus||"—"}</b></div>
            <div><span>Возраст супруга</span><b>{selectedLead.spouseAge??"—"}</b></div><div><span>Дети</span><b>{selectedLead.childrenProfile||"—"}</b></div>
            <div><span>Льготная ипотека ранее</span><b>{selectedLead.priorPreferentialMortgage||"—"}</b></div><div><span>Категория ДВ</span><b>{selectedLead.dvSpecialStatus||"—"}</b></div>
          </div>
          <div className={styles.crmNote}><span>Предварительная квалификация</span><p>{selectedLead.qualificationNote||"Комментарий квалификации пока не заполнен."}</p></div>
          <div className={styles.crmPrograms}><span>Программы</span><div>{selectedLead.mortgagePrograms.length?selectedLead.mortgagePrograms.map(x=><b key={x}>{x}</b>):<em>Не указаны</em>}</div></div>
          <div className={styles.crmStage}>
            <span>Этап воронки</span>
            <div>{pipelineStages.map(stage=><button type="button" key={stage} disabled={leadStageSaving} onClick={()=>updateLeadStage(stage)} className={selectedLead.pipelineStatus===stage?styles.crmStageActive:""}>{pipelineLabels[stage]}</button>)}</div>
          </div>
          <div className={styles.crmHistory}>
            <div className={styles.crmHistoryHead}><span>История</span><b>{selectedLead.history.length}</b></div>
            {selectedLead.history.length?selectedLead.history.slice(0,8).map(item=><div className={styles.crmHistoryRow} key={item.id}>
              <i/>
              <div><strong>{item.toStatus?pipelineLabels[item.toStatus]||item.toStatus:item.eventType}</strong><span>{item.note||"Изменение статуса"}</span></div>
              <time>{new Intl.DateTimeFormat("ru-RU",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(item.createdAt)}</time>
            </div>):<p className={styles.crmHistoryEmpty}>История появится после первого действия менеджера.</p>}
          </div>
        </>:<div className={styles.state}>Лидов пока нет.</div>}</div>
      </div>
    </section>}
    {!editing&&adminSection==="Сделки"&&<section className={styles.crmPanel}>
      <div className={styles.crmHead}><div><span>PULSE CRM</span><h2>Воронка сделок</h2><p>Живой обзор текущих этапов по клиентам.</p></div><strong>{leads.length}</strong></div>
      <div className={styles.pipelineBoard}>{pipelineStages.map(stage=><div className={styles.pipelineColumn} key={stage}><div className={styles.pipelineHead}><span>{pipelineLabels[stage]}</span><b>{leads.filter(x=>x.pipelineStatus===stage).length}</b></div>{leads.filter(x=>x.pipelineStatus===stage).map(lead=><button type="button" key={lead.id} onClick={()=>{setSelectedLeadId(lead.id);setAdminSection("Лиды")}}><strong>{lead.name}</strong><span>{lead.propertyName||"Общая консультация"}</span><small>{lead.budgetMln!=null?lead.budgetMln+" млн ₽":lead.phone}</small></button>)}</div>)}</div>
    </section>}
    {!editing&&adminSection==="Контент"&&<section className={styles.contentManager}>
      <div className={styles.contentHead}>
        <div><span>PULSE Content</span><h2>Баннеры и промо</h2><p>Управляйте тем, что пользователь видит на главной, без правки кода.</p></div>
        <button type="button" onClick={()=>startBannerEdit()}><Plus size={15}/>Новый баннер</button>
      </div>
      <div className={styles.contentLayout}>
        <div className={styles.bannerAdminList}>
          {banners.map(banner=><button type="button" key={banner.id} onClick={()=>startBannerEdit(banner)} className={editingBanner?.id===banner.id?styles.bannerAdminActive:""}>
            <div className={styles.bannerAdminThumb}>{banner.imageUrl?<img src={banner.imageUrl} alt=""/>:<Images size={18}/>}</div>
            <div><span>{banner.city||banner.audience||"Все пользователи"}</span><strong>{banner.title}</strong><small>{banner.isActive?"Активен":"Выключен"} · порядок {banner.sortOrder}</small></div>
            <ChevronRight size={15}/>
          </button>)}
          {banners.length===0&&<div className={styles.contentEmpty}>Баннеров в базе пока нет. Создайте первый — он сразу сможет появиться на главной.</div>}
        </div>
        <div className={styles.bannerEditor}>
          {editingBanner?<><div className={styles.bannerPreview}>
            {editingBanner.imageUrl?<img src={editingBanner.imageUrl} alt=""/>:<div className={styles.bannerPreviewPlaceholder}><Images size={24}/><span>Добавьте изображение</span></div>}
            <div className={styles.bannerPreviewShade}/>
            <div className={styles.bannerPreviewCopy}><small>{editingBanner.city||editingBanner.audience||"PULSE.DV"}</small><strong>{editingBanner.title||"Заголовок баннера"}</strong><span>{editingBanner.body||"Короткий текст предложения"}</span><b>{editingBanner.ctaLabel||"Подробнее"} →</b></div>
          </div>
          <div className={styles.bannerForm}>
            <label className={styles.full}><span>Заголовок</span><Input value={editingBanner.title} onChange={e=>updateBanner("title",e.target.value)} placeholder="Например: Скидка до 1,2 млн ₽"/></label>
            <label className={styles.full}><span>Текст</span><Textarea rows={3} value={editingBanner.body} onChange={e=>updateBanner("body",e.target.value)} disableResize/></label>
            <label><span>CTA</span><Input value={editingBanner.ctaLabel||""} onChange={e=>updateBanner("ctaLabel",e.target.value||null)} placeholder="Подробнее"/></label>
            <label><span>Ссылка / действие</span><Input value={editingBanner.actionUrl||""} onChange={e=>updateBanner("actionUrl",e.target.value||null)} placeholder="/catalog"/></label>
            <label><span>Город</span><Input value={editingBanner.city||""} onChange={e=>updateBanner("city",e.target.value||null)} placeholder="Все города"/></label>
            <label><span>Аудитория</span><Input value={editingBanner.audience} onChange={e=>updateBanner("audience",e.target.value)} placeholder="all"/></label>
            <label><span>Порядок</span><Input type="number" value={editingBanner.sortOrder} onChange={e=>updateBanner("sortOrder",Number(e.target.value)||0)}/></label>
            <div className={styles.bannerActiveRow}><span><strong>Показывать баннер</strong><small>Можно выключить без удаления</small></span><Switch checked={editingBanner.isActive} onCheckedChange={value=>updateBanner("isActive",value)}/></div>
            <label><span>Начало показа</span><Input type="datetime-local" value={editingBanner.startsAt||""} onChange={e=>updateBanner("startsAt",e.target.value||null)}/></label>
            <label><span>Окончание показа</span><Input type="datetime-local" value={editingBanner.endsAt||""} onChange={e=>updateBanner("endsAt",e.target.value||null)}/></label>
            <div className={styles.full}><FileDropzone accept="image/jpeg,image/png,image/webp" maxFiles={1} maxSize={20*1024*1024} onFilesSelected={uploadBannerFiles} disabled={bannerUploading} title={bannerUploading?"Загружаем…":"Загрузить изображение"} subtitle="JPG, PNG или WebP · до 20 МБ"/></div>
          </div>
          {message&&<div className={styles.message}>{message}</div>}
          <div className={styles.bannerEditorActions}><button type="button" className={styles.bannerCancel} onClick={()=>setEditingBanner(null)}>Закрыть</button><button type="button" className={styles.bannerSave} onClick={saveBanner} disabled={bannerSaving||bannerUploading}><Save size={15}/>{bannerSaving?"Сохраняем…":"Сохранить баннер"}</button></div>
          </>:<div className={styles.bannerEditorEmpty}><Images size={26}/><strong>Выберите баннер</strong><span>Или создайте новый, чтобы управлять промо на главной.</span><button type="button" onClick={()=>startBannerEdit()}><Plus size={15}/>Создать</button></div>}
        </div>
      </div>
    </section>}
    {!editing&&adminSection!=="Dashboard"&&adminSection!=="Лиды"&&adminSection!=="Сделки"&&adminSection!=="Контент"&&<section className={styles.modulePanel}><span>PULSE Control Center</span><h2>{adminSection}</h2><p>{adminSection==="Застройщики"?"Партнёры, контакты, условия сотрудничества и внутренние заметки.":adminSection==="ЖК"?"Управление жилыми комплексами и публикацией.":adminSection==="Квартиры"?"Корпуса, квартиры, цены, статусы и источники данных.":adminSection==="Офферы"?"Спецпредложения, сроки, приоритеты и PULSE.DV exclusive.":adminSection==="Аналитика"?"События и конверсия по этапам воронки.":"Роли команды, доступы и параметры платформы."}</p><button type="button" onClick={()=>adminSection==="ЖК"?startEdit():setAdminSection("Dashboard")}>{adminSection==="ЖК"?"Добавить / редактировать ЖК":"Вернуться на Dashboard"}</button></section>}
    {!editing&&adminSection==="Dashboard"&&control&&<section className={styles.dashboard}>
      <div className={styles.dashboardHead}><div><span>PULSE Control Center</span><h2>Операционный центр</h2></div><small>Данные платформы в реальном времени</small></div>
      <div className={styles.kpiGrid}>{[
        ["Лиды",control.kpi.leads],["Квалифицированы",control.kpi.qualified],["В работе",control.kpi.inWork],["Брони",control.kpi.bookings],["Сделки",control.kpi.deals],["Застройщики",control.kpi.developers],["ЖК",control.kpi.projects],["Квартиры",control.kpi.units]
      ].map(([label,value])=><div className={styles.kpi} key={String(label)}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <div className={styles.dashboardColumns}><div><span className={styles.miniTitle}>Воронка</span>{control.pipeline.length?control.pipeline.map(item=><div className={styles.miniRow} key={item.status}><span>{item.status}</span><b>{item.count}</b></div>):<p className={styles.miniEmpty}>Появится после первых лидов</p>}</div><div><span className={styles.miniTitle}>Партнёры</span>{control.developers.length?control.developers.map(item=><div className={styles.miniRow} key={item.id}><span>{item.name}</span><b>{item.status}</b></div>):<p className={styles.miniEmpty}>Добавьте первого застройщика</p>}</div></div>
    </section>}

    {editing?<section className={styles.editor}>
      <div className={styles.editorHead}>
        <div><span>{editing.id?"Редактор объекта":"Новый объект"}</span><h2>{editing.name||"Новая новостройка"}</h2></div>
        <button onClick={()=>setEditing(null)}>Закрыть</button>
      </div>

      <div className={styles.statusRow}>
        {(["draft","published","archived"] as const).map(status=><button key={status} className={editing.status===status?styles.statusActive:""} onClick={()=>update("status",status)}>
          {status==="published"?<Eye size={15}/>:<EyeOff size={15}/>}
          {status==="draft"?"Черновик":status==="published"?"Опубликован":"Архив"}
        </button>)}
      </div>

      <div className={styles.formGrid}>
        <label><span>ID / slug</span><Input value={editing.id} onChange={e=>update("id",e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"-"))} placeholder="more-vladivostok"/></label>
        <label><span>Название ЖК</span><Input value={editing.name} onChange={e=>update("name",e.target.value)} placeholder="ЖК Море"/></label>
        <label><span>Город</span><Input value={editing.city} onChange={e=>update("city",e.target.value)}/></label>
        <label><span>Район</span><Input value={editing.district} onChange={e=>update("district",e.target.value)}/></label>
        <label className={styles.full}><span>Адрес</span><Input value={editing.address||""} onChange={e=>update("address",e.target.value)} placeholder="Город, улица / ориентир"/></label>
        <label><span>Цена от, млн ₽</span><Input type="number" step=".1" value={editing.priceFrom||""} onChange={e=>update("priceFrom",Number(e.target.value))}/></label>
        <label><span>Срок сдачи</span><Input value={editing.delivery} onChange={e=>update("delivery",e.target.value)} placeholder="IV кв. 2027"/></label>
        <label><span>Класс</span><Input value={editing.className} onChange={e=>update("className",e.target.value)}/></label>
        <label><span>Застройщик</span><Input value={editing.developerName} onChange={e=>update("developerName",e.target.value)}/></label>
        <label><span>Широта</span><Input type="number" step=".000001" value={editing.latitude??""} onChange={e=>update("latitude",e.target.value?Number(e.target.value):null)}/></label>
        <label><span>Долгота</span><Input type="number" step=".000001" value={editing.longitude??""} onChange={e=>update("longitude",e.target.value?Number(e.target.value):null)}/></label>
        <div className={styles.full}><AdminLocationPicker latitude={editing.latitude} longitude={editing.longitude} onChange={(latitude,longitude)=>setEditing(prev=>prev?{...prev,latitude,longitude}:prev)}/></div>
        <label className={styles.full}><span>Теги через запятую</span><Input value={tagsText} onChange={e=>setTagsText(e.target.value)} placeholder="Вид на море, Старт продаж"/></label>
        <label className={styles.full}><span>Преимущества через запятую</span><Input value={featuresText} onChange={e=>setFeaturesText(e.target.value)} placeholder="Двор без машин, Паркинг, Набережная"/></label>
        <label className={styles.full}><span>Описание</span><Textarea rows={5} value={editing.description} onChange={e=>update("description",e.target.value)} disableResize/></label>
      </div>

      <div className={styles.photoBlock}>
        <div className={styles.blockHead}><div><ImagePlus size={18}/><span><strong>Фотографии</strong><small>Первое фото используется как обложка</small></span></div><b>{editing.images.length}</b></div>
        <FileDropzone accept="image/jpeg,image/png,image/webp" maxFiles={8} maxSize={20*1024*1024} onFilesSelected={uploadFiles} disabled={uploading} title={uploading?"Загружаем…":"Добавить фотографии"} subtitle="JPG, PNG или WebP · до 20 МБ"/>
        {editing.images.length>0&&<div className={styles.photoGrid}>{editing.images.map((image)=><div key={image.url} className={styles.photo}>
          <img src={image.url} alt={image.alt}/>
          <button className={styles.removePhoto} onClick={()=>setEditing(prev=>{
            if(!prev)return prev;
            const nextImages=prev.images.filter(x=>x.url!==image.url);
            return {...prev,images:nextImages,coverImageUrl:prev.coverImageUrl===image.url?(nextImages[0]?.url||null):prev.coverImageUrl};
          })} aria-label="Удалить фото"><Trash2 size={14}/></button>
          <button className={`${styles.coverPhoto} ${editing.coverImageUrl===image.url?styles.coverActive:""}`} onClick={()=>update("coverImageUrl",image.url)}>
            {editing.coverImageUrl===image.url?"Обложка":"На обложку"}
          </button>
        </div>)}</div>}
      </div>

      <div className={styles.planBlock}>
        <div className={styles.blockHead}>
          <div><Building2 size={18}/><span><strong>Планировки</strong><small>Комнаты, площади и цена от</small></span></div>
          <button className={styles.addPlan} onClick={()=>setEditing(prev=>prev?{...prev,floorplans:[...prev.floorplans,{roomLabel:"1-комн.",areaFrom:null,areaTo:null,priceFrom:null,imageUrl:null,sortOrder:prev.floorplans.length*10}]}:prev)}><Plus size={15}/>Добавить</button>
        </div>
        <div className={styles.planList}>{editing.floorplans.map((plan,index)=><div className={styles.planRow} key={index}>
          <Input value={plan.roomLabel} onChange={e=>setEditing(prev=>prev?{...prev,floorplans:prev.floorplans.map((x,i)=>i===index?{...x,roomLabel:e.target.value}:x)}:prev)} placeholder="1-комн."/>
          <Input type="number" step=".1" value={plan.areaFrom??""} onChange={e=>setEditing(prev=>prev?{...prev,floorplans:prev.floorplans.map((x,i)=>i===index?{...x,areaFrom:e.target.value?Number(e.target.value):null}:x)}:prev)} placeholder="м² от"/>
          <Input type="number" step=".1" value={plan.areaTo??""} onChange={e=>setEditing(prev=>prev?{...prev,floorplans:prev.floorplans.map((x,i)=>i===index?{...x,areaTo:e.target.value?Number(e.target.value):null}:x)}:prev)} placeholder="м² до"/>
          <Input type="number" step=".1" value={plan.priceFrom??""} onChange={e=>setEditing(prev=>prev?{...prev,floorplans:prev.floorplans.map((x,i)=>i===index?{...x,priceFrom:e.target.value?Number(e.target.value):null}:x)}:prev)} placeholder="млн ₽"/>
          <button className={styles.removePlan} onClick={()=>setEditing(prev=>prev?{...prev,floorplans:prev.floorplans.filter((_,i)=>i!==index)}:prev)} aria-label="Удалить планировку"><Trash2 size={15}/></button>
        </div>)}</div>
      </div>

      {message&&<div className={`${styles.message} ${message==="Объект сохранён"?styles.success:""}`}>{message==="Объект сохранён"&&<CheckCircle2 size={16}/>} {message}</div>}
      <button className={styles.save} onClick={save} disabled={saving||uploading}><Save size={18}/>{saving?"Сохраняем…":"Сохранить объект"}</button>
    </section>:adminSection==="ЖК"?<>
      <button className={styles.newButton} onClick={()=>startEdit()}><Plus size={18}/><span><strong>Добавить ЖК</strong><small>Создать проект и загрузить материалы</small></span><ChevronRight size={18}/></button>

      <section className={styles.listSection}>
        <div className={styles.sectionHead}><div><span>Жилые комплексы</span><strong>{data.length}</strong></div><button onClick={()=>refetch()}>Обновить</button></div>
        {isLoading&&<div className={styles.state}>Загружаем базу…</div>}
        {error&&<div className={styles.state}>Не удалось загрузить объекты.</div>}
        <div className={styles.list}>{data.map(property=><button key={property.id} className={styles.propertyRow} onClick={()=>startEdit(property)}>
          <div className={styles.thumb}>{property.coverImageUrl?<img src={property.coverImageUrl} alt=""/>:<Building2 size={20}/>}</div>
          <div className={styles.propertyText}><span>{property.city} · {property.district}</span><strong>{property.name}</strong><small><MapPin size={11}/>{property.address||"Адрес не указан"}</small></div>
          <div className={styles.propertyMeta}><b>от {property.priceFrom.toFixed(1).replace(".",",")} млн</b><i className={property.status==="published"?styles.live:property.status==="draft"?styles.draft:styles.archived}>{property.status==="published"?"В эфире":property.status==="draft"?"Черновик":"Архив"}</i></div>
          <ChevronRight size={17}/>
        </button>)}</div>
      </section>
    </>:null}
  </main>
}