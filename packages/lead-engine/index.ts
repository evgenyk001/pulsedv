export type LeadPriority="cold"|"warm"|"hot"|"urgent";

export type LeadEngineEvent={
  eventType:string;
  entityType:string|null;
  entityId:string|null;
  metadata:Record<string,unknown>;
  createdAt:string;
};

export type LeadScoringRule={
  id:string;
  eventType:string;
  label:string;
  weight:number;
  maxCount:number;
};

export type LeadEngineConfig={
  rules:LeadScoringRule[];
  thresholds:{warm:number;hot:number;urgent:number};
};

export type LeadScoreReason={
  ruleId:string;
  label:string;
  points:number;
  count:number;
};

export type LeadScoreResult={
  score:number;
  priority:LeadPriority;
  reasons:LeadScoreReason[];
  topPropertyId:string|null;
  city:string|null;
  mortgageProgram:string|null;
  eventCount:number;
  lastIntentAt:string|null;
  recommendedAction:string;
};

export const DEFAULT_LEAD_ENGINE_CONFIG:LeadEngineConfig={
  thresholds:{warm:30,hot:55,urgent:75},
  rules:[
    {id:"property_view",eventType:"property_view",label:"Смотрел карточки ЖК",weight:7,maxCount:5},
    {id:"favorite_add",eventType:"favorite_add",label:"Добавлял ЖК в избранное",weight:16,maxCount:3},
    {id:"favorite_remove",eventType:"favorite_remove",label:"Убирал ЖК из избранного",weight:-8,maxCount:3},
    {id:"catalog_filter",eventType:"catalog_filter",label:"Настраивал фильтры каталога",weight:4,maxCount:3},
    {id:"compare_add",eventType:"compare_add",label:"Сравнивал проекты",weight:12,maxCount:3},
    {id:"mortgage_program",eventType:"mortgage_program",label:"Выбирал ипотечную программу",weight:5,maxCount:2},
    {id:"mortgage_calculated",eventType:"mortgage_calculated",label:"Рассчитывал ипотеку",weight:15,maxCount:2},
    {id:"select_submit",eventType:"select_submit",label:"Прошёл PULSE Select",weight:18,maxCount:1},
    {id:"property_share",eventType:"property_share",label:"Делился объектом",weight:8,maxCount:2},
    {id:"lead_form_open",eventType:"lead_form_open",label:"Открыл форму консультации",weight:15,maxCount:2},
    {id:"contact_click",eventType:"contact_click",label:"Пытался связаться с PULSE.DV",weight:20,maxCount:2},
    {id:"lead_created",eventType:"lead_created",label:"Оставил контакт",weight:35,maxCount:1},
    {id:"return_visit",eventType:"return_visit",label:"Вернулся в приложение",weight:8,maxCount:2},
  ]
};

export function priorityFromScore(score:number,config:LeadEngineConfig=DEFAULT_LEAD_ENGINE_CONFIG):LeadPriority{
  if(score>=config.thresholds.urgent)return"urgent";
  if(score>=config.thresholds.hot)return"hot";
  if(score>=config.thresholds.warm)return"warm";
  return"cold";
}

function safeString(value:unknown){
  return typeof value==="string"&&value.trim()?value.trim():null;
}

function latestValue(events:LeadEngineEvent[],selector:(event:LeadEngineEvent)=>string|null){
  for(const event of [...events].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))){
    const value=selector(event);
    if(value)return value;
  }
  return null;
}

export function scoreLeadEvents(events:LeadEngineEvent[],config:LeadEngineConfig=DEFAULT_LEAD_ENGINE_CONFIG):LeadScoreResult{
  const sorted=[...events].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
  const reasons:LeadScoreReason[]=[];
  let rawScore=0;

  for(const rule of config.rules){
    const matching=sorted.filter(event=>event.eventType===rule.eventType).slice(-rule.maxCount);
    if(!matching.length)continue;
    const points=rule.weight*matching.length;
    rawScore+=points;
    reasons.push({ruleId:rule.id,label:rule.label,points,count:matching.length});
  }

  const score=Math.max(0,Math.min(100,Math.round(rawScore)));
  const priority=priorityFromScore(score,config);

  const propertyWeights=new Map<string,number>();
  for(const event of sorted){
    if(event.entityType!=="property"||!event.entityId)continue;
    const rule=config.rules.find(item=>item.eventType===event.eventType);
    const weight=Math.max(1,rule?.weight??1);
    propertyWeights.set(event.entityId,(propertyWeights.get(event.entityId)??0)+weight);
  }
  const topPropertyId=[...propertyWeights.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]??null;

  const city=latestValue(sorted,event=>safeString(event.metadata.city));
  const mortgageProgram=latestValue(sorted,event=>
    event.entityType==="mortgage_program"?safeString(event.entityId):safeString(event.metadata.program)
  );
  const lastIntentAt=sorted.length?sorted[sorted.length-1].createdAt:null;
  const hasLead=sorted.some(event=>event.eventType==="lead_created");

  let recommendedAction="Наблюдать интерес и не давить на пользователя.";
  if(priority==="warm")recommendedAction=hasLead
    ?"Связаться и уточнить критерии подбора."
    :"Показать персональный CTA и предложить короткую подборку.";
  if(priority==="hot")recommendedAction=hasLead
    ?"Связаться в течение 15 минут и продолжить с интересующего ЖК."
    :"Подтолкнуть к контакту: подборка, ипотечный расчёт или консультация.";
  if(priority==="urgent")recommendedAction=hasLead
    ?"Связаться сейчас: высокий намеренный интерес и контакт уже получен."
    :"Высокий интерес без контакта: усилить персональный CTA и перевод в диалог.";

  return{
    score,
    priority,
    reasons:reasons.sort((a,b)=>Math.abs(b.points)-Math.abs(a.points)).slice(0,5),
    topPropertyId,
    city,
    mortgageProgram,
    eventCount:sorted.length,
    lastIntentAt,
    recommendedAction,
  };
}
