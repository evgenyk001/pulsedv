import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {propertyFromStart,propertyStartParam,propertyTelegramLink} from '../../packages/browser/propertyLinks';
import {preparePropertyShare} from '../src/propertyShareRoutes';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
import {readConfig} from '../src/config';
import {createApp} from '../src/app';
import {issueToken} from '../src/security';
import {upsertCatalogProperty} from '../src/catalogRepository';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';
test('Property launch tokens preserve exact IDs without leaking page state or accepting malformed payloads',()=>{
 for(const id of ['vdk26-6684de88d320','project_1','ЖК-у-моря','a/b?c#d'])assert.equal(propertyFromStart(propertyStartParam(id)),id);
 for(const value of [null,{},'partners','property_','property_!!!!','property_wA','property_YQ=','property_'+('a'.repeat(520))])assert.equal(propertyFromStart(value),null);
 const link=propertyTelegramLink('vdk26-6684de88d320','pulsedvbot');assert.equal(new URL(link).hostname,'t.me');assert.equal(propertyFromStart(new URL(link).searchParams.get('startapp')),'vdk26-6684de88d320');
 assert.throws(()=>propertyTelegramLink('x','bad/name'));assert.throws(()=>propertyStartParam('x'.repeat(201)));
});
test('Shared property messages bind the authenticated sender, keep drafts private, use a Mini App button and survive Telegram errors',async()=>{
 const db=await testDatabase();await migrate(db);const config=readConfig({NODE_ENV:'test',DATABASE_URL:'unused',BOT_TOKEN:'test-token',REQUIRE_TELEGRAM_PHONE:'true'});const app=await createApp(db,config);
 try{
  const property={...structuredClone(DEFAULT_STATE.properties[0]),id:'share-project',name:'ЖК у моря',status:'published' as const};await upsertCatalogProperty(db,property);
  const user=(await db.query("insert into app_users(telegram_user_id,first_name,phone) values(123456,'Клиент','+79991234567') returning id")).rows[0].id;
  const session=randomUUID();await db.query('insert into sessions(id,user_id) values($1,$2)',[session,user]);const token=await issueToken(db,'visitor',session);
  const headers={origin:config.PUBLIC_ORIGIN,authorization:'Bearer '+token.token};
  assert.equal((await app.inject({url:'/api/v1/me/property-share',method:'POST',payload:{propertyId:property.id}})).statusCode,401);
  assert.equal((await app.inject({url:'/api/v1/me/property-share',method:'POST',headers,payload:{propertyId:property.id}})).statusCode,403);
  await db.query('insert into telegram_contact_consent(user_id,consent_version,accepted_at) values($1,$2,now())',[user,config.CONSENT_VERSION]);
  assert.equal((await app.inject({url:'/api/v1/me/property-share',method:'POST',headers,payload:{propertyId:property.id,userId:123}})).statusCode,400);
  const tampered=await app.inject({url:'/api/v1/me/property-share',method:'POST',headers,payload:{propertyId:"' OR 1=1 --"}});assert.equal(tampered.statusCode,404);
  const control=await app.inject({url:'/api/v1/control/bootstrap',headers});assert.equal(control.statusCode,401);
  const direct=await app.inject({url:'/api/v1/me/property-share',method:'POST',headers,payload:{propertyId:property.id}});assert.equal(direct.statusCode,200,direct.body);assert.equal(propertyFromStart(new URL(direct.json().url).searchParams.get('startapp')),property.id);assert.deepEqual(Object.keys(direct.json()),['url']);
  let calls=0;
  const send:typeof fetch=async(url,options)=>{calls++;assert.ok(String(url).endsWith('/savePreparedInlineMessage'));const body=JSON.parse(String(options?.body));assert.equal(body.user_id,123456);assert.equal(body.result.type,'article');assert.equal(body.result.reply_markup.inline_keyboard[0][0].url,direct.json().url);assert.equal(body.result.reply_markup.inline_keyboard[0][0].text,'Открыть ЖК в PULSE');assert.ok(body.result.input_message_content.message_text.includes(property.name));assert.ok(!body.result.input_message_content.message_text.includes('/mini-app/#/property/'));return new Response(JSON.stringify({ok:true,result:{id:'prepared-id'}}),{status:200})};
  assert.equal((await preparePropertyShare(db,config,user,property.id,true,send)).messageId,'prepared-id');assert.equal(calls,1);
  assert.equal((await preparePropertyShare(db,config,user,property.id,false,send)).messageId,undefined);assert.equal(calls,1);
  const fail:typeof fetch=async()=>{throw new Error('Network failure')};assert.equal((await preparePropertyShare(db,config,user,property.id,true,fail)).url,direct.json().url);
  const unavailable:typeof fetch=async()=>new Response(JSON.stringify({ok:false,error_code:400}),{status:400});assert.equal((await preparePropertyShare(db,config,user,property.id,true,unavailable)).messageId,undefined);
  await upsertCatalogProperty(db,{...property,status:'draft'});await assert.rejects(()=>preparePropertyShare(db,config,user,property.id,true,send),/не опубликован/);assert.equal(calls,1);
 }finally{await app.close();await db.close()}
});
