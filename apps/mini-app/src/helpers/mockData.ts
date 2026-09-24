import type { PropertyRecord } from "./propertyTypes";

export const MOCK_PROPERTIES:PropertyRecord[]=[
  {
    id:"primorskiy",name:"ЖК Приморский",city:"Владивосток",district:"Центр",address:"Владивосток",latitude:43.1155,longitude:131.8855,
    priceFrom:7.8,delivery:"I кв. 2027",className:"Бизнес",status:"published",
    description:"Современный жилой комплекс в центральной части Владивостока с благоустроенной территорией и выразительной архитектурой.",
    developerName:"Партнёр PULSE.DV",tags:["Старт продаж"],coverImageUrl:"https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1000&q=85",sortOrder:1,
    images:[{url:"https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=85",alt:"ЖК Приморский",sortOrder:1}],
    features:[{label:"Центр города",icon:"map-pin",sortOrder:1},{label:"Двор без машин",icon:"car",sortOrder:2},{label:"Благоустройство",icon:"trees",sortOrder:3}],
    floorplans:[{roomLabel:"1",areaFrom:38,areaTo:46,priceFrom:7.8,imageUrl:null,sortOrder:1},{roomLabel:"2",areaFrom:56,areaTo:71,priceFrom:9.4,imageUrl:null,sortOrder:2},{roomLabel:"3+",areaFrom:78,areaTo:102,priceFrom:12.8,imageUrl:null,sortOrder:3}]
  },
  {
    id:"solnechniy",name:"ЖК Солнечный",city:"Владивосток",district:"Патрокл",address:"Владивосток, Патрокл",latitude:43.105,longitude:131.98,
    priceFrom:6.2,delivery:"IV кв. 2026",className:"Комфорт+",status:"published",
    description:"Проект рядом с морем с панорамными видами, дворами для отдыха и семейной инфраструктурой.",
    developerName:"Партнёр PULSE.DV",tags:["Вид на море"],coverImageUrl:"https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=85",sortOrder:2,
    images:[{url:"https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=85",alt:"ЖК Солнечный",sortOrder:1}],
    features:[{label:"Вид на море",icon:"waves",sortOrder:1},{label:"Прогулочные зоны",icon:"trees",sortOrder:2},{label:"Детские площадки",icon:"baby",sortOrder:3}],
    floorplans:[{roomLabel:"Студия",areaFrom:27,areaTo:31,priceFrom:6.2,imageUrl:null,sortOrder:1},{roomLabel:"1",areaFrom:34,areaTo:45,priceFrom:6.8,imageUrl:null,sortOrder:2},{roomLabel:"2",areaFrom:52,areaTo:69,priceFrom:8.6,imageUrl:null,sortOrder:3}]
  },
  {
    id:"vostochniy",name:"ЖК Восточный",city:"Уссурийск",district:"Новый район",address:"Уссурийск",latitude:43.80,longitude:131.96,
    priceFrom:5.4,delivery:"2027",className:"Комфорт",status:"published",
    description:"Новый жилой квартал с удобными планировками и спокойной семейной средой.",
    developerName:"Партнёр PULSE.DV",tags:["Новый район"],coverImageUrl:"https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1000&q=85",sortOrder:3,
    images:[{url:"https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=85",alt:"ЖК Восточный",sortOrder:1}],
    features:[{label:"Парковка",icon:"car",sortOrder:1},{label:"Зелёный двор",icon:"trees",sortOrder:2}],
    floorplans:[{roomLabel:"1",areaFrom:35,areaTo:44,priceFrom:5.4,imageUrl:null,sortOrder:1},{roomLabel:"2",areaFrom:53,areaTo:68,priceFrom:7.1,imageUrl:null,sortOrder:2},{roomLabel:"3+",areaFrom:76,areaTo:91,priceFrom:9.2,imageUrl:null,sortOrder:3}]
  },
  {
    id:"artem",name:"ЖК Аэропорт",city:"Артём",district:"Северный",address:"Артём",latitude:43.35,longitude:132.18,
    priceFrom:4.9,delivery:"2026",className:"Комфорт",status:"published",
    description:"Современный проект в Артёме с удобным выездом и базовой инфраструктурой рядом.",
    developerName:"Партнёр PULSE.DV",tags:["Новый район"],coverImageUrl:"https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=1000&q=85",sortOrder:4,
    images:[{url:"https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=1200&q=85",alt:"ЖК Аэропорт",sortOrder:1}],
    features:[{label:"Удобный выезд",icon:"map-pin",sortOrder:1},{label:"Парковка",icon:"car",sortOrder:2}],
    floorplans:[{roomLabel:"Студия",areaFrom:25,areaTo:30,priceFrom:4.9,imageUrl:null,sortOrder:1},{roomLabel:"1",areaFrom:33,areaTo:42,priceFrom:5.3,imageUrl:null,sortOrder:2},{roomLabel:"2",areaFrom:50,areaTo:64,priceFrom:6.7,imageUrl:null,sortOrder:3}]
  }
];

export const MOCK_BANNERS=[
  {id:"b1",title:"Квартира, которую хочется показывать друзьям",body:"Проекты Владивостока, Артёма и Уссурийска в одном каталоге.",imageUrl:"https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=85",ctaLabel:"Смотреть проекты",actionUrl:"/catalog",city:"Приморье",audience:""},
  {id:"b2",title:"Сначала платёж. Потом — подходящие квартиры",body:"Рассчитайте ипотечный сценарий и сравните проекты.",imageUrl:"https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=85",ctaLabel:"Рассчитать",actionUrl:"/mortgage",city:"Ипотека",audience:""},
  {id:"b3",title:"Не листайте сотни квартир вручную",body:"PULSE Select соберёт короткий список под ваш сценарий.",imageUrl:"https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=85",ctaLabel:"Начать подбор",actionUrl:"/selection",city:"PULSE Select",audience:""}
];
