import {test} from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
import {upsertCatalogProperty,getCatalogProperty,listCatalog,catalogMeta} from '../src/catalogRepository';
import {catalogPropertySchema} from '../src/validation';
import {DEFAULT_STATE,type PulseProperty} from '../../packages/pulse-data/model';
import {planPriceLabel,propertyMortgageLink} from '../../packages/domain/propertyPresentation';
import {matchesBudgetAndRooms} from '../../packages/domain/propertyMatch';

test('Exact and ranged plan prices persist, filter by overlap and keep mortgage starting amounts',async()=>{
 const exact={...DEFAULT_STATE.properties[0].floorplans[0],id:'exact',isExact:true,areaFrom:47.52,areaTo:47.52,priceFrom:6.3,priceTo:6.3};
 const range={...exact,id:'range',isExact:false,areaFrom:48,areaTo:70,priceFrom:7,priceTo:10};
 const property:PulseProperty={...DEFAULT_STATE.properties[0],id:'plan-prices',floorplans:[exact,range],documents:[]};
 assert.equal(catalogPropertySchema.safeParse(property).success,true);
 for(const bad of [{...exact,priceTo:5},{...exact,areaTo:48},{...range,priceFrom:null}])assert.equal(catalogPropertySchema.safeParse({...property,floorplans:[bad]}).success,false);
 assert.match(planPriceLabel(exact),/^6\s300\s000 ₽$/);
 assert.match(planPriceLabel(range),/^7\s000\s000–10\s000\s000 ₽$/);
 assert.match(planPriceLabel({...range,priceTo:null}),/^от 7\s000\s000 ₽$/);
 assert.match(propertyMortgageLink(property,range),/price=7000000/);
 assert.equal(matchesBudgetAndRooms(property,{rooms:'1',min:8_000_000,max:9_000_000}),true);
 assert.equal(matchesBudgetAndRooms(property,{rooms:'1',min:11_000_000,max:12_000_000}),false);
 const db=await testDatabase();try{
  await migrate(db);await migrate(db);await db.transaction(sql=>upsertCatalogProperty(sql,property));
  const restored=(await getCatalogProperty(db,property.id,'any'))!;
  assert.equal(restored.floorplans[0].priceTo,6.3);assert.equal(restored.floorplans[0].isExact,true);
  assert.equal(catalogPropertySchema.safeParse(restored).success,true);
  assert.equal((await listCatalog(db,{min:8_000_000,max:9_000_000})).total,1);
  assert.equal((await listCatalog(db,{min:11_000_000,max:12_000_000})).total,0);
  assert.equal((await catalogMeta(db)).maxPriceRub,10_000_000);
 }finally{await db.close()}
});

test('Prices by finish keep their own upper bound and unknown prices stay unknown',async()=>{
 const plan={...DEFAULT_STATE.properties[0].floorplans[0],id:'finish',finishOptions:[{finishType:'rough' as const,priceFrom:7,priceTo:8},{finishType:'finished' as const,priceFrom:9,priceTo:11}]};
 const property={...DEFAULT_STATE.properties[0],id:'finish-price-range',floorplans:[plan],documents:[]};
 assert.match(planPriceLabel(plan,'finished'),/^9\s000\s000–11\s000\s000 ₽$/);
 assert.equal(planPriceLabel(plan,'white_box'),'Цена уточняется');
 const db=await testDatabase();try{
  await migrate(db);await db.transaction(sql=>upsertCatalogProperty(sql,property));
  const restored=(await getCatalogProperty(db,property.id,'any'))!;
  assert.deepEqual(restored.floorplans[0].finishOptions,plan.finishOptions);
  assert.equal(restored.floorplans[0].priceFrom,7);assert.equal(restored.floorplans[0].priceTo,11);
  assert.equal(catalogPropertySchema.safeParse(restored).success,true);
 }finally{await db.close()}
});
