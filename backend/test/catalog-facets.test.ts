import {test} from 'node:test';
import assert from 'node:assert/strict';
import {catalogFacets,publishedCatalogFacets} from '../../packages/domain/catalogFacets';
import {DEFAULT_PROPERTIES} from '../../packages/pulse-data/model';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
import {catalogMeta,upsertCatalogProperty,listCatalog} from '../src/catalogRepository';

test('Catalog facets normalize, deduplicate and sort actual rooms and delivery years without invented choices',()=>{
 assert.deepEqual(catalogFacets(['2 комн.','Студия','1','2','10','3+','4-комнатная'],['IV кв. 2029','2027','2027','Сдан в 2025','срок уточняется']),{rooms:['Студия','1','2','3+','4','10'],deliveries:['Сдан','2025','2027','2029']});
 assert.deepEqual(publishedCatalogFacets([]),{rooms:[],deliveries:[]});
 assert.deepEqual(catalogFacets(['','Уточняется'],['не сдан, срок уточняется']),{rooms:[],deliveries:[]});
});
test('Public metadata sees the full catalog and follows publish, archive and plan edits',async t=>{
 const db=await testDatabase();await migrate(db);t.after(()=>db.close());
 await db.query('delete from catalog_properties');
 const make=(id:string,status:'published'|'draft'|'archived',room:string,delivery:string)=>({...structuredClone(DEFAULT_PROPERTIES[0]),id,status,delivery,floorplans:[{id:id+'-plan',roomLabel:room,areaFrom:40,areaTo:40,priceFrom:6,imageUrl:null,sortOrder:0}]});
 const first=make('facets-one','published','1','2027'),second=make('facets-two','published','4+','IV кв. 2032');
 for(const p of [first,second,make('hidden-draft','draft','8','2040'),make('hidden-archive','archived','9','2041')])await upsertCatalogProperty(db,p);
 const meta=await catalogMeta(db);assert.deepEqual(meta.rooms,['1','4+']);assert.deepEqual(meta.deliveries,['2027','2032']);
 const page=await listCatalog(db,{limit:1});assert.equal(page.items.length,1);assert.equal(meta.total,2);
 assert.equal((await listCatalog(db,{rooms:'4+'})).total,1);
 second.status='archived';await upsertCatalogProperty(db,second);first.delivery='Сдан';first.floorplans[0].roomLabel='студия';await upsertCatalogProperty(db,first);
 const updated=await catalogMeta(db);assert.deepEqual(updated.rooms,['Студия']);assert.deepEqual(updated.deliveries,['Сдан']);
 assert.deepEqual(publishedCatalogFacets([first,second]),{rooms:updated.rooms,deliveries:updated.deliveries});
});
