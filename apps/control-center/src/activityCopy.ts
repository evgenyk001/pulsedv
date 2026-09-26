import type { PulseEvent, PulseState } from "../../../packages/pulse-data";

const routeNames:Record<string,string>={
  "/":"Главная",
  "/catalog":"Каталог",
  "/mortgage":"Ипотека",
  "/selection":"Подбор",
  "/favorites":"Избранное",
  "/profile":"Профиль",
};

const mortgageNames:Record<string,string>={
  family:"Семейная ипотека",
  farEast:"Дальневосточная ипотека",
  it:"IT-ипотека",
  standard:"Базовая ипотека",
};

const sourceNames:Record<string,string>={
  property:"Карточка ЖК",
  mortgage:"Ипотека",
  selection:"Подбор",
  catalog:"Каталог",
  general:"Общая консультация",
  home:"Главная",
};

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
  const route=event.entityId||"";

  switch(event.eventType){
    case "page_view":{
      const propertyRoute=route.startsWith("/property/")?state.properties.find(item=>route.endsWith(item.id))?.name:null;
      const section=propertyRoute||routeNames[route]||"раздел приложения";
      return {title:`Открыл «${section}»`,detail:propertyRoute?"Карточка жилого комплекса":"Переход по приложению"};
    }
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
        rooms&&rooms!=="Все"?`${rooms} комн.`:null,
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
      const parts=[rate!=null?`ставка ${rate}%`:null,years!=null?`${years} лет`:null].filter(Boolean);
      return {title:"Рассчитал ипотеку",detail:parts.join(" · ")||"Оценил ежемесячный платёж"};
    }
    case "select_submit":{
      const budget=min!=null&&max!=null?`${min.toLocaleString("ru-RU")}–${max.toLocaleString("ru-RU")} ₽`:null;
      const parts=[city,rooms&&rooms!=="Все"?`${rooms} комн.`:null,budget].filter(Boolean);
      return {title:"Завершил PULSE Select",detail:parts.join(" · ")||"Получил персональную подборку"};
    }
    case "property_share":
      return {title:`Поделился ${propertyName||"объектом"}`,detail:"Отправил ссылку на ЖК"};
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
      return {title:"Действие в приложении",detail:propertyName||city||"Активность пользователя"};
  }
}
