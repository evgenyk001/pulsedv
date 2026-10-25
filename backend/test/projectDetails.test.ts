import {test} from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
import {upsertCatalogProperty,getCatalogProperty,listCatalog} from '../src/catalogRepository';
import {projectDetailsSchema,catalogPropertySchema} from '../src/validation';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';

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
