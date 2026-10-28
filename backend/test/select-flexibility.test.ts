import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_STATE,type PulseProperty} from '../../packages/pulse-data/model';
import {selectionMatch,matchesPreference} from '../../packages/domain/propertyMatch';
import {formatPropertyMillions,propertyPriceLabel,propertyPricePerSqm} from '../../packages/domain/propertyPresentation';
import {housingClassMatches,mentionedHousingClasses} from '../../packages/domain/housingClass';
import {editStartingPrice,totalFromSquareMetre,squareMetreFromTotal} from '../../packages/domain/propertyPricing';
import {catalogPropertySchema} from '../src/validation';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
import {getCatalogProperty,listCatalog,upsertCatalogProperty} from '../src/catalogRepository';

const property=():PulseProperty=>({...structuredClone(DEFAULT_STATE.properties[0]),name:'Тестовый ЖК',city:'Уссурийск',className:'Бизнес',description:'',tags:[],features:[],floorplans:[]});
const criteria={city:'Уссурийск',rooms:'Все',delivery:'Не важно',purchaseMode:'cash' as const,min:0,max:20_000_000,downPayment:0,monthlyPayment:0,preferences:[]};
const match=(p:PulseProperty,c:Partial<Parameters<typeof selectionMatch>[1]>={})=>selectionMatch(p,{...criteria,...c},DEFAULT_STATE.mortgagePrograms,DEFAULT_STATE.select.weights);

test('Compact prices round presentation only; independent minima never invent a square-metre price',()=>{
 assert.equal(formatPropertyMillions(6.05706),'6,1');assert.equal(formatPropertyMillions(5.1972),'5,2');
 assert.equal(propertyPriceLabel(6.05706).replace(/\s/g,' '),'от 6 057 060 ₽');
 const p=property();p.priceFrom=6.3;p.projectDetails={commissioningDate:null,totalApartments:null,availableApartments:null,areaFrom:38,areaTo:115.1};
 assert.equal(propertyPricePerSqm(p),null);
 p.floorplans=[{roomLabel:'1',areaFrom:38,areaTo:75.8,priceFrom:6.3,imageUrl:null,sortOrder:0}];
 assert.equal(propertyPricePerSqm(p),null);
 p.projectDetails.pricePerSqmFromRub=165800;assert.equal(propertyPricePerSqm(p),165800);
});

test('Two-way entry preserves exact totals and pairs the square-metre price with a reference apartment',()=>{
 let p=editStartingPrice(property(),{kind:'unit',value:185000});
 assert.equal(p.priceFrom,0);assert.equal(p.projectDetails?.pricePerSqmFromRub,185000);
 p=editStartingPrice(p,{kind:'area',value:38.6});assert.equal(p.priceFrom,7.141);
 p=editStartingPrice(p,{kind:'area',value:40});assert.equal(p.priceFrom,7.4);
 p=editStartingPrice(p,{kind:'total',value:6057060});assert.equal(p.priceFrom,6.05706);assert.equal(p.projectDetails?.pricePerSqmFromRub,151426.5);
 const restored=JSON.parse(JSON.stringify(p));p=editStartingPrice(restored,{kind:'area',value:50});
 assert.equal(p.priceFrom,6.05706);assert.equal(p.projectDetails?.pricePerSqmFromRub,121141.2);
 assert.equal(catalogPropertySchema.safeParse(p).success,true);
 assert.equal(totalFromSquareMetre(185000,38.6),7141000);
 for(const bad of [0,-1,NaN,Infinity])assert.equal(totalFromSquareMetre(bad,40),null);
 assert.equal(totalFromSquareMetre(1000000000,10000),null);assert.equal(squareMetreFromTotal(1000000,null),null);
});

test('Classes remain distinct; class, area, rooms, finish and budget must match together',()=>{
 assert.equal(housingClassMatches('Эконом',['Стандарт']),true);
 assert.equal(housingClassMatches('Комфорт+',['Комфорт']),false);
 assert.deepEqual(mentionedHousingClasses('хочу бизнес плюс в Уссурийске',['Бизнес','Бизнес+','Комфорт']),['Бизнес+']);
 const p=property();p.floorplans=[
  {roomLabel:'1',areaFrom:40,areaTo:40,priceFrom:5,priceTo:5,isExact:true,finishType:'rough',imageUrl:null,sortOrder:0},
  {roomLabel:'2',areaFrom:80,areaTo:80,priceFrom:8,priceTo:8,isExact:true,finishType:'finished',imageUrl:null,sortOrder:1},
 ];
 assert.equal(match(p,{housingClasses:['Бизнес'],rooms:'2',areaFrom:70,areaTo:90,finishType:'finished'}).eligible,true);
 assert.equal(match(p,{housingClasses:['Комфорт']}).eligible,false);
 assert.equal(match(p,{rooms:'2',areaFrom:35,areaTo:50}).eligible,false);
 assert.equal(match(p,{rooms:'2',finishType:'rough'}).eligible,false);
 assert.equal(match(p,{rooms:'2',max:7_000_000}).eligible,false);
 assert.equal(propertyPricePerSqm(p),100000);
});

test('Description matching respects explicit negatives and structured finish/parking data',()=>{
 const p=property();p.description='Квартиры без отделки. Парковка не предусмотрена. Детская площадка и школа рядом.';
 assert.equal(matchesPreference(p,'finish'),false);assert.equal(matchesPreference(p,'parking'),false);assert.equal(matchesPreference(p,'family'),true);
 p.description='Паркинг. White Box и ремонт.';p.projectDetails={commissioningDate:null,totalApartments:null,availableApartments:null,parkingSpaces:0,finishes:['rough']};
 assert.equal(matchesPreference(p,'parking'),false);assert.equal(matchesPreference(p,'finish'),false);
 p.projectDetails.finishes=['white_box'];assert.equal(matchesPreference(p,'finish'),true);
});

test('All applicable mortgage plans are checked, including a larger apartment with a higher loan limit',()=>{
 const p=property();p.floorplans=[
  {roomLabel:'2',areaFrom:60,areaTo:60,priceFrom:10,imageUrl:null,sortOrder:0},
  {roomLabel:'2',areaFrom:70,areaTo:70,priceFrom:10.1,imageUrl:null,sortOrder:1},
 ];
 const result=match(p,{rooms:'2',purchaseMode:'mortgage',downPayment:2_100_000,monthlyPayment:100_000,mortgageProgram:'farEast'});
 assert.equal(result.eligible,true);assert.equal(result.price,10100000);
 assert.equal(match({...p,floorplans:[p.floorplans[0]]},{rooms:'2',purchaseMode:'mortgage',downPayment:2_100_000,monthlyPayment:100_000,mortgageProgram:'farEast'}).eligible,false);
});

test('Unknown room prices remain unconfirmed rather than becoming an eligible zero-price apartment',()=>{
 const p=property();p.priceFrom=5;
 assert.equal(match(p,{rooms:'1'}).eligible,false);assert.match(match(p,{rooms:'1'}).tradeoffs.join(' '),/уточнить/);
 assert.equal(match(p).eligible,true);p.priceFrom=0;assert.equal(match(p).eligible,false);
});

test('Square-metre data survives storage and lightweight cards derive only exact apartment prices',async()=>{
 const db=await testDatabase();try{
  await migrate(db);const p=property();p.id='pricing-pair';p.priceFrom=7.4;
  p.projectDetails={commissioningDate:null,totalApartments:null,availableApartments:null,startingApartmentArea:40,pricePerSqmFromRub:185000,priceInputMode:'per_sqm'};
  await db.transaction(sql=>upsertCatalogProperty(sql,p));
  assert.deepEqual((await getCatalogProperty(db,p.id,'any'))?.projectDetails,p.projectDetails);
  p.projectDetails={commissioningDate:null,totalApartments:null,availableApartments:null};
  p.floorplans=[{roomLabel:'1',areaFrom:40,areaTo:40,priceFrom:6,priceTo:6,isExact:true,imageUrl:null,sortOrder:0}];
  await db.transaction(sql=>upsertCatalogProperty(sql,p));
  const card=(await listCatalog(db,{ids:[p.id],view:'card'})).items[0];assert.equal(card.floorplans.length,0);assert.equal(propertyPricePerSqm(card),150000);
  p.floorplans[0].areaTo=60;p.floorplans[0].isExact=false;await db.transaction(sql=>upsertCatalogProperty(sql,p));
  assert.equal(propertyPricePerSqm((await listCatalog(db,{ids:[p.id],view:'card'})).items[0]),null);
 }finally{await db.close()}
});
