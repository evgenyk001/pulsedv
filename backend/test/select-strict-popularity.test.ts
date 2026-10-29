import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DEFAULT_STATE,type PulseProperty,type PulseEvent} from '../../packages/pulse-data/model';
import {selectionMatch,matchesPreference} from '../../packages/domain/propertyMatch';
import {rankPopularProperties} from '../../packages/domain/catalogPopularity';
import {featuredCatalog,upsertCatalogProperty} from '../src/catalogRepository';
import {safeMetadata} from '../src/validation';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
import {createApp} from '../src/app';
import {readConfig} from '../src/config';
const property=(id:string,district='Центр'):PulseProperty=>({...structuredClone(DEFAULT_STATE.properties[0]),id,name:id,city:'Уссурийск',district,description:'10 минут до центра. Семейная ипотека.',features:[],tags:[],priceFrom:6,delivery:'2 кв. 2027',floorplans:[{roomLabel:'1',areaFrom:40,areaTo:40,isExact:true,priceFrom:6,priceTo:6,finishType:'rough',sortOrder:0,imageUrl:null}]});
const criteria={city:'Уссурийск',district:'Центр',rooms:'Все',delivery:'Не важно',purchaseMode:'cash' as const,min:0,max:20000000,downPayment:0,monthlyPayment:0,preferences:[]};
const match=(p:PulseProperty,c:Partial<Parameters<typeof selectionMatch>[1]>={})=>selectionMatch(p,{...criteria,...c},DEFAULT_STATE.mortgagePrograms,DEFAULT_STATE.select.weights);
test('Six projects: only the two central projects pass; copy about proximity cannot override their district',()=>{
 const projects=['Центр','Центр','Водоканал','Семь Ветров','Междуречье','Ленинградская'].map((district,i)=>property(String(i),district));
 assert.deepEqual(projects.filter(p=>match(p).eligible).map(p=>p.id),['0','1']);
 assert.deepEqual(projects.filter(p=>match(p,{district:null,preferences:['center']}).eligible).map(p=>p.id),['0','1']);
 assert.equal(match(projects[2],{districtRequired:false}).eligible,true);
 assert.ok(match(projects[0],{districtRequired:false}).score>match(projects[2],{districtRequired:false}).score);
 assert.equal(match({...projects[0],status:'draft'}).eligible,false);
 assert.equal(match({...projects[0],district:' Центральный район '}).eligible,true);
 assert.equal(matchesPreference(projects[2],'family'),false);
});
test('Delivery and selected features are required by default; only an explicit preferred feature permits a compromise',()=>{
 const p=property('strict');
 assert.equal(match(p,{delivery:'2028'}).eligible,false);
 assert.equal(match(p,{preferences:['parking']}).eligible,false);
 assert.equal(match(p,{preferences:['parking'],requiredPreferences:[]}).eligible,true);
 p.projectDetails={commissioningDate:null,totalApartments:null,availableApartments:null,parkingSpaces:1};
 assert.equal(match(p,{preferences:['parking']}).eligible,true);
});
test('Area, price and requested finish must be confirmed together; broad groups cannot prove a narrower area',()=>{
 const p=property('same-plan');p.floorplans[0].finishOptions=[{finishType:'rough',priceFrom:6,priceTo:6},{finishType:'finished',priceFrom:9,priceTo:9}];
 assert.equal(match(p,{max:7000000,preferences:['finish']}).eligible,false);
 assert.equal(match(p,{max:10000000,preferences:['finish']}).price,9000000);
 p.floorplans[0].priceFrom=null;assert.equal(match(p,{max:10000000,preferences:['finish']}).eligible,true);
 p.floorplans[0].isExact=false;p.floorplans[0].areaTo=75;
 assert.equal(match(p,{areaFrom:50,areaTo:60}).eligible,false);
 assert.equal(match(p,{areaFrom:35,areaTo:80}).eligible,true);
 assert.deepEqual(safeMetadata({district:'Центр',districtRequired:false,requiredPreferences:'parking'}),{district:'Центр',districtRequired:false,requiredPreferences:'parking'});
});
test('Required sea views use affirmative view information, not a street name or proximity',()=>{
 const p={...property('sea'),city:'Владивосток',district:'Морская улица',description:'До моря 10 минут. Квартиры без вида на море.'};
 assert.equal(matchesPreference(p,'sea'),false);p.features=[{label:'Вид на море',icon:'waves',sortOrder:0}];assert.equal(matchesPreference(p,'sea'),true);
});
test('Popular projects use distinct viewers, recency and city; refresh spam, future events and drafts do not win',async()=>{
 const db=await testDatabase();await migrate(db);
 const app=await createApp(db,readConfig({NODE_ENV:'test',DATABASE_URL:'unused',PUBLIC_ORIGIN:'http://localhost:8080'}));await app.ready();
 try{
  const projects=[property('quiet'),property('popular'),property('repeat'),{...property('other-city'),city:'Владивосток'},{...property('draft'),status:'draft' as const},property('old'),property('future')];
  for(const p of projects)await db.transaction(sql=>upsertCatalogProperty(sql,p));
  const sessions=Array.from({length:5},()=>randomUUID());
  for(const id of sessions)await db.query('insert into sessions(id) values($1)',[id]);
  const user=randomUUID();await db.query('insert into app_users(id) values($1)',[user]);
  const events:PulseEvent[]=[];
  const add=async(id:string,session:number,days=0,userId:string|null=null)=>{
   const event={id:randomUUID(),sessionId:sessions[session],userId,eventType:'property_view',entityType:'property',entityId:id,metadata:{},createdAt:new Date(Date.now()-days*86400000).toISOString()};events.push(event);
   await db.query('insert into user_events(id,idempotency_key,session_id,user_id,event_type,entity_type,entity_id,occurred_at) values($1::uuid,$1::text,$2,$3,$4,$5,$6,$7)',[event.id,event.sessionId,userId,event.eventType,event.entityType,id,event.createdAt]);
  };
  for(let i=0;i<12;i++)await add('repeat',0);
  await add('popular',1);await add('popular',2);await add('popular',3,0,user);await add('popular',4,0,user);
  for(let i=0;i<5;i++)await add('other-city',i);
  await add('old',0,31);await add('future',0,-1);await add('draft',0);
  const expected=rankPopularProperties(projects,events,'Уссурийск').slice(0,3).map(p=>p.id);
  assert.deepEqual(expected.slice(0,2),['popular','repeat']);
  assert.deepEqual((await featuredCatalog(db,'Уссурийск',3)).map(p=>p.id),expected);
  const response=await app.inject({method:'GET',url:'/api/v1/public/catalog/featured?city='+encodeURIComponent('Уссурийск')+'&limit=3'});
  assert.equal(response.statusCode,200);assert.deepEqual(response.json().items.map((p:PulseProperty)=>p.id),expected);
  assert.equal(response.payload.includes(sessions[0]),false);assert.equal(response.payload.includes(user),false);
  assert.equal((await featuredCatalog(db,'Нет такого города',3)).length,0);
  assert.equal((await app.inject('/api/v1/public/catalog/featured?limit=999')).statusCode,400);
 }finally{await app.close();await db.close()}
});
