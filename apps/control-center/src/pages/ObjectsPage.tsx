import {CatalogFreshnessEditor,CatalogFreshnessBadge} from '../components/CatalogFreshnessEditor';
import {needsCatalogReview} from '../../../../packages/pulse-data/business';
import React from 'react';
import {
  Archive,Building2,CheckCircle2,ChevronRight,Clock3,FileSpreadsheet,HardDrive,Images,
  MapPin,PackageOpen,Plus,Save,Search,X
} from 'lucide-react';
import { PageFrame } from '../components/PageFrame';
import { usePulseState } from '../data';
import { updatePulseState, type PulseProperty } from '../../../../packages/pulse-data';
import { runtime } from '../../../../packages/pulse-data/runtime';
import { ServerObjectsPage } from './ServerObjectsPage';

const fresh=():PulseProperty=>({
  id:crypto.randomUUID(),name:'Новый ЖК',city:'Владивосток',district:'',address:null,
  latitude:null,longitude:null,priceFrom:0,delivery:'',className:'',status:'draft',
  description:'',developerName:'',tags:[],coverImageUrl:null,sortOrder:999,
  images:[],features:[],floorplans:[],documents:[]
});
const formatPrice=(value:number)=>value?value.toFixed(1).replace('.',',')+' млн ₽':'Цена не указана';
const readiness=(property:PulseProperty)=>{
  const checks=[!!property.coverImageUrl,property.priceFrom>0,!!property.developerName.trim(),!!property.delivery.trim()];
  return Math.round(checks.filter(Boolean).length/checks.length*100);
};

function PreviewObjectsPage(){
  const state=usePulseState();
  const [selected,setSelected]=React.useState<string|null>(null);
  const [query,setQuery]=React.useState('');
  const [reviewOnly,setReviewOnly]=React.useState(false);
  const [status,setStatus]=React.useState<'all'|'published'|'draft'|'archived'>('all');
  const [notice,setNotice]=React.useState('');
  const p=state.properties.find(x=>x.id===selected);

  const patch=(change:Partial<PulseProperty>)=>updatePulseState(s=>({...s,properties:s.properties.map(x=>x.id===selected?{...x,...change}:x)}));
  const add=()=>{const property=fresh();updatePulseState(s=>({...s,properties:[...s.properties,property]}));setSelected(property.id);};
  const list=state.properties.filter(property=>{
    if(status!=='all'&&property.status!==status)return false;
    if(reviewOnly&&!needsCatalogReview(property.freshness))return false;
    return (property.name+' '+property.city+' '+property.developerName).toLowerCase().includes(query.toLowerCase());
  });
  const counts={
    all:state.properties.length,
    published:state.properties.filter(p=>p.status==='published').length,
    draft:state.properties.filter(p=>p.status==='draft').length,
    archived:state.properties.filter(p=>p.status==='archived').length,
  };

  const previewServerFeature=(name:string)=>{
    setNotice(name+' уже реализовано для VPS-режима. В GitHub preview реальные файлы и массовый импорт не отправляются на сервер.');
    window.setTimeout(()=>setNotice(''),4200);
  };

  return <PageFrame
    eyebrow="CATALOG ENGINE"
    title="Объекты"
    description="Единый центр каталога: одиночное редактирование, массовая загрузка, фото, планировки и презентации."
    action={<button className="primaryAction catalogPrimaryCreate" onClick={add}><Plus size={16}/>Добавить ЖК</button>}
  >
    {notice&&<div className="successNotice">{notice}</div>}

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
        <p>Этот блок уже подключён к серверному Catalog Engine. На VPS данные, фотографии и PDF будут загружаться сюда без GitHub.</p>
      </div>
      <div className="catalogImportActions">
        <button onClick={()=>previewServerFeature('Шаблоны CSV')}><span><FileSpreadsheet size={19}/></span><div><b>Шаблоны каталога</b><small>ЖК, планировки, параметры</small></div><ChevronRight size={17}/></button>
        <button onClick={()=>previewServerFeature('Массовый CSV-импорт')}><span><PackageOpen size={19}/></span><div><b>Импортировать данные</b><small>До 1000 ЖК за запрос</small></div><ChevronRight size={17}/></button>
        <button onClick={()=>previewServerFeature('Пакетная загрузка медиа')}><span><Images size={19}/></span><div><b>Загрузить медиа</b><small>Фото, планировки и PDF</small></div><ChevronRight size={17}/></button>
      </div>
      <div className="catalogImportFoot"><HardDrive size={14}/><span>Preview показывает интерфейс. В production файлы хранятся в отдельном media volume на VPS.</span></div>
    </section>

    <section className="catalogWorkspace">
      <div className="catalogWorkspaceTop">
        <div><span className="kicker">БАЗА ОБЪЕКТОВ</span><h2>{status==='all'?'Все ЖК':status==='published'?'Опубликованные':status==='draft'?'Черновики':'Архив'}</h2></div>
        <label className="controlSearch catalogSearch"><Search size={17}/><input placeholder="ЖК, город, застройщик" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      </div>

      <div className="catalogFilters">
        <div className="segmented">
          {([['all','Все'],['published','Опубликованы'],['draft','Черновики'],['archived','Архив']] as const).map(([value,label])=>
            <button key={value} className={status===value?'active':''} onClick={()=>setStatus(value)}>{label}</button>
          )}
        </div>
        <button type="button" className="secondaryAction" aria-pressed={reviewOnly} onClick={()=>setReviewOnly(v=>!v)}>{reviewOnly?"Показать весь каталог":"Требуют проверки"}</button>
        <div className="catalogPageMeta"><b>{list.length}</b><span>объектов в preview</span></div>
      </div>

      {list.length?<div className="catalogObjectGrid">{list.map(item=><button key={item.id} className="catalogObjectCard" onClick={()=>setSelected(item.id)}>
        <div className="catalogObjectImage">
          {item.coverImageUrl?<img src={item.coverImageUrl} alt=""/>:<div className="objectPlaceholder"><Building2 size={24}/><span>PULSE.DV</span></div>}
          <span className={'statusChip '+item.status}>{item.status==='published'?'Опубликован':item.status==='draft'?'Черновик':'Архив'}</span>
        </div>
        <div className="catalogObjectBody">
          <div className="catalogObjectTitle"><div><h3>{item.name}</h3><p><MapPin size={12}/>{item.city}{item.district?' · '+item.district:''}</p></div><ChevronRight size={18}/></div>
          <div className="catalogObjectFacts">
            <span><small>Цена от</small><b>{formatPrice(item.priceFrom)}</b></span>
            <span><small>Срок</small><b>{item.delivery||'Не указан'}</b></span>
          </div>
          <CatalogFreshnessBadge value={item.freshness}/><div className="catalogObjectDeveloper">{item.developerName||'Застройщик не указан'}</div>
        </div>
      </button>)}</div>:<div className="emptyState"><PackageOpen size={26}/><strong>Объекты не найдены</strong><span>Измените фильтр или добавьте новый ЖК.</span></div>}
    </section>

    {p&&<div className="drawerBackdrop"><section className="detailDrawer wideDrawer catalogEditor" role="dialog" aria-modal="true" aria-label="Редактор объекта">
      <div className="drawerHeader catalogDrawerHeader">
        <div><div className="catalogDrawerEyebrow"><span className={'statusChip '+p.status}>{p.status==='published'?'Опубликован':p.status==='draft'?'Черновик':'Архив'}</span><small>{p.id}</small></div><h2>{p.name}</h2></div>
        <button aria-label="Закрыть редактор" onClick={()=>setSelected(null)}><X/></button>
      </div>

      <div className="catalogReadiness">
        <div><span>Готовность карточки</span><b>{readiness(p)}%</b></div>
        <div><i style={{width:readiness(p)+'%'}}/></div>
        <small>{readiness(p)===100?'Основные данные заполнены — объект можно публиковать.':'Для публикации нужны обложка, цена, застройщик и срок сдачи.'}</small>
      </div>

      <CatalogFreshnessEditor value={p.freshness} onChange={freshness=>patch({freshness})} autoSave/>
      <section className="catalogEditorSection">
        <div className="catalogEditorSectionHead"><span><Building2 size={16}/></span><div><b>Основная информация</b><small>Карточка и страница ЖК</small></div></div>
        <div className="formGrid">
          {([['name','Название'],['city','Город'],['district','Район'],['address','Адрес'],['developerName','Застройщик'],['delivery','Срок сдачи'],['className','Класс'],['coverImageUrl','Обложка · HTTPS URL']] as const).map(([key,label])=><label key={key} className="controlField"><span>{label}</span><input value={(p as any)[key]||''} onChange={e=>patch({[key]:e.target.value||(['address','coverImageUrl'].includes(key)?null:'')} as any)}/></label>)}
          {([['priceFrom','Цена от, млн ₽'],['latitude','Широта'],['longitude','Долгота'],['sortOrder','Порядок']] as const).map(([key,label])=><label key={key} className="controlField"><span>{label}</span><input type="number" step="any" value={(p as any)[key]??''} onChange={e=>patch({[key]:e.target.value===''&&['latitude','longitude'].includes(key)?null:Number(e.target.value)} as any)}/></label>)}
          <label className="controlField"><span>Статус</span><select value={p.status} onChange={e=>patch({status:e.target.value as PulseProperty['status']})}><option value="draft">Черновик</option><option value="published">Опубликован</option><option value="archived">Архив</option></select></label>
          <label className="controlField"><span>Теги через запятую</span><input value={p.tags.join(', ')} onChange={e=>patch({tags:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})}/></label>
          <label className="controlField wide"><span>Описание</span><textarea rows={5} value={p.description} onChange={e=>patch({description:e.target.value})}/></label>
        </div>
      </section>

      <section className="catalogEditorSection">
        <div className="catalogEditorSectionHead"><span><PackageOpen size={16}/></span><div><b>Планировки</b><small>Комнатность, площадь, цена и изображение</small></div><button onClick={()=>patch({floorplans:[...p.floorplans,{id:crypto.randomUUID(),roomLabel:'1',areaFrom:null,areaTo:null,priceFrom:null,imageUrl:null,sortOrder:p.floorplans.length}]})}><Plus size={15}/>Добавить</button></div>
        <div className="catalogEditorStack">{p.floorplans.map((plan,i)=><div className="editorRow floorplanEditor" key={plan.id||i}><div className="formGrid">{([['roomLabel','Комнатность'],['areaFrom','Площадь от, м²'],['areaTo','Площадь до, м²'],['priceFrom','Цена от, млн ₽'],['imageUrl','Изображение · HTTPS URL']] as const).map(([key,label])=><label className="controlField" key={key}><span>{label}</span><input type={['roomLabel','imageUrl'].includes(key)?'text':'number'} step="any" value={(plan as any)[key]??''} onChange={e=>patch({floorplans:p.floorplans.map((x,j)=>j!==i?x:{...x,[key]:['roomLabel','imageUrl'].includes(key)?e.target.value||null:e.target.value===''?null:Number(e.target.value)})})}/></label>)}</div><button className="textDanger" onClick={()=>patch({floorplans:p.floorplans.filter((_,j)=>i!==j)})}>Удалить планировку</button></div>)}
        {!p.floorplans.length&&<div className="catalogEditorEmpty">Планировок пока нет.</div>}</div>
      </section>

      <section className="catalogEditorSection">
        <div className="catalogEditorSectionHead"><span><CheckCircle2 size={16}/></span><div><b>Особенности</b><small>Преимущества проекта</small></div><button onClick={()=>patch({features:[...p.features,{id:crypto.randomUUID(),label:'',icon:'building',sortOrder:p.features.length}]})}><Plus size={15}/>Добавить</button></div>
        <div className="catalogEditorStack">{p.features.map((feature,i)=><div className="inlineEditor" key={feature.id||i}><input aria-label="Особенность" value={feature.label} onChange={e=>patch({features:p.features.map((x,j)=>i===j?{...x,label:e.target.value}:x)})}/><select value={feature.icon} aria-label="Иконка особенности" onChange={e=>patch({features:p.features.map((x,j)=>i===j?{...x,icon:e.target.value}:x)})}>{[['building','Дом'],['waves','Море'],['trees','Парк'],['car','Парковка'],['baby','Дети'],['map-pin','Расположение']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button aria-label="Удалить особенность" onClick={()=>patch({features:p.features.filter((_,j)=>i!==j)})}><X size={16}/></button></div>)}
        {!p.features.length&&<div className="catalogEditorEmpty">Добавьте преимущества ЖК.</div>}</div>
      </section>

      <div className="catalogEditorFooter"><div><HardDrive size={15}/><span>Preview · сохранение в браузере</span></div><button className="primaryAction" onClick={()=>setSelected(null)}><Save size={16}/>Готово</button></div>
    </section></div>}
  </PageFrame>;
}

export function ObjectsPage(){return runtime.enabled?<ServerObjectsPage/>:<PreviewObjectsPage/>;}
