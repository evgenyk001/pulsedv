import {reactionLabels,type Reaction} from '../../../packages/journey/model';
import type { PulseEvent, PulseState } from "../../../packages/pulse-data";

const routeNames:Record<string,string>={
  "/":"Главная",
  "/catalog":"Каталог",
  "/mortgage":"Ипотека",
  "/selection":"Подбор",
  "/favorites":"Избранное",
  "/profile":"Профиль",
  "/journey":"Мои подборки и показы",
};

export const mortgageNames:Record<string,string>={
  family:"Семейная ипотека",
  farEast:"Дальневосточная ипотека",
  it:"IT-ипотека",
  standard:"Базовая ипотека",
};

const sourceNames:Record<string,string>={
  presentation:"Презентация ЖК",
  app:"Мини-приложение",
  property:"Карточка ЖК",
  mortgage:"Ипотека",
  selection:"Подбор",
  catalog:"Каталог",
  general:"Общая консультация",
  home:"Главная",
};

const eventNames:Record<string,string>={
  attribution:"Источник перехода",
  comparison_view:"Открыл сравнение ЖК",
  collection_reaction:"Ответил на подборку",
  client_message:"Написал менеджеру",
  showing_cancelled:"Отменил показ",
  showing_reschedule_requested:"Запросил перенос показа",
  showing_requested:"Запросил показ",
  floorplan_view:"Просмотр планировки",
  property_view:"Просмотр карточки ЖК",
  favorite_add:"Добавление в избранное",
  favorite_remove:"Удаление из избранного",
  catalog_filter:"Изменение фильтров",
  compare_add:"Добавление к сравнению",
  compare_remove:"Удаление из сравнения",
  mortgage_program:"Выбор ипотечной программы",
  mortgage_calculated:"Расчёт ипотеки",
  select_submit:"Завершение PULSE Select",
  property_share:"Отправка ссылки на ЖК",
  lead_form_open:"Открытие формы консультации",
  contact_click:"Попытка связаться",
  lead_created:"Отправка заявки",
  return_visit:"Повторный визит",
  onboarding_complete:"Завершение онбординга",
  mortgage_intro_open:"Открыл подсказки по ипотеке",
  mortgage_intro_slide:"Просмотр подсказки по ипотеке",
  mortgage_intro_skip:"Закрыл подсказки по ипотеке",
  mortgage_intro_complete:"Завершил знакомство с ипотекой",
  mortgage_intro_replay:"Повторно открыл подсказки по ипотеке",
  page_view:"Переход по приложению",
};

export const eventTypeName=(eventType:string)=>eventNames[eventType]||"Действие пользователя";

export const priorityName=(priority:string|undefined)=>
  priority==="urgent"?"Срочный":
  priority==="hot"?"Горячий":
  priority==="warm"?"Тёплый":
  "Холодный";

export const taskStatusName=(status:string)=>
  status==="today"?"Сегодня":
  status==="in_progress"?"В работе":
  status==="waiting"?"Ожидает":
  status==="done"?"Готово":
  "Задача";

export const leadSourceName=(source:string)=>{
  if(sourceNames[source])return sourceNames[source];
  if(source.startsWith("property"))return "Карточка ЖК";
  if(source.startsWith("mortgage"))return "Ипотека";
  return "Обращение из приложения";
};

const text=(value:unknown)=>typeof value==="string"&&value.trim()?value.trim():null;
const number=(value:unknown)=>typeof value==="number"&&Number.isFinite(value)?value:null;
const yesNo=(value:unknown)=>value===true?"да":value===false?"нет":null;

export function describeEvent(event:PulseEvent,state:PulseState){
  const property=event.entityId?state.properties.find(item=>item.id===event.entityId):null;
  const propertyName=property?.name||null;
  const meta=event.metadata||{};
  const city=text(meta.city);
  const rooms=text(meta.rooms);
  const delivery=text(meta.delivery);
  const results=number(meta.results);
  const min=number(meta.min);
  const max=number(meta.max);
  const program=text(meta.program)||event.entityId;
  const route=(event.entityId||"").split("?")[0].replace(/\/$/,"")||"/";

  switch(event.eventType){
    case "mortgage_intro_open":
    case "mortgage_intro_skip":
    case "mortgage_intro_complete":
    case "mortgage_intro_replay":
      return {title:eventTypeName(event.eventType),detail:"Обучающие истории в разделе ипотеки"};
    case "mortgage_intro_slide":
      return {title:"Перешёл к подсказке по ипотеке",detail:/^[123]$/.test(event.entityId||"")?`Экран ${event.entityId} из 3`:"Обучающая история"};
    case 'collection_reaction':return {title:'Ответил на подборку · '+(propertyName||'ЖК'),detail:(reactionLabels[meta.reaction as Reaction]||'Ответ клиента')+(text(meta.reply)?' · '+text(meta.reply):'')};
    case 'showing_requested':return {title:'Запросил показ · '+(propertyName||'ЖК'),detail:'Ожидает подтверждения менеджером'};
    case 'comparison_view':return {title:'Открыл сравнение ЖК',detail:String(meta.propertyIds||'').split(',').map(id=>state.properties.find(p=>p.id===id)?.name||'ЖК из истории').join(' · ')};
    case 'attribution':return {title:'Перешёл в приложение',detail:[meta.source==='direct'?'Прямой переход':text(meta.source),text(meta.campaign)].filter(Boolean).join(' · ')};
    case "page_view":{
      const propertyRoute=route.startsWith("/property/")?state.properties.find(item=>route.endsWith(item.id))?.name:null;
      const section=propertyRoute||routeNames[route]||"раздел приложения";
      return {title:`Открыл «${section}»`,detail:propertyRoute?"Карточка жилого комплекса":"Переход по приложению"};
    }
    case "floorplan_view":
      return {title:'Рассмотрел планировку'+(rooms?' · '+(rooms==='Студия'?rooms:rooms+' комн.') :''),detail:[propertyName||text(meta.propertyName),number(meta.areaFrom)!==null?String(meta.areaFrom)+' м²':null,number(meta.price)!==null?Number(meta.price).toLocaleString('ru-RU')+' ₽':null].filter(Boolean).join(' · ')};
    case "property_view":
      return {title:`Открыл ${propertyName||"карточку ЖК"}`,detail:[city,property?.district].filter(Boolean).join(" · ")||"Просмотр объекта"};
    case "favorite_add":
      return {title:`Добавил в избранное ${propertyName||"ЖК"}`,detail:"Сохранил объект, чтобы вернуться позже"};
    case "favorite_remove":
      return {title:`Убрал из избранного ${propertyName||"ЖК"}`,detail:"Изменил список сохранённых объектов"};
    case "compare_add":
      return {title:`Добавил к сравнению ${propertyName||"ЖК"}`,detail:"Сравнивает объект с другими вариантами"};
    case "compare_remove":
      return {title:`Убрал из сравнения ${propertyName||"ЖК"}`,detail:"Изменил список сравнения"};
    case "catalog_filter":{
      const parts=[
        city,
        min!=null&&max!=null?`Бюджет ${min.toLocaleString("ru-RU")}–${max.toLocaleString("ru-RU")} ₽`:null,
        rooms&&rooms!=="Все"?(rooms==="Студия"?rooms:`${rooms} комн.`):null,
        delivery&&delivery!=="Любой"?`сдача ${delivery}`:null,
        yesNo(meta.sea)==="да"?"вид на море":null,
        results!=null?`${results} вариантов`:null,
      ].filter(Boolean);
      return {title:"Изменил фильтры каталога",detail:parts.join(" · ")||"Уточняет параметры квартиры"};
    }
    case "mortgage_program":
      return {title:`Выбрал программу «${mortgageNames[program||""]||"Ипотека"}»`,detail:"Смотрит условия финансирования"};
    case "mortgage_calculated":{
      const rate=number(meta.rate);
      const years=number(meta.years);
      const rub=(v:unknown)=>typeof v==='number'?Math.round(v).toLocaleString('ru-RU')+' ₽':null;
      const parts=[mortgageNames[program||''],rub(meta.price)?`Стоимость ${rub(meta.price)}`:null,rub(meta.down)?`взнос ${rub(meta.down)}`:null,rub(meta.payment)?`платёж ${rub(meta.payment)}/мес`:null,rate!=null?`ставка ${rate}%`:null,years!=null?`${years} лет`:null].filter(Boolean);
      return {title:"Рассчитал ипотеку",detail:parts.join(" · ")||"Оценил ежемесячный платёж"};
    }
    case "select_submit":{
      const budget=min!=null&&max!=null?`${min.toLocaleString("ru-RU")}–${max.toLocaleString("ru-RU")} ₽`:null;
      const payment=number(meta.payment);
      const down=number(meta.down);
      const purchaseMode=text(meta.purchaseMode);
      const match=number(meta.topScore);
      const preferenceNames:Record<string,string>={sea:'вид на море',family:'для семьи',parking:'парковка',center:'ближе к центру',courtyard:'благоустроенный двор',finish:'с отделкой'};
      const preferences=text(meta.preferences)?.split(',').map(x=>preferenceNames[x.trim()]||x.trim()).join(', ');
      const finance=purchaseMode==="mortgage"&&payment!=null
        ?`до ${payment.toLocaleString("ru-RU")} ₽/мес${down!=null?` · взнос ${down.toLocaleString("ru-RU")} ₽`:""}`
        :budget;
      const parts=[
        city,
        rooms&&rooms!=="Все"?(rooms==="Студия"?"Студия":`${rooms} комн.`):null,
        finance,
        delivery&&delivery!=="Не важно"?`срок ${delivery}`:null,
        preferences?`приоритеты: ${preferences}`:null,
        match!=null?`Совпадение ${match}%`:null,
        results!=null?`${results} вариантов`:null,
      ].filter(Boolean);
      return {title:"Завершил PULSE Select",detail:parts.join(" · ")||"Получил персональную подборку"};
    }
    case "property_share":
      return meta.outcome==='completed'
        ?{title:meta.method==='clipboard'?`Скопировал ссылку на ${propertyName||"ЖК"}`:`Поделился ${propertyName||"объектом"}`,detail:meta.method==='clipboard'?"Ссылка сохранена в буфер обмена":"Завершил действие в меню отправки"}
        :{title:`Нажал «Поделиться»${propertyName?' · '+propertyName:''}`,detail:"Для старой записи результат отправки неизвестен"};
    case "lead_form_open":
      return {title:`Открыл форму консультации${propertyName?` по ${propertyName}`:""}`,detail:"Высокий интерес к контакту с менеджером"};
    case "contact_click":
      return {title:"Нажал «Связаться»",detail:propertyName||"Попытка связаться с PULSE.DV"};
    case "lead_created":
      return {title:"Оставил заявку",detail:propertyName||"Передал контакты менеджеру"};
    case "onboarding_complete":
      return {title:"Завершил знакомство с приложением",detail:"Прошёл онбординг"};
    case "return_visit":
      return {title:"Вернулся в приложение",detail:"Повторный визит"};
    default:
      return {title:eventTypeName(event.eventType),detail:propertyName||city||"Активность пользователя"};
  }
}
