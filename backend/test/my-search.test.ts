import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
import {createApp} from '../src/app';
import {readConfig} from '../src/config';
import {upsertCatalogProperty} from '../src/catalogRepository';
import {scanSearchProfiles,mergeSearch} from '../src/searchRoutes';
import {outboxRepository} from '../src/outboxRepository';
import {processNotificationOutbox} from '../src/notificationWorker';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';
import {searchMatches,type SearchSettings} from '../../packages/my-search';
const settings:SearchSettings={criteria:{q:'',city:'Все',rooms:'Все',min:0,max:30000000,delivery:'Любой',sea:false,purchaseMode:'any'},watchFavorites:true,telegram:false};
async function fixture(t:any){
 const db=await testDatabase();await migrate(db);const config=readConfig({NODE_ENV:'test',DATABASE_URL:'unused',PUBLIC_ORIGIN:'http://localhost:8080'});const app=await createApp(db,config);await app.ready();t.after(async()=>{await app.close();await db.close()});
 const headers={origin:config.PUBLIC_ORIGIN,'content-type':'application/json'};
 const session=(await app.inject({method:'POST',url:'/api/v1/auth/session',headers,payload:{source:'test'}})).json();const auth={...headers,authorization:'Bearer '+session.accessToken};
 const session2=(await app.inject({method:'POST',url:'/api/v1/auth/session',headers,payload:{source:'test'}})).json();const auth2={...headers,authorization:'Bearer '+session2.accessToken};
 const sid=session.sessionId;
 const user=(await db.query('insert into app_users(telegram_user_id) values(123456) returning id')).rows[0].id;
 const owner=(await db.query("insert into team_members(name,email,password_hash,role,telegram_user_id) values('Owner','owner@test','not-a-password','owner',9000) returning id")).rows[0].id;
 await db.query("insert into team_members(name,email,password_hash,role,telegram_user_id) values('Manager','manager@test','not-a-password','manager',9001)");
 const p={...DEFAULT_STATE.properties[0],id:'watched',name:'ЖК Проверка',status:'published' as const,floorplans:[{id:'plan1',roomLabel:'2',areaFrom:50,areaTo:60,priceFrom:7,imageUrl:null,sortOrder:0}]};await db.transaction(sql=>upsertCatalogProperty(sql,p));
 const put=(value:unknown,h=auth)=>app.inject({method:'PUT',url:'/api/v1/me/search',headers:h,payload:value});const get=(h=auth)=>app.inject({method:'GET',url:'/api/v1/me/search',headers:h});
 return {db,app,config,headers,auth,auth2,sid,user,owner,p,put,get};
}
test('Saved search: ownership, validation, baseline, published matches, favorite updates and no repeated scans',async t=>{
 const {db,config,p,put,get,auth2,sid}=await fixture(t);
 assert.equal((await put({...settings,telegram:true})).statusCode,400);
 assert.equal((await put({...settings,criteria:{...settings.criteria,min:100,max:10}})).statusCode,400);
 assert.equal((await put({...settings,owner:'user:another'})).statusCode,400);
 assert.equal((await put(settings)).statusCode,200);assert.equal((await get(auth2)).json().settings.criteria,null);
 await db.query('insert into favorite_sets(owner,property_ids) values($1,$2)',['session:'+sid,[p.id]]);
 await scanSearchProfiles(db,config.PUBLIC_ORIGIN);assert.equal((await get()).json().feed.length,0);
 await db.transaction(async sql=>{await upsertCatalogProperty(sql,{...p,priceFrom:p.priceFrom+1,floorplans:[...p.floorplans,{...p.floorplans[0],id:'plan2',areaFrom:75}]});await upsertCatalogProperty(sql,{...p,floorplans:p.floorplans.map(f=>({...f,id:'new-match-'+f.id})),id:'new-match',name:'ЖК Новый'});await upsertCatalogProperty(sql,{...p,floorplans:p.floorplans.map(f=>({...f,id:'draft-'+f.id})),id:'draft',status:'draft'});});
 await Promise.all([scanSearchProfiles(db,config.PUBLIC_ORIGIN),scanSearchProfiles(db,config.PUBLIC_ORIGIN)]);
 const feed=(await get()).json().feed;assert.equal(feed.length,3);assert.deepEqual(new Set(feed.map((e:any)=>e.kind)),new Set(['price','floorplan','match']));assert.ok(!feed.some((e:any)=>e.propertyId==='draft'));
 await scanSearchProfiles(db,config.PUBLIC_ORIGIN);assert.equal((await get()).json().feed.length,3);
 await db.query("update catalog_properties set status='archived' where id='new-match'");assert.equal((await get()).json().feed.length,2);
 assert.equal((await put({...settings,criteria:{...settings.criteria!,city:'Неизвестный город'}})).statusCode,200);assert.equal((await get()).json().feed.length,0);
 assert.equal(searchMatches(p,{...settings.criteria!,rooms:'1'}),false);
});
test('Saved search: Telegram binding, consent, digest cooldown, retry, cancellation and merge isolation',async t=>{
 const {db,app,config,p,put,get,sid,user,auth2}=await fixture(t);
 await put(settings);await db.transaction(sql=>mergeSearch(sql,sid,user));await db.query('update sessions set user_id=$2 where id=$1',[sid,user]);
 assert.equal((await get()).json().authenticated,true);assert.equal((await get(auth2)).json().settings.criteria,null);
 assert.equal((await put({...settings,telegram:true})).statusCode,200);
 await db.transaction(sql=>upsertCatalogProperty(sql,{...p,floorplans:p.floorplans.map(f=>({...f,id:'first-new-'+f.id})),id:'first-new'}));await scanSearchProfiles(db,config.PUBLIC_ORIGIN);
 const queue=async()=>(await db.query("select * from outbox_events where topic='user.search_updates' and processed_at is null")).rows;
 assert.equal((await queue()).length,1);
 await db.transaction(sql=>upsertCatalogProperty(sql,{...p,floorplans:p.floorplans.map(f=>({...f,id:'second-new-'+f.id})),id:'second-new'}));await scanSearchProfiles(db,config.PUBLIC_ORIGIN);assert.equal((await queue()).length,1);
 const sent:any[]=[];await processNotificationOutbox(outboxRepository(db),{async sendMessage(){throw Error('temporary')}},10);assert.equal((await queue())[0].attempts,1);
 await db.query("update outbox_events set available_at=now() where topic='user.search_updates'");await processNotificationOutbox(outboxRepository(db),{async sendMessage(v){sent.push(v)}},10);assert.equal(sent.length,1);assert.equal(sent[0].chatId,'123456');assert.match(sent[0].deepLink,/#\/my-search$/);
 await scanSearchProfiles(db,config.PUBLIC_ORIGIN,new Date(Date.now()+3700000));assert.equal((await queue()).length,1);
 const repo=outboxRepository(db),claimed=await repo.claimBatch(10);assert.equal(claimed.length,1);
 await put({...settings,telegram:false});assert.equal((await get()).json().feed.length,2,'toggle must preserve history despite JSONB key order');assert.equal(await repo.canDeliver(claimed[0]),false);assert.equal((await queue()).length,0);
 await put({...settings,telegram:true});await scanSearchProfiles(db,config.PUBLIC_ORIGIN);assert.equal((await queue()).length,0,'enabling must not replay old updates');
 await app.inject({method:'GET',url:'/api/v1/me/search',headers:auth2});
});
test('Owner receives new leads without a manager, duplicate submissions do not resend, managers receive no business alerts',async t=>{
 const {db,app,auth,config}=await fixture(t);
 // Simulate a team without an eligible salesperson: owner still gets the lead.
 await db.query("update team_members set active=false");
 const payload={idempotencyKey:randomUUID(),name:'Евгений',phone:'+79990000000',source:'property',propertyId:'watched',consent:true,consentVersion:config.CONSENT_VERSION};
 const first=await app.inject({method:'POST',url:'/api/v1/leads',headers:auth,payload});assert.equal(first.statusCode,200,first.body);
 const repeat=await app.inject({method:'POST',url:'/api/v1/leads',headers:auth,payload});assert.equal(repeat.statusCode,200,repeat.body);assert.equal(repeat.json().duplicate,true);
 const rows=(await db.query("select * from outbox_events where topic='manager.new_lead'")).rows;assert.equal(rows.length,1);
 await db.query("update team_members set active=true where role='owner'");
 const sent:any[]=[];await processNotificationOutbox(outboxRepository(db),{async sendMessage(v){sent.push(v)}},10);assert.equal(sent.length,1);assert.equal(sent[0].chatId,'9000');assert.match(sent[0].text,/Новая заявка/);assert.match(sent[0].text,/Евгений/);assert.match(sent[0].text,/ЖК Проверка/);assert.match(sent[0].deepLink,new RegExp(first.json().id));
 const manager=(await db.query("update team_members set active=true where role='manager' returning id")).rows[0].id;
 await db.query("insert into outbox_events(topic,aggregate_type,payload) values('manager.journey','lead',$1::jsonb)",[JSON.stringify({managerId:manager,title:'Клиент написал',body:'Вопрос по покупке'})]);
 await processNotificationOutbox(outboxRepository(db),{async sendMessage(v){sent.push(v)}},10);assert.equal(sent.at(-1).chatId,'9000');
 const challengeId=randomUUID(),expiresAt=new Date(Date.now()+300000).toISOString();
 await db.query("insert into control_login_challenges(id,member_id,code_hash,expires_at) values($1,$2,$3,$4)",[challengeId,manager,'test-hash',expiresAt]);
 await db.query("insert into outbox_events(topic,aggregate_type,payload) values('manager.security_code','member',$1::jsonb)",[JSON.stringify({managerId:manager,code:'012345',challengeId,expiresAt})]);
 await processNotificationOutbox(outboxRepository(db),{async sendMessage(v){sent.push(v)}},10);assert.equal(sent.at(-1).chatId,'9001');assert.match(sent.at(-1).text,/012345/);
 await db.query("update team_members set telegram_user_id=null where role='owner'");await db.query("insert into outbox_events(topic,aggregate_type,payload) values('manager.new_lead','lead','{}')");
 await processNotificationOutbox(outboxRepository(db),{async sendMessage(){assert.fail('must not fall back to manager')}},10);assert.equal((await db.query("select last_error from outbox_events where processed_at is null")).rows[0].last_error,'owner Telegram id missing');
});

test('Saved search accepts catalog room counts beyond the former fixed picker',async t=>{
 const {put,get}=await fixture(t);
 for(const rooms of ['5','4+','10']){
  const response=await put({...settings,criteria:{...settings.criteria!,rooms}});
  assert.equal(response.statusCode,200,response.body);
  assert.equal((await get()).json().settings.criteria.rooms,rooms);
 }
 assert.equal((await put({...settings,criteria:{...settings.criteria!,rooms:'arbitrary'}})).statusCode,400);
});
