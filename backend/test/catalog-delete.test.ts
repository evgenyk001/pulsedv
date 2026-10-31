import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
import {createApp} from '../src/app';
import {readConfig} from '../src/config';
import {hashPassword} from '../src/security';
import {upsertCatalogProperty} from '../src/catalogRepository';
import {DEFAULT_PROPERTIES} from '../../packages/pulse-data/model';

test('Catalog deletion is owner-only, preserves client history and shared files, and removes project children',async t=>{
 const db=await testDatabase();await migrate(db);const root=await mkdtemp(join(tmpdir(),'pulse-delete-'));
 const config=readConfig({NODE_ENV:'test',DATABASE_URL:'unused',PUBLIC_ORIGIN:'http://localhost:8080',MEDIA_ROOT:root});const app=await createApp(db,config);await app.ready();
 t.after(async()=>{await app.close();await db.close();await rm(root,{recursive:true,force:true})});
 const headers={origin:config.PUBLIC_ORIGIN,'content-type':'application/json'},password='catalog-delete-test-password',hash=await hashPassword(password);
 const cookies:Record<string,{pulse_control:string}>={};
 for(const role of ['owner','admin','manager']){
  await db.query('insert into team_members(name,email,password_hash,role) values($1,$2,$3,$1)',[role,role+'@delete.test',hash]);
  const response=await app.inject({method:'POST',url:'/api/v1/control/login',headers,payload:{email:role+'@delete.test',password}});assert.equal(response.statusCode,200,response.body);cookies[role]={pulse_control:response.cookies[0].value};
 }
 await mkdir(join(root,'images'));await writeFile(join(root,'images','shared.png'),'shared file');
 const p={...structuredClone(DEFAULT_PROPERTIES[0]),id:'delete-test-project',coverImageUrl:'/media/images/shared.png'};
 await upsertCatalogProperty(db,p);await upsertCatalogProperty(db,{...structuredClone(p),id:'keep-test-project'});
 const lead=(await db.query("insert into leads(source,name,phone,property_id,request_context) values('property','Клиент','+79990000493',$1,$2::jsonb) returning id",[p.id,JSON.stringify({propertyName:p.name})])).rows[0].id;
 const journey={leadId:lead,selection:[p.id],note:'Не удалять историю клиента'};const message={id:randomUUID(),text:'Переписка сохраняется',sender:'manager'};
 await db.query('insert into client_journeys(lead_id,document) values($1,$2::jsonb)',[lead,JSON.stringify(journey)]);
 await db.query('insert into journey_messages(id,lead_id,document) values($1,$2,$3::jsonb)',[message.id,lead,JSON.stringify(message)]);
 const url='/api/v1/control/catalog/'+p.id;
 assert.equal((await app.inject({method:'DELETE',payload:{},url,headers})).statusCode,401);
 for(const role of ['admin','manager'])assert.equal((await app.inject({method:'DELETE',payload:{},url,headers,cookies:cookies[role]})).statusCode,403);
 const deleted=await app.inject({method:'DELETE',payload:{},url,headers,cookies:cookies.owner});assert.equal(deleted.statusCode,200,deleted.body);
 assert.equal((await app.inject('/api/v1/public/catalog/'+p.id)).statusCode,404);
 assert.equal((await app.inject('/api/v1/public/catalog/keep-test-project')).statusCode,200);
 for(const table of ['catalog_property_images','catalog_property_floorplans','catalog_property_features','catalog_property_documents'])assert.equal(Number((await db.query('select count(*) as n from '+table+' where property_id=$1',[p.id])).rows[0].n),0);
 assert.equal((await db.query('select property_id from leads where id=$1',[lead])).rows[0].property_id,p.id);
 assert.deepEqual((await db.query('select document from client_journeys where lead_id=$1',[lead])).rows[0].document,journey);
 assert.deepEqual((await db.query('select document from journey_messages where id=$1',[message.id])).rows[0].document,message);
 assert.equal(await readFile(join(root,'images','shared.png'),'utf8'),'shared file');
 assert.equal(Number((await db.query("select count(*) as n from audit_log where action='catalog.delete' and entity_id=$1",[p.id])).rows[0].n),1);
 assert.equal((await app.inject({method:'DELETE',payload:{},url,headers,cookies:cookies.owner})).statusCode,404);
});
