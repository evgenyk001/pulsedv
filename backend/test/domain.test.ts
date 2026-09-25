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
