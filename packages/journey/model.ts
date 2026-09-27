export type Reaction='liked'|'expensive'|'location'|'question'|'none';
export const reactionLabels:Record<Reaction,string>={liked:'Подходит',expensive:'Дорого',location:'Не подходит район',question:'Есть вопрос',none:'Без ответа'};
export type JourneyItem={propertyId:string;note:string;reaction:Reaction;reply:string;respondedAt?:string};
export type Collection={id:string;title:string;items:JourneyItem[];published:boolean;createdAt:string};
export type Showing={id:string;propertyId:string;at:string;status:'requested'|'confirmed'|'completed'|'cancelled';note:string;result:string};
export const showingLabels:Record<Showing['status'],string>={requested:'Ожидает подтверждения',confirmed:'Подтверждён',completed:'Состоялся',cancelled:'Отменён'};
export type Journey={leadId:string;revision:number;collections:Collection[];showings:Showing[];nextStep:{title:string;dueAt:string;done:boolean}|null};
export type JourneyCommand=
 |{type:'collection';id:string;title:string;items:{propertyId:string;note:string}[];published:boolean}
 |{type:'reaction';collectionId:string;propertyId:string;reaction:Reaction;reply:string}
 |{type:'showing';id:string;propertyId:string;at:string;note:string}
 |{type:'showing_status';id:string;status:Showing['status'];result:string}
 |{type:'next_step';title:string;dueAt:string;done:boolean};
export const emptyJourney=(leadId:string):Journey=>({leadId,revision:0,collections:[],showings:[],nextStep:null});
export function applyJourney(current:Journey,command:JourneyCommand,role:'client'|'manager',now=new Date()):Journey{
 const j=structuredClone(current);const c=command;const iso=now.toISOString();
 if(role==='manager'&&c.type==='reaction')throw new Error('Ответ оставляет клиент');
 if(role==='client'&&!['reaction','showing'].includes(c.type))throw new Error('Недостаточно прав');
 if(c.type==='collection'){
  if(!c.items.length||c.items.length>10||new Set(c.items.map(x=>x.propertyId)).size!==c.items.length)throw new Error('Выберите от 1 до 10 разных ЖК');
  const old=j.collections.find(x=>x.id===c.id);
  const entry:Collection={id:c.id,title:c.title,items:c.items.map(i=>({...i,reaction:old?.items.find(x=>x.propertyId===i.propertyId)?.reaction||'none',reply:old?.items.find(x=>x.propertyId===i.propertyId)?.reply||''})),published:c.published,createdAt:old?.createdAt||iso};
  j.collections=[entry,...j.collections.filter(x=>x.id!==c.id)];if(j.collections.length>50)throw new Error('Достигнут лимит подборок');
 }else if(c.type==='reaction'){
  const item=j.collections.find(x=>x.id===c.collectionId&&x.published)?.items.find(x=>x.propertyId===c.propertyId);if(!item)throw new Error('Вариант недоступен');
  Object.assign(item,{reaction:c.reaction,reply:c.reply,respondedAt:iso});
 }else if(c.type==='showing'){
  if(!Number.isFinite(Date.parse(c.at))||Date.parse(c.at)<=now.getTime()||Date.parse(c.at)>now.getTime()+180*86400000)throw new Error('Выберите будущее время в ближайшие 180 дней');
  if(j.showings.some(s=>s.id===c.id))throw new Error('Запрос уже существует');
  if(j.showings.some(s=>s.propertyId===c.propertyId&&['requested','confirmed'].includes(s.status)))throw new Error('По этому ЖК уже есть активный показ');
  if(j.showings.length>=100)throw new Error('Достигнут лимит показов');
  j.showings.push({id:c.id,propertyId:c.propertyId,at:c.at,note:c.note,status:'requested',result:''});
 }else if(c.type==='showing_status'){
  const s=j.showings.find(s=>s.id===c.id);if(!s)throw new Error('Показ не найден');
  const allowed={requested:['confirmed','cancelled'],confirmed:['completed','cancelled'],completed:[],cancelled:[]} as Record<string,string[]>;
  if(!allowed[s.status].includes(c.status))throw new Error('Недопустимый переход показа');
  if(c.status==='confirmed'&&Date.parse(s.at)<=now.getTime())throw new Error('Время показа уже прошло');
  if(c.status==='completed'&&!c.result.trim())throw new Error('Запишите результат показа');
  Object.assign(s,{status:c.status,result:c.result});
 }else{
  if(!c.title.trim()||!Number.isFinite(Date.parse(c.dueAt)))throw new Error('Укажите действие и срок');
  j.nextStep={title:c.title,dueAt:c.dueAt,done:c.done};
 }
 j.revision++;return j;
}
export function clientJourney(j:Journey):Journey{return {...j,collections:j.collections.filter(x=>x.published),showings:j.showings.map(s=>({...s,result:''})),nextStep:null};}
export type Verification={propertyId:string;checkedAt:string;note:string;revision:number;invalidated?:boolean};
export const staleVerification=(v:Verification|undefined,now=Date.now())=>!v||v.invalidated===true||now-Date.parse(v.checkedAt)>7*86400000;
