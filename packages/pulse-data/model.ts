import { DEFAULT_LEAD_ENGINE_CONFIG, scoreLeadEvents, type LeadEngineConfig, type LeadPriority, type LeadScoreReason } from "../lead-engine";

export type PropertyStatus="draft"|"published"|"archived";

export type PulseProperty={
  id:string; name:string; city:string; district:string; address:string|null;
  latitude:number|null; longitude:number|null; priceFrom:number; delivery:string;
  className:string; status:PropertyStatus; description:string; developerName:string;
  tags:string[]; coverImageUrl:string|null; sortOrder:number;
  images:{id?:string;url:string;alt:string;sortOrder:number}[];
  features:{id?:string;label:string;icon:string;sortOrder:number}[];
  floorplans:{id?:string;roomLabel:string;areaFrom:number|null;areaTo:number|null;priceFrom:number|null;imageUrl:string|null;sortOrder:number}[];
};

export type PulseBanner={
  id:string; title:string; body:string; imageUrl:string|null; ctaLabel:string|null;
  actionUrl:string|null; city:string|null; audience:string|null; enabled:boolean; sortOrder:number;
};

export type MortgageProgramRule={
  id:"family"|"farEast"|"it"|"standard"; label:string; rate:number; maxYears:number;
  minDownPct:number; subsidizedLimit:number; totalLimit:number; blended:boolean; hint:string;
};

export type PulseSelectConfig={
  cities:string[];
  roomOptions:string[];
  deliveryOptions:string[];
  mortgageEnabled:boolean;
  seaEnabled:boolean;
  smartQueryEnabled:boolean;
  whatIfEnabled:boolean;
  maxPreferences:number;
  preferenceEnabled:{
    sea:boolean;
    family:boolean;
    parking:boolean;
    center:boolean;
    courtyard:boolean;
    finish:boolean;
  };
  weights:{city:number;budget:number;rooms:number;delivery:number;preferences:number};
};

export type PulseContentConfig={
  onboardingEnabled:boolean;
  onboardingVersion:string;
};

export type PulseState={
  properties:PulseProperty[];
  banners:PulseBanner[];
  mortgagePrograms:MortgageProgramRule[];
  select:PulseSelectConfig;
  content:PulseContentConfig;
  leadEngine:LeadEngineConfig;
  updatedAt:string;
};

export type PulseLead={
  id:string; source:string; propertyId:string|null; name:string; phone:string; comment:string|null;
  status:"new"|"contacted"|"qualified"|"showing"|"booking"|"deal"|"closed"|"lost";
  manager:string|null; createdAt:string; updatedAt:string;
  sessionId?:string|null; userId?:string|null; score?:number; priority?:LeadPriority;
  scoreReasons?:LeadScoreReason[]; topPropertyId?:string|null; city?:string|null;
  mortgageProgram?:string|null; nextAction?:string|null;
};

export type PulseVisitorProfile={
  id:string; sessionId:string; userId:string|null; score:number; priority:LeadPriority;
  scoreReasons:LeadScoreReason[]; topPropertyId:string|null; city:string|null;
  mortgageProgram:string|null; nextAction:string; eventCount:number;
  firstSeenAt:string; lastSeenAt:string; updatedAt:string;
};

export type PulseTask={
  id:string; leadId:string|null; profileId:string; sessionId:string;
  title:string; reason:string; priority:Exclude<LeadPriority,"cold">;
  status:"today"|"in_progress"|"waiting"|"done";
  dueAt:string; createdAt:string; updatedAt:string;
};

export type PulseEvent={
  id:string; sessionId:string; userId:string|null; eventType:string; entityType:string|null;
  entityId:string|null; metadata:Record<string,unknown>; createdAt:string;
};

const now=()=>new Date().toISOString();

export const DEFAULT_PROPERTIES:PulseProperty[]=[
  {id:"primorskiy",name:"ЖК Приморский",city:"Владивосток",district:"Центр",address:"Владивосток",latitude:43.1155,longitude:131.8855,priceFrom:7.8,delivery:"I кв. 2027",className:"Бизнес",status:"published",description:"Современный жилой комплекс в центральной части Владивостока с благоустроенной территорией и выразительной архитектурой.",developerName:"Партнёр PULSE.DV",tags:["Старт продаж"],coverImageUrl:"https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1000&q=85",sortOrder:1,images:[{url:"https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=85",alt:"ЖК Приморский",sortOrder:1}],features:[{label:"Центр города",icon:"map-pin",sortOrder:1},{label:"Двор без машин",icon:"car",sortOrder:2},{label:"Благоустройство",icon:"trees",sortOrder:3}],floorplans:[{roomLabel:"1",areaFrom:38,areaTo:46,priceFrom:7.8,imageUrl:null,sortOrder:1},{roomLabel:"2",areaFrom:56,areaTo:71,priceFrom:9.4,imageUrl:null,sortOrder:2},{roomLabel:"3+",areaFrom:78,areaTo:102,priceFrom:12.8,imageUrl:null,sortOrder:3}]},
  {id:"solnechniy",name:"ЖК Солнечный",city:"Владивосток",district:"Патрокл",address:"Владивосток, Патрокл",latitude:43.105,longitude:131.98,priceFrom:6.2,delivery:"IV кв. 2026",className:"Комфорт+",status:"published",description:"Проект рядом с морем с панорамными видами, дворами для отдыха и семейной инфраструктурой.",developerName:"Партнёр PULSE.DV",tags:["Вид на море"],coverImageUrl:"https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=85",sortOrder:2,images:[{url:"https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=85",alt:"ЖК Солнечный",sortOrder:1}],features:[{label:"Вид на море",icon:"waves",sortOrder:1},{label:"Прогулочные зоны",icon:"trees",sortOrder:2},{label:"Детские площадки",icon:"baby",sortOrder:3}],floorplans:[{roomLabel:"Студия",areaFrom:27,areaTo:31,priceFrom:6.2,imageUrl:null,sortOrder:1},{roomLabel:"1",areaFrom:34,areaTo:45,priceFrom:6.8,imageUrl:null,sortOrder:2},{roomLabel:"2",areaFrom:52,areaTo:69,priceFrom:8.6,imageUrl:null,sortOrder:3}]},
  {id:"vostochniy",name:"ЖК Восточный",city:"Уссурийск",district:"Новый район",address:"Уссурийск",latitude:43.80,longitude:131.96,priceFrom:5.4,delivery:"2027",className:"Комфорт",status:"published",description:"Новый жилой квартал с удобными планировками и спокойной семейной средой.",developerName:"Партнёр PULSE.DV",tags:["Новый район"],coverImageUrl:"https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1000&q=85",sortOrder:3,images:[{url:"https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=85",alt:"ЖК Восточный",sortOrder:1}],features:[{label:"Парковка",icon:"car",sortOrder:1},{label:"Зелёный двор",icon:"trees",sortOrder:2}],floorplans:[{roomLabel:"1",areaFrom:35,areaTo:44,priceFrom:5.4,imageUrl:null,sortOrder:1},{roomLabel:"2",areaFrom:53,areaTo:68,priceFrom:7.1,imageUrl:null,sortOrder:2},{roomLabel:"3+",areaFrom:76,areaTo:91,priceFrom:9.2,imageUrl:null,sortOrder:3}]},
  {id:"artem",name:"ЖК Аэропорт",city:"Артём",district:"Северный",address:"Артём",latitude:43.35,longitude:132.18,priceFrom:4.9,delivery:"2026",className:"Комфорт",status:"published",description:"Современный проект в Артёме с удобным выездом и базовой инфраструктурой рядом.",developerName:"Партнёр PULSE.DV",tags:["Новый район"],coverImageUrl:"https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=1000&q=85",sortOrder:4,images:[{url:"https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=1200&q=85",alt:"ЖК Аэропорт",sortOrder:1}],features:[{label:"Удобный выезд",icon:"map-pin",sortOrder:1},{label:"Парковка",icon:"car",sortOrder:2}],floorplans:[{roomLabel:"Студия",areaFrom:25,areaTo:30,priceFrom:4.9,imageUrl:null,sortOrder:1},{roomLabel:"1",areaFrom:33,areaTo:42,priceFrom:5.3,imageUrl:null,sortOrder:2},{roomLabel:"2",areaFrom:50,areaTo:64,priceFrom:6.7,imageUrl:null,sortOrder:3}]}
];

export const DEFAULT_BANNERS:PulseBanner[]=[
  {id:"b1",title:"Квартира, которую хочется показывать друзьям",body:"Проекты Владивостока, Артёма и Уссурийска в одном каталоге.",imageUrl:null,ctaLabel:"Смотреть проекты",actionUrl:"/catalog",city:"Приморье",audience:"",enabled:true,sortOrder:1},
  {id:"b2",title:"Сначала платёж. Потом — подходящие квартиры",body:"Подберём проекты под комфортный ежемесячный платёж.",imageUrl:null,ctaLabel:"Рассчитать",actionUrl:"/mortgage",city:"Ипотека",audience:"",enabled:true,sortOrder:2},
  {id:"b3",title:"Не листайте сотни квартир вручную",body:"Ответьте на несколько вопросов — покажем подходящие ЖК.",imageUrl:null,ctaLabel:"Начать подбор",actionUrl:"/selection",city:"PULSE Select",audience:"",enabled:true,sortOrder:3}
];

export const DEFAULT_MORTGAGE_PROGRAMS:MortgageProgramRule[]=[
  {id:"family",label:"Семейная",rate:6,maxYears:30,minDownPct:20.1,subsidizedLimit:6_000_000,totalLimit:15_000_000,blended:true,hint:"Льготная часть — до 6 млн ₽. Увеличенный лимит может включать часть по рыночной ставке."},
  {id:"farEast",label:"Дальневосточная",rate:2,maxYears:20,minDownPct:20.1,subsidizedLimit:6_000_000,totalLimit:9_000_000,blended:false,hint:"До 6 млн ₽; до 9 млн ₽ — при выполнении условия по площади новостройки."},
  {id:"it",label:"IT",rate:6,maxYears:30,minDownPct:20.1,subsidizedLimit:9_000_000,totalLimit:18_000_000,blended:true,hint:"Базовый льготный лимит — 9 млн ₽, увеличенный — до 18 млн ₽."},
  {id:"standard",label:"Базовая",rate:18,maxYears:30,minDownPct:20.1,subsidizedLimit:100_000_000,totalLimit:100_000_000,blended:false,hint:"Рыночная программа. Ставка в расчёте редактируется вручную."}
];

export const DEFAULT_STATE:PulseState={
  properties:DEFAULT_PROPERTIES,
  banners:DEFAULT_BANNERS,
  mortgagePrograms:DEFAULT_MORTGAGE_PROGRAMS,
  select:{
    cities:["Владивосток","Уссурийск","Артём"],
    roomOptions:["Студия","1","2","3+"],
    deliveryOptions:["Любой","2026","2027"],
    mortgageEnabled:true,
    seaEnabled:true,
    smartQueryEnabled:true,
    whatIfEnabled:true,
    maxPreferences:3,
    preferenceEnabled:{sea:true,family:true,parking:true,center:true,courtyard:true,finish:true},
    weights:{city:25,budget:30,rooms:20,delivery:10,preferences:15}
  },
  content:{onboardingEnabled:true,onboardingVersion:"6"},
  leadEngine:DEFAULT_LEAD_ENGINE_CONFIG,
  updatedAt:now()
};
