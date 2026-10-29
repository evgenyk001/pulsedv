import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
import {createApp} from '../src/app';
import {readConfig} from '../src/config';
import {upsertCatalogProperty} from '../src/catalogRepository';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';
import {hashPassword} from '../src/security';
test('Account conversations use verified identity, atomically create the first message, preserve CRM context and replay safely',async()=>{
 const db=await testDatabase();await migrate(db);const config=readConfig({DATABASE_URL:'unused',NODE_ENV:'test',REQUIRE_TELEGRAM_PHONE:'true'});const app=await createApp(db,config);await app.ready();
 const origin={origin:config.PUBLIC_ORIGIN},userId=randomUUID();
 const session=async(user:string|null)=>{const result=(await app.inject({method:'POST',url:'/api/v1/auth/session',headers:origin,payload:{}})).json();if(user)await db.query('update sessions set user_id=$2 where id=$1',[result.sessionId,user]);return {...origin,authorization:'Bearer '+result.accessToken}};
 try{
  await db.query("insert into app_users(id,first_name,last_name,phone,telegram_user_id,telegram_username) values($1,'Анна','Иванова','+79991234567',123,'anna')",[userId]);
  const headers=await session(userId),anonymous=await session(null);
  const input={idempotencyKey:randomUUID(),source:'floorplan',propertyId:'account-test',text:'Здравствуйте, расскажите об этой квартире',consent:true,consentVersion:config.CONSENT_VERSION,context:{rooms:'2',areaFrom:62,price:9000000,finishType:'finished',phone:'must-not-store'}};
  await db.transaction(sql=>upsertCatalogProperty(sql,{...structuredClone(DEFAULT_STATE.properties[0]),id:'account-test'}));
  const start=(payload:any,auth=headers)=>app.inject({method:'POST',url:'/api/v1/me/conversations/start',headers:auth,payload});
  assert.equal((await start(input,anonymous)).statusCode,403);
  assert.equal((await start(input)).statusCode,403);
  await db.query('insert into telegram_contact_consent(user_id,consent_version,accepted_at) values($1,$2,now())',[userId,config.CONSENT_VERSION]);
  assert.equal((await app.inject({url:'/api/v1/me/journeys',headers})).json().items.length,0);
  assert.equal((await start({...input,name:'Other',phone:'+79990000000'})).statusCode,400);
  assert.equal((await start({...input,consentVersion:'old'})).statusCode,409);
  await db.query("update telegram_contact_consent set consent_version='old' where user_id=$1",[userId]);assert.equal((await app.inject({url:'/api/v1/me/account',headers})).json().registered,false);assert.equal((await start(input)).statusCode,409);await db.query('update telegram_contact_consent set consent_version=$2 where user_id=$1',[userId,config.CONSENT_VERSION]);
  const response=await start(input);assert.equal(response.statusCode,200,response.body);const id=response.json().id;
  const lead=(await db.query('select * from leads where id=$1',[id])).rows[0];assert.equal(lead.name,'Анна Иванова');assert.equal(lead.phone,'+79991234567');assert.equal(lead.user_id,userId);const priorConsent=(await db.query('select accepted_at from telegram_contact_consent where user_id=$1',[userId])).rows[0].accepted_at;assert.equal(new Date(lead.consent_at).toISOString(),new Date(priorConsent).toISOString());
  const message=(await db.query('select document from journey_messages where lead_id=$1',[id])).rows[0].document;
  assert.equal(message.text,input.text);assert.equal(message.author,'client');assert.equal(message.requestContext.rooms,'2');assert.equal(message.requestContext.phone,undefined);assert.equal(message.requestContext.propertyName,DEFAULT_STATE.properties[0].name);
  assert.equal((await start(input)).json().id,id);assert.equal((await db.query('select id from journey_messages where lead_id=$1',[id])).rows.length,1);
  assert.equal((await start({...input,text:'Different'})).statusCode,409);
  const otherSession=await session(userId);assert.equal((await start(input,otherSession)).json().id,id);
  assert.equal((await start({...input,idempotencyKey:randomUUID(),text:'Ещё вопрос'},otherSession)).json().id,id);
  assert.equal((await db.query('select id from leads where user_id=$1',[userId])).rows.length,1);
  assert.equal((await db.query('select id from journey_messages where lead_id=$1',[id])).rows.length,2);
  const owner=(await db.query("insert into team_members(name,email,password_hash,role) values('Владелец','chat-owner@test.local',$1,'owner') returning id,public_name",[await hashPassword('conversation-owner-password')])).rows[0];
  await db.query('update leads set manager_id=$2 where id=$1',[id,owner.id]);
  const before=(await app.inject({url:'/api/v1/me/journeys',headers})).json().items[0];assert.equal(before.managerHasReplied,false);assert.equal(before.managerName,owner.public_name);assert.notEqual(owner.public_name,'Владелец');
  const login=await app.inject({method:'POST',url:'/api/v1/control/login',headers:origin,payload:{email:'chat-owner@test.local',password:'conversation-owner-password'}});const cookies=Object.fromEntries(login.cookies.map(c=>[c.name,c.value]));
  const revision=(await db.query('select revision from client_journeys where lead_id=$1',[id])).rows[0].revision;
  const reply=await app.inject({method:'POST',url:'/api/v1/control/journeys/'+id,headers:origin,cookies,payload:{revision,command:{type:'message',id:randomUUID(),text:'Добрый день! Помогу с выбором.'}}});assert.equal(reply.statusCode,200,reply.body);
  const notification=(await db.query("select payload from outbox_events where topic='user.journey' and aggregate_id=$1",[id])).rows[0];assert.equal(notification.payload.deepLink,config.PUBLIC_ORIGIN+'/pulsedv/mini-app/#/journey?lead='+id);
  const after=(await app.inject({url:'/api/v1/me/journeys',headers})).json().items[0];assert.equal(after.managerHasReplied,true);assert.equal(after.journey.messages.at(-1).authorName,owner.public_name);
 }finally{await app.close();await db.close()}
});
test('Concurrent devices reuse one active conversation; explicit new purchases and closed requests stay separate',async()=>{
 const db=await testDatabase();await migrate(db);const config=readConfig({DATABASE_URL:'unused',NODE_ENV:'test'}),app=await createApp(db,config);await app.ready();
 try{
  const user=(await db.query("insert into app_users(first_name,phone) values('Я','+79990000001') returning id")).rows[0].id;
  await db.query('insert into telegram_contact_consent(user_id,consent_version,accepted_at) values($1,$2,now())',[user,config.CONSENT_VERSION]);
  const auth=await Promise.all([0,1].map(async()=>{const r=(await app.inject({method:'POST',url:'/api/v1/auth/session',payload:{}})).json();await db.query('update sessions set user_id=$2 where id=$1',[r.sessionId,user]);return {origin:config.PUBLIC_ORIGIN,authorization:'Bearer '+r.accessToken}}));
  const payload={source:'journey',text:'Здравствуйте',consent:true,consentVersion:config.CONSENT_VERSION};
  const start=(index:number,extra={})=>app.inject({method:'POST',url:'/api/v1/me/conversations/start',headers:auth[index],payload:{...payload,idempotencyKey:randomUUID(),...extra}});
  const responses=await Promise.all([start(0),start(1)]);for(const r of responses)assert.equal(r.statusCode,200,r.body);assert.equal(responses[0].json().id,responses[1].json().id);
  const fresh=await start(0,{newPurchase:true});assert.equal(fresh.statusCode,200,fresh.body);assert.notEqual(fresh.json().id,responses[0].json().id);
  await db.query("update leads set status='closed' where user_id=$1",[user]);
  const reopened=await start(1);assert.equal(reopened.statusCode,200,reopened.body);assert.ok(!responses.some(r=>r.json().id===reopened.json().id));assert.notEqual(reopened.json().id,fresh.json().id);
 }finally{await app.close();await db.close()}
});
