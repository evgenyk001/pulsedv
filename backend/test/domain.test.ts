import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PROPERTIES } from '../../packages/pulse-data/model';
import { matchesBudgetAndRooms,priceBounds } from '../../packages/domain/propertyMatch';
import { scoreLeadEvents } from '../../packages/lead-engine';
import { verifyTelegramInitData } from '../src/telegramInitData';

test('Бюджет и комнатность относятся к одной планировке',()=>{
 const property=DEFAULT_PROPERTIES.find(p=>p.id==='solnechniy')!;
 assert.equal(matchesBudgetAndRooms(property,{rooms:'2',min:4_000_000,max:8_000_000}),false);
 assert.equal(matchesBudgetAndRooms(property,{rooms:'2',min:4_000_000,max:9_000_000}),true);
 assert.equal(matchesBudgetAndRooms(property,{rooms:'Студия',min:4_000_000,max:8_000_000}),true);
});
test('Границы цен следуют за опубликованным каталогом',()=>{const p={...DEFAULT_PROPERTIES[0],floorplans:[{...DEFAULT_PROPERTIES[0].floorplans[0],priceFrom:30}]};assert.equal(priceBounds([p]).maxPriceRub,30_000_000);});
test('Старые сигналы не держат клиента горячим; удаление из избранного не повышает интерес к ЖК',()=>{
 const now=new Date();const event=(type:string,id:string,at=now.toISOString())=>({eventType:type,entityType:'property',entityId:id,metadata:{},createdAt:at});
 const result=scoreLeadEvents([event('favorite_add','old','2020-01-01T00:00:00Z'),event('favorite_remove','removed'),event('property_view','current')]);
 assert.equal(result.topPropertyId,'current');assert.equal(result.eventCount,2);
});
test('Невалидные Telegram данные отвергаются',()=>{assert.throws(()=>verifyTelegramInitData('auth_date=1&hash=not-a-hash','token'));});

test('PULSE Select: взнос, выбранная программа и веса влияют на результат',async()=>{
 const {bestMortgageFit,selectionMatch}=await import('../../packages/domain/propertyMatch');
 const {DEFAULT_STATE}=await import('../../packages/pulse-data/model');
 assert.equal(bestMortgageFit(5_000_000,0,100_000,DEFAULT_STATE.mortgagePrograms,'farEast').fits,false);
 assert.equal(bestMortgageFit(5_000_000,1_100_000,100_000,DEFAULT_STATE.mortgagePrograms,'farEast').fits,true);
 assert.equal(bestMortgageFit(5_000_000,1_100_000,30_000,DEFAULT_STATE.mortgagePrograms).fits,false,'Льготная программа не выбирается автоматически');
 const p={...DEFAULT_PROPERTIES[0],city:'Владивосток',floorplans:[{roomLabel:'3',priceFrom:5,areaFrom:70,areaTo:80,imageUrl:null,sortOrder:0},{roomLabel:'3',priceFrom:9,areaFrom:90,areaTo:100,imageUrl:null,sortOrder:1}]};
 const c={city:'Артём',rooms:'3+',delivery:'Не важно',purchaseMode:'cash' as const,min:8_000_000,max:10_000_000,downPayment:0,monthlyPayment:0,preferences:[]};
 const city=selectionMatch(p,c,DEFAULT_STATE.mortgagePrograms,{city:100,budget:0,rooms:0,delivery:0,preferences:0});
 const budget=selectionMatch(p,c,DEFAULT_STATE.mortgagePrograms,{city:0,budget:100,rooms:0,delivery:0,preferences:0});
 assert.equal(city.score,0);assert.equal(budget.score,100);assert.equal(budget.price,9_000_000);
 assert.equal(selectionMatch(p,{...c,city:'Владивосток'},DEFAULT_STATE.mortgagePrograms,DEFAULT_STATE.select.weights).eligible,true);
});

test('Журнал различает копирование, отправку и старые неподтверждённые события',async()=>{
 const {describeEvent}=await import('../../apps/control-center/src/activityCopy');
 const {DEFAULT_STATE}=await import('../../packages/pulse-data/model');
 const event={id:'1',sessionId:'s',userId:null,eventType:'property_share',entityType:'property',entityId:DEFAULT_PROPERTIES[0].id,metadata:{},createdAt:new Date().toISOString()};
 assert.match(describeEvent(event,DEFAULT_STATE).title,/Нажал/);
 assert.match(describeEvent({...event,metadata:{method:'clipboard',outcome:'completed'}},DEFAULT_STATE).title,/Скопировал/);
 const copy=describeEvent({...event,eventType:'mortgage_calculated',metadata:{program:'family',price:5_000_000,down:1_100_000,payment:25_000,rate:6,years:25}},DEFAULT_STATE);
 assert.match(copy.detail,/Семейная/);assert.match(copy.detail,/взнос/);assert.match(copy.detail,/платёж/);
});
