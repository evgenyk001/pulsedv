import {reactionLabels,type Reaction} from '../journey/model';
import type { PulseEvent, PulseState } from '../pulse-data/model';
import { selectionMatch, type SelectionCriteria, type PreferenceId } from '../domain/propertyMatch';
export type Dimension='city'|'property'|'rooms'|'mortgage'|'preferences';
export type Evidence={eventId:string;sessionId:string;at:string;title:string;source:'declared'|'behavior'|'scenario'};
export type Interest={dimension:Dimension;value:string;label:string;strength:number;confidence:'early'|'supported'|'steady';evidence:Evidence[];count:number;lastSeenAt:string};
export type Fact={key:string;label:string;value:string;evidence:Evidence};
export type Change={id:string;title:string;detail:string;at:string;eventIds:string[]};
export type InterestDNA={version:1;generatedAt:string;windowDays:30;eventCount:number;sessionCount:number;lastSeenAt:string|null;interests:Interest[];facts:Fact[];changes:Change[];questions:string[];brief:string;nextAction:string;recommendations:{id:string;name:string;reasons:string[];tradeoffs:string[]}[]};
export const dimensionLabels:Record<Dimension,string>={city:'Города',property:'Жилые комплексы',rooms:'Комнатность',mortgage:'Ипотечные сценарии',preferences:'Личные приоритеты'};
const programNames:Record<string,string>={family:'Семейная ипотека',farEast:'Дальневосточная ипотека',it:'IT-ипотека',standard:'Базовая ипотека'};
const preferenceNames:Record<string,string>={sea:'Вид на море',family:'Для семьи',parking:'Парковка',center:'Ближе к центру',courtyard:'Благоустроенный двор',finish:'С отделкой'};
const DAY=86400000;
const text=(v:unknown)=>typeof v==='string'?v.trim().slice(0,150):'';
const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
const specified=(v:unknown)=>{const s=text(v);return s&&!['Все','Не важно','Любой'].includes(s)?s:''};
const rub=(v:number)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(v)+' ₽';
const room=(v:unknown)=>{const s=specified(v);if(!s)return '';if(/студ/i.test(s))return 'Студия';const n=s.match(/\d+/)?.[0];return n?(s.includes('+')?n+'+':n):''};
const roomLabel=(v:string)=>v==='Студия'?v:v+' комн.';
export function selectIdentityEvents(events:PulseEvent[],sessionId:string,userId?:string|null){
 // Only an authenticated server user ID can join sessions. Phones and browser fingerprints never do.
 return events.filter(e=>e.sessionId===sessionId||!!userId&&e.userId===userId);
}
function selectionFacts(event:PulseEvent):Fact[]{
 const m=event.metadata;const evidence:Evidence={eventId:event.id,sessionId:event.sessionId,at:event.createdAt,title:'Указал в PULSE Select',source:'declared'};
 const facts:Fact[]=[];const add=(key:string,label:string,value:string)=>{if(value)facts.push({key,label,value,evidence})};
 add('city','Город',specified(m.city));const r=room(m.rooms);add('rooms','Комнатность',r?roomLabel(r):'');
 add('delivery','Сдача дома',specified(m.delivery));
 const mode=m.purchaseMode==='mortgage'||m.mortgage===true?'mortgage':m.purchaseMode==='cash'||m.mortgage===false?'cash':null;
 if(mode==='cash'){
  add('purchaseMode','Способ расчёта','По стоимости');const min=num(m.min),max=num(m.max);
  if(min!==null&&max!==null&&max>0&&max>=min)add('budget','Бюджет',rub(min)+'–'+rub(max));
 }else if(mode==='mortgage'){
  add('purchaseMode','Способ расчёта','Ипотека');const down=num(m.down),payment=num(m.payment);
  if(down!==null)add('down','Первоначальный взнос',rub(down));if(payment!==null&&payment>0)add('payment','Комфортный платёж','до '+rub(payment)+'/мес');
  if(programNames[text(m.program)])add('program','Выбранный сценарий',programNames[text(m.program)]);
 }
 const preferences=text(m.preferences).split(',').map(x=>preferenceNames[x.trim()]).filter(Boolean);
 if(preferences.length)add('preferences','Приоритеты',preferences.join(', '));
 return facts;
}
export function buildInterestDNA(input:PulseEvent[],state:Pick<PulseState,'properties'|'mortgagePrograms'|'select'>,now=new Date()):InterestDNA{
 const seen=new Set<string>();
 const events=input.filter(e=>{const at=Date.parse(e.createdAt);if(!e.id||seen.has(e.id)||!Number.isFinite(at)||at<now.getTime()-30*DAY||at>now.getTime())return false;seen.add(e.id);return true}).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.id.localeCompare(b.id));
 const properties=new Map(state.properties.map(p=>[p.id,p]));
 const buckets=new Map<string,{dimension:Dimension;value:string;label:string;points:number;evidence:Evidence[]}>();
 const caps=new Map<string,number>();
 const favoriteState=new Map<string,string>();for(const e of events)if(e.entityId&&['favorite_add','favorite_remove'].includes(e.eventType))favoriteState.set(e.entityId,e.eventType);
 const add=(dimension:Dimension,value:string,label:string,weight:number,event:PulseEvent,title:string,source:Evidence['source'])=>{
  if(!value||!label)return;const key=dimension+':'+value;
  // Repeated clicks within a day contribute at most three signals per action/value across all sessions.
  const capKey=key+':'+event.eventType+':'+event.createdAt.slice(0,10);const count=caps.get(capKey)||0;if(count>=3)return;caps.set(capKey,count+1);
  const b=buckets.get(key)||{dimension,value,label,points:0,evidence:[]};
  b.points+=weight*Math.pow(.5,(now.getTime()-Date.parse(event.createdAt))/(14*DAY));
  b.evidence.push({eventId:event.id,sessionId:event.sessionId,at:event.createdAt,title,source});buckets.set(key,b);
 };
 for(const e of events){
  const m=e.metadata;const p=e.entityType==='property'&&e.entityId?properties.get(e.entityId):undefined;
  const propertyActions:Record<string,[number,string]>={property_view:[2,'Открыл карточку ЖК'],floorplan_view:[5,'Рассмотрел планировку'],favorite_add:[9,'Добавил ЖК в избранное'],compare_add:[4,'Добавил ЖК к сравнению'],lead_form_open:[7,'Открыл форму консультации'],property_share:[3,'Поделился ссылкой на ЖК']};
  const action=propertyActions[e.eventType];
  if(action&&e.entityType==='property'&&e.entityId&&!(e.eventType==='favorite_add'&&favoriteState.get(e.entityId)==='favorite_remove')&&!(e.eventType==='property_share'&&m.outcome!=='completed')){
   const name=text(m.propertyName)||p?.name||'ЖК из истории';
   add('property',e.entityId,name,action[0],e,action[1]+' · '+name,'behavior');
   const city=specified(m.city)||p?.city||'';add('city',city,city,action[0],e,action[1]+' · '+name,'behavior');
   if(e.eventType==='floorplan_view'){const r=room(m.rooms);add('rooms',r,roomLabel(r),5,e,'Рассмотрел '+roomLabel(r)+' · '+name,'behavior');}
  }
  if(e.eventType==='select_submit'||e.eventType==='catalog_filter'){
   const declared=e.eventType==='select_submit';const title=declared?'Указал в PULSE Select':'Применил фильтры каталога';const source=declared?'declared':'behavior';const weight=declared?12:4;
   const city=specified(m.city);add('city',city,city,weight,e,title,source);const r=room(m.rooms);add('rooms',r,roomLabel(r),weight,e,title,source);
   for(const value of text(m.preferences).split(',').map(x=>x.trim()))if(preferenceNames[value])add('preferences',value,preferenceNames[value],weight,e,title,source);
   if(e.eventType==='catalog_filter'&&m.sea===true)add('preferences','sea','Вид на море',4,e,title,source);
  }
  if(['mortgage_program','mortgage_calculated'].includes(e.eventType)||(e.eventType==='select_submit'&&m.purchaseMode==='mortgage')){
   const value=text(m.program)||(e.eventType==='mortgage_program'?e.entityId||'':'');
   if(programNames[value])add('mortgage',value,programNames[value],e.eventType==='mortgage_calculated'?5:3,e,e.eventType==='mortgage_calculated'?'Рассчитал платёж по программе':'Выбрал программу для расчёта','scenario');
  }
 }
 const interests:Interest[]=[...buckets.values()].map(b=>{
  const days=new Set(b.evidence.map(e=>e.at.slice(0,10))).size;
  return {dimension:b.dimension,value:b.value,label:b.label,strength:Math.min(100,Math.round(b.points/30*100)),confidence:days>=3&&b.evidence.length>=5?'steady' as const:b.evidence.length>=3?'supported' as const:'early' as const,evidence:b.evidence.slice(-12).reverse(),count:b.evidence.length,lastSeenAt:b.evidence.at(-1)!.at};
 }).sort((a,b)=>b.strength-a.strength||Date.parse(b.lastSeenAt)-Date.parse(a.lastSeenAt));
 const selections=events.filter(e=>e.eventType==='select_submit');const latest=selections.at(-1);const facts=latest?selectionFacts(latest):[];
 const changes:Change[]=[];
 // Compare completed requests, not a default filter render or arbitrary score deltas.
 if(selections.length>=2){const before=selectionFacts(selections.at(-2)!);const after=facts;const beforeMap=new Map(before.map(f=>[f.key,f]));
  for(const f of after){const previous=beforeMap.get(f.key);if(previous&&previous.value!==f.value)changes.push({id:'request:'+f.key+':'+latest!.id,title:'Изменил запрос: '+f.label.toLowerCase(),detail:previous.value+' → '+f.value,at:latest!.createdAt,eventIds:[selections.at(-2)!.id,latest!.id]});}
  for(const f of before)if(!after.some(x=>x.key===f.key)&&['city','rooms','delivery','preferences','budget'].includes(f.key))changes.push({id:'removed:'+f.key+':'+latest!.id,title:'Убрал условие из подбора',detail:f.label+': '+f.value,at:latest!.createdAt,eventIds:[selections.at(-2)!.id,latest!.id]});
 }
 for(let i=1;i<events.length;i++){const e=events[i],prev=events[i-1];if(Date.parse(e.createdAt)-Date.parse(prev.createdAt)>=3*DAY)changes.push({id:'return:'+e.id,title:'Вернулся после перерыва',detail:'Перерыв '+Math.floor((Date.parse(e.createdAt)-Date.parse(prev.createdAt))/DAY)+' дн.',at:e.createdAt,eventIds:[prev.id,e.id]});}
 const lastFavorite=events.filter(e=>e.eventType==='favorite_add'&&e.entityId&&favoriteState.get(e.entityId)==='favorite_add').at(-1);
 if(lastFavorite)changes.push({id:'favorite:'+lastFavorite.id,title:'Сохранил интересующий ЖК',detail:properties.get(lastFavorite.entityId!)?.name||text(lastFavorite.metadata.propertyName)||'Объект из истории',at:lastFavorite.createdAt,eventIds:[lastFavorite.id]});
 const feedback=events.filter(e=>e.eventType==='collection_reaction'&&typeof e.metadata.reaction==='string').at(-1);
 if(feedback&&reactionLabels[feedback.metadata.reaction as Reaction])changes.push({id:'feedback:'+feedback.id,title:'Ответил на подборку',detail:(properties.get(feedback.entityId||'')?.name||'ЖК из подборки')+' · '+reactionLabels[feedback.metadata.reaction as Reaction],at:feedback.createdAt,eventIds:[feedback.id]});
 changes.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
 const questions:string[]=[];
 if(!facts.some(f=>f.key==='city'))questions.push('В каком городе рассматривает покупку?');
 if(!facts.some(f=>f.key==='rooms'))questions.push('Сколько комнат нужно?');
 const mortgage=latest?.metadata.purchaseMode==='mortgage'||latest?.metadata.mortgage===true;
 if(!facts.some(f=>f.key==='budget')&&!facts.some(f=>f.key==='payment'))questions.push('Какой бюджет или комфортный ежемесячный платёж?');
 if(mortgage&&!facts.some(f=>f.key==='down'))questions.push('Какой первоначальный взнос доступен?');
 if(mortgage||interests.some(i=>i.dimension==='mortgage'))questions.push('Подтверждено ли право на выбранную ипотечную программу?');
 questions.push('Когда планирует покупку?'); // Delivery date is not a purchase deadline.
 const topProperty=interests.find(i=>i.dimension==='property');
 const briefParts=facts.map(f=>f.label+': '+f.value+'.');
 if(topProperty)briefParts.push('Поведенческий интерес: '+topProperty.label+' ('+topProperty.count+' учтённых сигналов).');
 if(!facts.length)briefParts.unshift('Завершённого подбора пока нет. Пожелания клиента нужно уточнить.');
 if(interests.some(i=>i.dimension==='mortgage'))briefParts.push('Ипотечные расчёты — сценарии, доступность программы не подтверждена.');
 if(feedback&&reactionLabels[feedback.metadata.reaction as Reaction])briefParts.push('Последний ответ на подборку: '+reactionLabels[feedback.metadata.reaction as Reaction]+'. Уточните причину у клиента.');
 const nextAction=questions[0]?questions[0]+(topProperty?' Затем обсудить '+topProperty.label+'.':''):'Уточнить готовность к показу.';
 const recommendations:InterestDNA['recommendations']=[];
 if(latest){const m=latest.metadata;const min=num(m.min),max=num(m.max),down=num(m.down),payment=num(m.payment);const program=text(m.program);
  const financeKnown=mortgage?down!==null&&payment!==null&&!!programNames[program]:min!==null&&max!==null&&max>0;
  if(financeKnown){const criteria:SelectionCriteria={city:specified(m.city)||'Все',rooms:room(m.rooms)||'Все',delivery:specified(m.delivery)||'Не важно',purchaseMode:mortgage?'mortgage':'cash',min:min??0,max:max??Number.MAX_SAFE_INTEGER,downPayment:down??0,monthlyPayment:payment??0,mortgageProgram:program as SelectionCriteria['mortgageProgram'],preferences:text(m.preferences).split(',').filter(x=>!!preferenceNames[x]) as PreferenceId[]};
   const matches=state.properties.filter(p=>p.status==='published').map(p=>({p,match:selectionMatch(p,criteria,state.mortgagePrograms,state.select.weights)})).filter(x=>x.match.eligible).sort((a,b)=>b.match.score-a.match.score||a.p.id.localeCompare(b.p.id));
   for(const {p,match} of matches.slice(0,3))recommendations.push({id:p.id,name:p.name,reasons:match.reasons,tradeoffs:[...match.tradeoffs,...(mortgage?['Доступность программы проверяет банк']:[])]});
  }
 }
 return {version:1,generatedAt:now.toISOString(),windowDays:30,eventCount:events.length,sessionCount:new Set(events.map(e=>e.sessionId)).size,lastSeenAt:events.at(-1)?.createdAt??null,interests,facts,changes:changes.slice(0,6),questions,brief:briefParts.join(' '),nextAction,recommendations};
}
