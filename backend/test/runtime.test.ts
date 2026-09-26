import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { testDatabase } from './database';
import { migrate } from '../src/migrate';
import { createApp } from '../src/app';
import { hashPassword } from '../src/security';
import { readConfig } from '../src/config';
import { DEFAULT_STATE } from '../../packages/pulse-data/model';
import { outboxRepository } from '../src/outboxRepository';
import { processNotificationOutbox } from '../src/notificationWorker';

test('SQL/API: заявки между устройствами, дедупликация, RBAC, конфликты, очередь',async t=>{
 const db=await testDatabase();await migrate(db);await migrate(db);
 const mediaRoot=await mkdtemp(join(tmpdir(),'pulse-media-'));
 const config=readConfig({NODE_ENV:'test',DATABASE_URL:'unused',PUBLIC_ORIGIN:'http://localhost:8080',BOT_TOKEN:'test-only-token',MEDIA_ROOT:mediaRoot});
 const app=await createApp(db,config);await app.ready();t.after(async()=>{await app.close();await db.close();await rm(mediaRoot,{recursive:true,force:true});});
 const owner=(await db.query("insert into team_members(name,email,password_hash,role,telegram_user_id) values('Owner','owner@example.test',$1,'owner',12345) returning id",[await hashPassword('long-test-password')])).rows[0];
 const manager=(await db.query("insert into team_members(name,email,password_hash,role) values('Manager','manager@example.test',$1,'manager') returning id",[await hashPassword('long-test-password')])).rows[0];
 const headers={'content-type':'application/json',origin:config.PUBLIC_ORIGIN};
 async function login(email:string){const r=await app.inject({method:'POST',url:'/api/v1/control/login',headers,payload:{email,password:'long-test-password'}});assert.equal(r.statusCode,200,r.body);assert.ok(r.headers['set-cookie']?.toString().includes('HttpOnly'));return r.cookies[0].value;}
 const ownerCookie={pulse_control:await login('owner@example.test')};const managerCookie={pulse_control:await login('manager@example.test')};
 let identity:any;let other:any;let leadId='';let first:any;
 await t.test('сотрудник без cookie не получает CRM',async()=>{assert.equal((await app.inject('/api/v1/control/snapshot')).statusCode,401);});
 await t.test('старый PULSE Select config получает новые настройки без миграции документа',async()=>{
  await db.query("update app_config set document=document #- '{select,smartQueryEnabled}' #- '{select,whatIfEnabled}' #- '{select,maxPreferences}' #- '{select,preferenceEnabled}'");
  const snapshot=await app.inject({url:'/api/v1/control/snapshot',cookies:ownerCookie});assert.equal(snapshot.statusCode,200,snapshot.body);
  const select=snapshot.json().state.select;assert.equal(select.smartQueryEnabled,true);assert.equal(select.whatIfEnabled,true);assert.equal(select.maxPreferences,3);assert.equal(select.preferenceEnabled.sea,true);
 });
 await t.test('каталог отделён от config: импорт, пагинация, detail и RBAC',async()=>{
  const doc={...DEFAULT_STATE,properties:[]};
  const response=await app.inject({method:'PUT',url:'/api/v1/control/state',headers,cookies:ownerCookie,payload:{state:doc,version:1}});assert.equal(response.statusCode,200,response.body);
  assert.equal((await app.inject('/api/v1/public/state')).json().state.properties.length,0);
  assert.equal((await app.inject({method:'PUT',url:'/api/v1/control/state',headers,cookies:ownerCookie,payload:{state:doc,version:1}})).statusCode,409);
  assert.equal((await app.inject({method:'PUT',url:'/api/v1/control/state',headers,cookies:managerCookie,payload:{state:doc,version:2}})).statusCode,403);

  const properties=DEFAULT_STATE.properties.map(p=>({...p,documents:[]}));
  const imported=await app.inject({method:'POST',url:'/api/v1/control/catalog/import',headers,cookies:ownerCookie,payload:{properties,replace:{images:true,features:true,floorplans:true,documents:true}}});
  assert.equal(imported.statusCode,200,imported.body);assert.equal(imported.json().created,properties.length);

  const page1=await app.inject('/api/v1/public/catalog?limit=2&view=card');assert.equal(page1.statusCode,200,page1.body);
  assert.equal(page1.json().items.length,2);assert.equal(page1.json().total,properties.length);assert.equal(page1.json().hasMore,true);
  const page2=await app.inject('/api/v1/public/catalog?page=2&limit=2&view=card');assert.equal(page2.json().items.length,2);
  const detail=await app.inject('/api/v1/public/catalog/solnechniy');assert.equal(detail.statusCode,200,detail.body);assert.ok(detail.json().property.floorplans.length>0);
  assert.equal((await app.inject({url:'/api/v1/control/catalog',cookies:managerCookie})).statusCode,403);
 });

 await t.test('фото каталога загружается в persistent media storage',async()=>{
  const uploaded=await app.inject({
   method:'POST',url:'/api/v1/control/catalog/solnechniy/media?kind=gallery&filename=test.png',
   headers:{origin:config.PUBLIC_ORIGIN,'content-type':'image/png'},cookies:ownerCookie,payload:Buffer.from([137,80,78,71,13,10,26,10])
  });
  assert.equal(uploaded.statusCode,200,uploaded.body);
  const image=uploaded.json().property.images.find((item:any)=>String(item.url).startsWith('/media/images/'));
  assert.ok(image?.url);
 });
 await t.test('сессия выдана сервером; подмена пользователя/события отклоняется',async()=>{
  identity=(await app.inject({method:'POST',url:'/api/v1/auth/session',headers,payload:{source:'test'}})).json();other=(await app.inject({method:'POST',url:'/api/v1/auth/session',headers,payload:{source:'other-device'}})).json();assert.ok(identity.accessToken);assert.notEqual(identity.sessionId,other.sessionId);
  const r=await app.inject({method:'POST',url:'/api/v1/events',headers:{...headers,authorization:'Bearer '+identity.accessToken},payload:{events:[{idempotencyKey:randomUUID(),eventType:'lead_created',occurredAt:new Date().toISOString()}]}});assert.equal(r.statusCode,400);
 });
 await t.test('событие записывается один раз и не принимает телефон в metadata',async()=>{
  const event={idempotencyKey:randomUUID(),eventType:'property_view',entityType:'property',entityId:'solnechniy',metadata:{city:'Владивосток',phone:'private'},occurredAt:new Date().toISOString()};
  const request={method:'POST' as const,url:'/api/v1/events',headers:{...headers,authorization:'Bearer '+identity.accessToken},payload:{events:[event]}};
  const response=await app.inject(request);assert.equal(response.statusCode,200,response.body);assert.equal(response.json().accepted,1);assert.equal((await app.inject(request)).json().duplicates,1);assert.equal((await db.query('select metadata from user_events')).rows[0].metadata.phone,undefined);
 });
 await t.test('реальная заявка видна в другой авторизованной сессии, повтор не создаёт дубль',async()=>{
  const payload={idempotencyKey:randomUUID(),name:'Тестовый клиент',phone:'8 (999) 123-45-67',source:'property',propertyId:'solnechniy',comment:null,consent:true,consentVersion:config.CONSENT_VERSION};
  first={method:'POST' as const,url:'/api/v1/leads',headers:{...headers,authorization:'Bearer '+identity.accessToken},payload};
  const result=await app.inject(first);assert.equal(result.statusCode,200,result.body);leadId=result.json().id;
  const repeat=await app.inject(first);assert.equal(repeat.json().id,leadId);assert.equal(repeat.json().duplicate,true);
  assert.equal((await app.inject({...first,payload:{...payload,name:'Другой клиент'}})).statusCode,409);
  const snapshot=await app.inject({url:'/api/v1/control/snapshot',cookies:ownerCookie});assert.equal(snapshot.statusCode,200,snapshot.body);const data=snapshot.json();assert.equal(data.leads.length,1);assert.equal(data.leads[0].phone,'+79991234567');assert.equal(data.tasks.length,1);assert.equal(data.notifications.length,1);
 });
 await t.test('права менеджера ограничены назначением, изменение отражается в задачах',async()=>{
  await db.query('update leads set manager_id=$2 where id=$1',[leadId,owner.id]);await db.query('update crm_tasks set assigned_to=$2 where lead_id=$1',[leadId,owner.id]);
  assert.equal((await app.inject({url:'/api/v1/control/snapshot',cookies:managerCookie})).json().leads.length,0);
  const lead=(await app.inject({url:'/api/v1/control/snapshot',cookies:ownerCookie})).json().leads[0];
  assert.equal((await app.inject({method:'PATCH',url:'/api/v1/control/leads/'+leadId,headers,cookies:managerCookie,payload:{status:'contacted',expectedUpdatedAt:lead.updatedAt}})).statusCode,403);
  const assigned=await app.inject({method:'PATCH',url:'/api/v1/control/leads/'+leadId,headers,cookies:ownerCookie,payload:{manager:manager.id,expectedUpdatedAt:lead.updatedAt}});assert.equal(assigned.statusCode,200,assigned.body);
  const snapshot=(await app.inject({url:'/api/v1/control/snapshot',cookies:managerCookie})).json();assert.equal(snapshot.leads.length,1);assert.equal(snapshot.tasks.length,1);
  const stale=await app.inject({method:'PATCH',url:'/api/v1/control/leads/'+leadId,headers,cookies:ownerCookie,payload:{status:'lost',expectedUpdatedAt:lead.updatedAt}});assert.equal(stale.statusCode,409);
 });
 await t.test('закрытие заявки завершает задачи; последующие сигналы не создают новые',async()=>{
  const current=(await app.inject({url:'/api/v1/control/snapshot',cookies:managerCookie})).json().leads[0];
  const closed=await app.inject({method:'PATCH',url:'/api/v1/control/leads/'+leadId,headers,cookies:managerCookie,payload:{status:'closed',expectedUpdatedAt:current.updatedAt}});assert.equal(closed.statusCode,200,closed.body);
  await app.inject({method:'POST',url:'/api/v1/events',headers:{...headers,authorization:'Bearer '+identity.accessToken},payload:{events:[{idempotencyKey:randomUUID(),eventType:'favorite_add',entityType:'property',entityId:'solnechniy',occurredAt:new Date().toISOString()}]}});
  assert.equal((await db.query("select * from crm_tasks where status<>'done'")).rows.length,0);
 });
 await t.test('согласие, номер, источник запроса проверяются сервером',async()=>{
  assert.equal((await app.inject({...first,payload:{...first.payload,idempotencyKey:randomUUID(),consent:false}})).statusCode,400);
  assert.equal((await app.inject({...first,payload:{...first.payload,idempotencyKey:randomUUID(),phone:'123'}})).statusCode,400);
  assert.equal((await app.inject({...first,headers:{...first.headers,origin:'https://wrong.example'}})).statusCode,403);
  assert.equal((await app.inject({...first,payload:{...first.payload,idempotencyKey:randomUUID(),consentVersion:'old'}})).statusCode,409);
 });
 await t.test('подписанный Telegram привязывает историю; неподписанный не принимается',async()=>{
  const params=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:98765,first_name:'Test'})});const check=[...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');const secret=createHmac('sha256','WebAppData').update(config.BOT_TOKEN).digest();params.set('hash',createHmac('sha256',secret).update(check).digest('hex'));
  const good=await app.inject({method:'POST',url:'/api/v1/auth/telegram',headers:first.headers,payload:{initData:params.toString()}});assert.equal(good.statusCode,200,good.body);
  assert.ok((await db.query('select user_id from sessions where id=$1',[identity.sessionId])).rows[0].user_id);
  assert.equal((await app.inject({method:'POST',url:'/api/v1/auth/telegram',headers:first.headers,payload:{initData:'user=fake&hash=fake'}})).statusCode,401);
 });
 await t.test('очередь: эксклюзивная аренда, повтор после сбоя, успешная доставка',async()=>{
  // Ensure routing doesn't affect the delivery test.
  await db.query('update outbox_events set payload=jsonb_set(payload,\'{managerId}\',to_jsonb($1::text))',[owner.id]);
  const repo=outboxRepository(db);const claimed=await repo.claimBatch(5);assert.equal(claimed.length,1);assert.equal((await outboxRepository(db).claimBatch(5)).length,0);
  await repo.markFailed(claimed[0].id,'temporary',new Date(Date.now()-1000).toISOString());
  let sent=0;const result=await processNotificationOutbox(outboxRepository(db),{async sendMessage(){sent++;}},5);assert.equal(result.processed,1);assert.equal(sent,1);assert.equal((await outboxRepository(db).claimBatch(5)).length,0);
 });
 await t.test('выход отзывает серверную сессию',async()=>{assert.equal((await app.inject({method:'POST',url:'/api/v1/control/logout',headers,cookies:managerCookie,payload:{}})).statusCode,200);assert.equal((await app.inject({url:'/api/v1/control/me',cookies:managerCookie})).statusCode,401);});
});
