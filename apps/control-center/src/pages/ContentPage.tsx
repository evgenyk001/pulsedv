import React from "react";
import { ArrowDown, ArrowUp, Copy, ExternalLink, Gift, Handshake, ImageUp, Megaphone, Plus, Trash2 } from "lucide-react";
import { PageFrame } from "../components/PageFrame";
import { usePulseEvents, usePulseState } from "../data";
import { updatePulseState, type PulseBanner, type PulseBannerKind } from "../../../../packages/pulse-data";
import { api, runtime } from "../../../../packages/pulse-data/runtime";

const kinds:Record<PulseBannerKind,{label:string;hint:string}>={
  promo:{label:"Промо",hint:"Собственные услуги и продукты PULSE.DV"},
  giveaway:{label:"Розыгрыш",hint:"Конкурсы, подарки и специальные механики"},
  partner:{label:"Партнёр",hint:"Реклама и предложения сторонних компаний"},
};

const vlInput=(value:string|null|undefined)=>{
  if(!value)return "";
  const shifted=new Date(Date.parse(value)+10*60*60*1000);
  return Number.isFinite(shifted.getTime())?shifted.toISOString().slice(0,16):"";
};
const vlIso=(value:string)=>value?new Date(value+":00+10:00").toISOString():null;

const bannerStatus=(banner:PulseBanner)=>{
  if(!banner.enabled)return {label:"Выключен",className:"off"};
  const now=Date.now();
  if(banner.startsAt&&Date.parse(banner.startsAt)>now)return {label:"Запланирован",className:"scheduled"};
  if(banner.endsAt&&Date.parse(banner.endsAt)<=now)return {label:"Завершён",className:"ended"};
  return {label:"Показывается",className:"live"};
};

const fileDataUrl=(file:File)=>new Promise<string>((resolve,reject)=>{
  const reader=new FileReader();
  reader.onerror=()=>reject(new Error("Не удалось прочитать изображение"));
  reader.onload=()=>resolve(String(reader.result||""));
  reader.readAsDataURL(file);
});

export function ContentPage(){
  const state=usePulseState();
  const events=usePulseEvents();
  const [uploading,setUploading]=React.useState<string|null>(null);
  const [error,setError]=React.useState("");

  const setBanners=(updater:(items:PulseBanner[])=>PulseBanner[])=>updatePulseState(current=>({
    ...current,banners:updater(current.banners)
  }));
  const patchBanner=(id:string,patch:Partial<PulseBanner>)=>setBanners(items=>items.map(item=>item.id===id?{...item,...patch}:item));
  const patchContent=(patch:Partial<typeof state.content>)=>updatePulseState(current=>({...current,content:{...current.content,...patch}}));

  const addBanner=()=>{
    const max=Math.max(0,...state.banners.map(item=>item.sortOrder));
    const banner:PulseBanner={
      id:"banner-"+crypto.randomUUID(),title:"Новый баннер",body:"",imageUrl:null,ctaLabel:"Подробнее",
      actionUrl:"/catalog",city:null,audience:null,enabled:false,sortOrder:max+1,
      kind:"promo",eyebrow:"PULSE.DV",startsAt:null,endsAt:null,
    };
    setBanners(items=>[...items,banner]);
  };

  const duplicate=(source:PulseBanner)=>{
    const max=Math.max(0,...state.banners.map(item=>item.sortOrder));
    setBanners(items=>[...items,{...source,id:"banner-"+crypto.randomUUID(),title:source.title+" — копия",enabled:false,sortOrder:max+1}]);
  };

  const remove=(banner:PulseBanner)=>{
    if(!window.confirm('Удалить баннер «'+banner.title+'»? Изменение применится после сохранения.'))return;
    setBanners(items=>items.filter(item=>item.id!==banner.id).sort((a,b)=>a.sortOrder-b.sortOrder).map((item,index)=>({...item,sortOrder:index+1})));
  };

  const move=(id:string,direction:-1|1)=>{
    setBanners(items=>{
      const sorted=[...items].sort((a,b)=>a.sortOrder-b.sortOrder);
      const index=sorted.findIndex(item=>item.id===id);
      const target=index+direction;
      if(index<0||target<0||target>=sorted.length)return items;
      [sorted[index],sorted[target]]=[sorted[target],sorted[index]];
      return sorted.map((item,i)=>({...item,sortOrder:i+1}));
    });
  };

  const upload=async(banner:PulseBanner,file:File|undefined)=>{
    if(!file)return;
    setError("");
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)){setError("Для баннера можно загрузить JPG, PNG или WebP.");return}
    if(file.size>15*1024*1024){setError("Изображение должно быть меньше 15 МБ.");return}
    setUploading(banner.id);
    try{
      let imageUrl:string;
      if(runtime.enabled){
        const result=await api<{imageUrl:string}>("/control/content/banner-media?filename="+encodeURIComponent(file.name.slice(0,180)),{method:"POST",headers:{"Content-Type":file.type},body:file});
        imageUrl=result.imageUrl;
      }else{
        if(file.size>1_500_000)throw new Error("В демо загрузите изображение до 1,5 МБ. На сервере лимит — 15 МБ.");
        imageUrl=await fileDataUrl(file);
      }
      patchBanner(banner.id,{imageUrl});
    }catch(err){setError(err instanceof Error?err.message:"Не удалось загрузить изображение")}
    finally{setUploading(null)}
  };

  const applyActionPreset=(banner:PulseBanner,value:string)=>{
    if(value==="none")patchBanner(banner.id,{actionUrl:null});
    else if(value==="external")patchBanner(banner.id,{actionUrl:"https://"});
    else if(value==="property"){
      const property=state.properties.find(item=>item.status==="published")||state.properties[0];
      patchBanner(banner.id,{actionUrl:property?"/property/"+property.id:"/catalog"});
    }else if(value==="custom")patchBanner(banner.id,{actionUrl:"/"});
    else patchBanner(banner.id,{actionUrl:value});
  };

  const actionPreset=(banner:PulseBanner)=>{
    const url=banner.actionUrl||"";
    if(!url)return "none";
    if(url.startsWith("/property/"))return "property";
    if(["/catalog","/selection","/mortgage","/journey"].includes(url))return url;
    if(url.startsWith("https://"))return "external";
    return "custom";
  };

  const metrics=(id:string)=>{
    const impressions=events.filter(event=>event.eventType==="banner_impression"&&event.entityId===id).length;
    const clicks=events.filter(event=>event.eventType==="banner_click"&&event.entityId===id).length;
    return {impressions,clicks,ctr:impressions?Math.round(clicks/impressions*1000)/10:0};
  };

  const banners=[...state.banners].sort((a,b)=>a.sortOrder-b.sortOrder);

  return <PageFrame eyebrow="CONTENT" title="Контент" description="Промо, розыгрыши и партнёрские размещения на главной Mini App — без правок клиентского кода.">
    <section className="panel">
      <div className="panelTitle"><div><span>Onboarding</span><h2>Управление показом</h2></div></div>
      <div className="formGrid">
        <label className="controlField"><span>Версия</span><input value={state.content.onboardingVersion} onChange={e=>patchContent({onboardingVersion:e.target.value})}/></label>
        <label className="switchControl"><span><b>Показывать onboarding</b><small>Смена версии покажет его пользователям заново.</small></span><input type="checkbox" checked={state.content.onboardingEnabled} onChange={e=>patchContent({onboardingEnabled:e.target.checked})}/></label>
      </div>
    </section>

    <section className="panel bannerManager">
      <div className="bannerManagerHead">
        <div><span className="kicker">Баннеры главной</span><h2>Кампании</h2><p>Создавайте собственные промо, розыгрыши и партнёрскую рекламу. Можно выключить, запланировать и привязать любое действие.</p></div>
        <button className="primaryAction" type="button" onClick={addBanner}><Plus size={16}/>Новый баннер</button>
      </div>
      {error&&<div className="errorNotice" role="alert">{error}</div>}
      {!banners.length&&<div className="emptyState"><strong>Баннеров пока нет</strong><span>Создайте первую кампанию — она появится на главной после включения и сохранения.</span><button className="primaryAction" type="button" onClick={addBanner}><Plus size={16}/>Создать баннер</button></div>}
      <div className="bannerCampaignList">
        {banners.map((banner,index)=>{
          const status=bannerStatus(banner);
          const stats=metrics(banner.id);
          const preset=actionPreset(banner);
          const kind=banner.kind||"promo";
          return <article className="bannerCampaignCard" key={banner.id}>
            <div className="bannerCampaignToolbar">
              <div className="bannerCampaignIdentity">
                <span className={"campaignStatus "+status.className}>{status.label}</span>
                <span className="campaignType">{kind==="giveaway"?<Gift size={13}/>:kind==="partner"?<Handshake size={13}/>:<Megaphone size={13}/>} {kinds[kind].label}</span>
                <small>#{index+1}</small>
              </div>
              <div className="bannerCampaignActions">
                <button type="button" aria-label="Переместить выше" disabled={index===0} onClick={()=>move(banner.id,-1)}><ArrowUp size={16}/></button>
                <button type="button" aria-label="Переместить ниже" disabled={index===banners.length-1} onClick={()=>move(banner.id,1)}><ArrowDown size={16}/></button>
                <button type="button" aria-label="Дублировать баннер" onClick={()=>duplicate(banner)}><Copy size={16}/></button>
                <button className="dangerIcon" type="button" aria-label="Удалить баннер" onClick={()=>remove(banner)}><Trash2 size={16}/></button>
              </div>
            </div>

            <div className="bannerCampaignGrid">
              <div className="bannerCampaignEditor">
                <div className="formGrid">
                  <label className="controlField"><span>Тип кампании</span><select value={kind} onChange={e=>patchBanner(banner.id,{kind:e.target.value as PulseBannerKind})}><option value="promo">Промо PULSE.DV</option><option value="giveaway">Розыгрыш</option><option value="partner">Партнёрская реклама</option></select><small>{kinds[kind].hint}</small></label>
                  <label className="switchControl"><span><b>Показывать баннер</b><small>Выключенный баннер остаётся в системе.</small></span><input aria-label={"Показывать "+banner.title} type="checkbox" checked={banner.enabled} onChange={e=>patchBanner(banner.id,{enabled:e.target.checked})}/></label>
                  <label className="controlField wide"><span>Метка над заголовком</span><input value={banner.eyebrow??banner.city??""} maxLength={120} placeholder={kind==="partner"?"Партнёр PULSE.DV":kind==="giveaway"?"Розыгрыш":"PULSE.DV"} onChange={e=>patchBanner(banner.id,{eyebrow:e.target.value||null,city:null})}/></label>
                  <label className="controlField wide"><span>Заголовок</span><input value={banner.title} maxLength={250} onChange={e=>patchBanner(banner.id,{title:e.target.value})}/></label>
                  <label className="controlField wide"><span>Описание</span><textarea rows={3} value={banner.body} maxLength={1000} onChange={e=>patchBanner(banner.id,{body:e.target.value})}/></label>
                </div>

                <div className="bannerMediaRow">
                  <div><b>Изображение</b><small>JPG, PNG или WebP · до 15 МБ. Лучше горизонтальное 16:9 или шире.</small></div>
                  <label className="secondaryAction bannerUpload"><ImageUp size={15}/>{uploading===banner.id?"Загрузка…":banner.imageUrl?"Заменить":"Загрузить"}<input disabled={uploading===banner.id} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{void upload(banner,e.target.files?.[0]);e.currentTarget.value=""}}/></label>
                </div>
                {banner.imageUrl&&<label className="controlField"><span>URL изображения</span><input value={banner.imageUrl} onChange={e=>patchBanner(banner.id,{imageUrl:e.target.value||null})}/></label>}

                <div className="bannerActionBox">
                  <div className="bannerSectionTitle"><ExternalLink size={16}/><div><b>Действие по нажатию</b><small>Весь баннер кликабелен. Если действие отключено, кнопка в баннере не показывается.</small></div></div>
                  <div className="formGrid">
                    <label className="controlField"><span>Куда ведёт</span><select value={preset} onChange={e=>applyActionPreset(banner,e.target.value)}><option value="/catalog">Каталог</option><option value="/selection">PULSE Select</option><option value="/mortgage">Ипотека</option><option value="/journey">Мои подборки и показы</option><option value="property">Конкретный ЖК</option><option value="external">Внешний сайт HTTPS</option><option value="custom">Другой экран Mini App</option><option value="none">Без перехода</option></select></label>
                    <label className="controlField"><span>Текст кнопки</span><input value={banner.ctaLabel||""} disabled={!banner.actionUrl} maxLength={100} onChange={e=>patchBanner(banner.id,{ctaLabel:e.target.value||null})}/></label>
                    {preset==="property"&&<label className="controlField wide"><span>Жилой комплекс</span><select value={(banner.actionUrl||"").replace("/property/","")} onChange={e=>patchBanner(banner.id,{actionUrl:"/property/"+e.target.value})}>{state.properties.filter(item=>item.status==="published").map(property=><option key={property.id} value={property.id}>{property.name}</option>)}</select></label>}
                    {(preset==="external"||preset==="custom")&&<label className="controlField wide"><span>{preset==="external"?"HTTPS-ссылка":"Внутренний путь"}</span><input value={banner.actionUrl||""} placeholder={preset==="external"?"https://example.com":"/catalog?city=Владивосток"} onChange={e=>patchBanner(banner.id,{actionUrl:e.target.value||null})}/></label>}
                  </div>
                </div>

                <div className="bannerSchedule">
                  <div className="bannerSectionTitle"><div><b>Расписание</b><small>Пустые даты означают показ без ограничения по времени. Часовой пояс — Владивосток.</small></div></div>
                  <div className="formGrid">
                    <label className="controlField"><span>Начать показ</span><input type="datetime-local" value={vlInput(banner.startsAt)} onChange={e=>patchBanner(banner.id,{startsAt:vlIso(e.target.value)})}/></label>
                    <label className="controlField"><span>Закончить показ</span><input type="datetime-local" value={vlInput(banner.endsAt)} onChange={e=>patchBanner(banner.id,{endsAt:vlIso(e.target.value)})}/></label>
                  </div>
                </div>
              </div>

              <aside className="bannerCampaignSide">
                <div className="bannerPreview" aria-label={"Предпросмотр "+banner.title}>
                  {banner.imageUrl?<img src={banner.imageUrl} alt=""/>:<div className="bannerPreviewPlaceholder"><ImageUp size={30}/><span>Загрузите изображение</span></div>}
                  <div className="bannerPreviewShade"/>
                  <div className="bannerPreviewContent"><small>{banner.eyebrow||banner.city||banner.audience||(kind==="partner"?"Партнёр PULSE.DV":kind==="giveaway"?"Розыгрыш":"PULSE.DV")}</small><h3>{banner.title||"Заголовок баннера"}</h3><p>{banner.body||"Короткое описание предложения."}</p>{banner.actionUrl&&<span>{banner.ctaLabel||"Подробнее"} <ExternalLink size={13}/></span>}</div>
                </div>
                <div className="bannerStats"><div><span>Показы</span><b>{stats.impressions}</b></div><div><span>Клики</span><b>{stats.clicks}</b></div><div><span>CTR</span><b>{stats.ctr}%</b></div></div>
                <small className="bannerStatsNote">Статистика считается по событиям Mini App. В боевом режиме данные поступают с устройств пользователей.</small>
              </aside>
            </div>
          </article>
        })}
      </div>
    </section>
  </PageFrame>;
}
