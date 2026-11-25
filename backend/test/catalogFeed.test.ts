import {test} from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
import {getCatalogProperty,listCatalog,upsertCatalogProperty} from '../src/catalogRepository';
import {syncApartmentFeed} from '../src/catalogFeed';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';

const projectName='Жилой комплекс Атриум';
const offer=(id:number,floor:number,price:number)=>`<offer internal-id="${id}">
  <building-name>${projectName}</building-name><location><locality-name>Уссурийск</locality-name></location>
  <type>продажа</type><category>квартира</category><rooms>1</rooms>
  <area><value>42.5</value></area><price><value>${price}</value><currency>RUB</currency></price>
  <apartment>${id}</apartment><building-section>Блок 5, подъезд 1</building-section>
  <floor>${floor}</floor><floors-total>20</floors-total>
  <image tag="plan">https://plan7.ru/plan.png</image>
</offer>`;
const feed=(hour:number,...offers:string[])=>`<realty-feed xmlns="http://webmaster.yandex.ru/schemas/feed/realty/2010-06">
  <generation-date>2026-11-24T${hour}:00:00+03:00</generation-date>${offers.join('')}
</realty-feed>`;

test('Feed preview, availability, price changes and failures preserve manual rows and lot IDs',async(t)=>{
  let xml=feed(10,offer(71,7,6_500_000),offer(72,8,6_800_000));
  t.mock.method(globalThis,'fetch',async()=>new Response(xml));
  const db=await testDatabase();
  const property={...DEFAULT_STATE.properties[0],id:'atrium-test',city:'Уссурийск'};
  const config={propertyId:property.id,projectName,url:'https://plan7.ru/storage/cat_feeds/farpost/710/save.xml'};
  try{
    await migrate(db);
    await db.transaction(sql=>upsertCatalogProperty(sql,property));
    assert.equal((await syncApartmentFeed(db,config)).added,2);
    assert.equal((await getCatalogProperty(db,property.id))?.floorplans.length,property.floorplans.length);
    await syncApartmentFeed(db,config,true);
    const first=(await getCatalogProperty(db,property.id))!;
    assert.equal(first.floorplans.length,2);
    assert.equal(first.priceFrom,6.5);
    assert.equal(first.projectDetails?.availableApartments,2);
    assert.equal(first.apartmentFeed,undefined);
    assert.equal(first.floorplans.find(plan=>plan.apartment?.floor===7)?.priceFrom,6.5);
    const removedId=first.floorplans.find(plan=>plan.apartment?.number==='71')?.id;
    xml=feed(11,offer(72,8,7_100_000));
    const result=await syncApartmentFeed(db,config,true);
    assert.deepEqual([result.updated,result.hidden],[1,1]);
    assert.equal((await getCatalogProperty(db,property.id))?.priceFrom,7.1);
    assert.equal((await listCatalog(db,{max:7_000_000,ids:[property.id]})).total,0);
    xml=feed(12);
    await assert.rejects(syncApartmentFeed(db,config,true));
    assert.equal((await getCatalogProperty(db,property.id))?.floorplans.length,1);
    const editing=(await getCatalogProperty(db,property.id,'any'))!;
    assert.equal(editing.floorplans.length,property.floorplans.length);
    assert.ok(editing.apartmentFeed?.error);
    xml=feed(13,offer(71,7,6_600_000));
    await syncApartmentFeed(db,config,true);
    assert.equal((await getCatalogProperty(db,property.id))?.floorplans[0].id,removedId);
  }finally{await db.close();}
});
