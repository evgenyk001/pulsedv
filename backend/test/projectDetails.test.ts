import {test} from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
import {upsertCatalogProperty,getCatalogProperty,listCatalog} from '../src/catalogRepository';
import {projectDetailsSchema,catalogPropertySchema} from '../src/validation';
import {DEFAULT_STATE,type ApartmentFinish} from '../../packages/pulse-data/model';

test('Project dates and inventory are optional, validated and persist in catalog views',async()=>{
 const details={commissioningDate:'2027-12-31',totalApartments:420,availableApartments:77};
 assert.deepEqual(projectDetailsSchema.parse(details),details);
 for(const bad of [{...details,commissioningDate:'2027-02-31'},{...details,totalApartments:-1},{...details,availableApartments:421},{...details,availableApartments:1.5}])assert.equal(projectDetailsSchema.safeParse(bad).success,false);
 assert.equal(catalogPropertySchema.safeParse(DEFAULT_STATE.properties[0]).success,true);
 const db=await testDatabase();try{
  await migrate(db);await migrate(db);
  const property={...DEFAULT_STATE.properties[0],id:'details-fixture',projectDetails:details,documents:[]};
  await db.transaction(sql=>upsertCatalogProperty(sql,property));
  assert.deepEqual((await getCatalogProperty(db,property.id,'any'))?.projectDetails,details);
  for(const view of ['card','match','full'] as const)assert.deepEqual((await listCatalog(db,{ids:[property.id],view})).items[0].projectDetails,details);
  await db.transaction(sql=>upsertCatalogProperty(sql,{...property,projectDetails:{...details,availableApartments:0}}));
  assert.equal((await getCatalogProperty(db,property.id,'any'))?.projectDetails?.availableApartments,0);
 }finally{await db.close()}
});

test('Apartment finish options persist and do not alter unknown finish prices',async()=>{
 const source=DEFAULT_STATE.properties[0];
 const withOffers={...source,id:'finished-fixture',projectDetails:{commissioningDate:null,totalApartments:null,availableApartments:null,finishes:['rough','white_box','finished'] as ApartmentFinish[]},floorplans:[{...source.floorplans[0],finishOptions:[{finishType:'rough' as const,priceFrom:7.8},{finishType:'white_box' as const,priceFrom:8.25},{finishType:'finished' as const,priceFrom:null}]}],documents:[]};
 assert.equal(catalogPropertySchema.safeParse(withOffers).success,true);
 assert.equal(catalogPropertySchema.safeParse({...withOffers,floorplans:[{...withOffers.floorplans[0],finishOptions:[withOffers.floorplans[0].finishOptions[0],withOffers.floorplans[0].finishOptions[0]]}]}).success,false);
 const db=await testDatabase();try{
  await migrate(db);
  await db.transaction(sql=>upsertCatalogProperty(sql,withOffers));
  const restored=await getCatalogProperty(db,'finished-fixture','any');
  assert.deepEqual(restored?.floorplans[0].finishOptions,withOffers.floorplans[0].finishOptions);
  assert.equal(restored?.floorplans[0].priceFrom,7.8);
  const changed={...withOffers,floorplans:[{...withOffers.floorplans[0],finishOptions:[{finishType:'rough' as const,priceFrom:8.4},{finishType:'white_box' as const,priceFrom:8.25},{finishType:'finished' as const,priceFrom:null}]}]};
  await db.transaction(sql=>upsertCatalogProperty(sql,changed));
  assert.equal((await getCatalogProperty(db,'finished-fixture','any'))?.floorplans[0].priceFrom,8.25);
  assert.deepEqual(restored?.projectDetails?.finishes,['rough','white_box','finished']);
 }finally{await db.close()}
});
