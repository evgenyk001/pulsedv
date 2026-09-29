import { enqueueInterestChange } from '../src/interestNotifications';
import { upsertCatalogProperty,listCatalog } from '../src/catalogRepository';
import { matchesBudgetAndRooms,hasSea,deliveryMatches } from '../../packages/domain/propertyMatch';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import { access, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
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
import { runSecurityMaintenance } from '../src/maintenance';

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
 await t.test('двухэтапный вход через Telegram выдаёт сессию только после одноразового кода',async()=>{
  await db.query('update team_members set mfa_enabled=true where id=$1',[owner.id]);
  const firstStep=await app.inject({method:'POST',url:'/api/v1/control/login',headers,payload:{email:'owner@example.test',password:'long-test-password'}});
  assert.equal(firstStep.statusCode,200,firstStep.body);assert.equal(firstStep.json().mfaRequired,true);assert.ok(firstStep.json().challengeId);assert.equal(firstStep.cookies.find((x:any)=>x.name==='pulse_control'),undefined);
  const challengeId=firstStep.json().challengeId;
  const queued=(await db.query("select payload from outbox_events where topic='manager.security_code' and aggregate_id=$1 order by created_at desc limit 1",[owner.id])).rows[0];assert.match(String(queued?.payload?.code),/^\d{6}$/);
  const wrongCode=queued.payload.code==='000000'?'111111':'000000';const wrong=await app.inject({method:'POST',url:'/api/v1/control/login/verify',headers,payload:{challengeId,code:wrongCode}});assert.equal(wrong.statusCode,401);
  const verified=await app.inject({method:'POST',url:'/api/v1/control/login/verify',headers,payload:{challengeId,code:queued.payload.code}});assert.equal(verified.statusCode,200,verified.body);
  const cookie=verified.cookies.find((x:any)=>x.name==='pulse_control')?.value;assert.ok(cookie);assert.equal(verified.json().member.mfaEnabled,true);
  const disabled=await app.inject({method:'POST',url:'/api/v1/control/mfa',headers,cookies:{pulse_control:cookie},payload:{enabled:false,currentPassword:'long-test-password'}});assert.equal(disabled.statusCode,200,disabled.body);assert.equal(disabled.json().member.mfaEnabled,false);
  await db.query("delete from outbox_events where topic='manager.security_code'");
 });
 await t.test('старый PULSE Select config получает новые настройки без миграции документа',async()=>{
  await db.query("update app_config set document=document #- '{select,smartQueryEnabled}' #- '{select,whatIfEnabled}' #- '{select,maxPreferences}' #- '{select,preferenceEnabled}'");
  const snapshot=await app.inject({url:'/api/v1/control/snapshot',cookies:ownerCookie});assert.equal(snapshot.statusCode,200,snapshot.body);
  const select=snapshot.json().state.select;assert.equal(select.smartQueryEnabled,true);assert.equal(select.whatIfEnabled,true);assert.equal(select.maxPreferences,3);assert.equal(select.preferenceEnabled.sea,true);
 });
 await t.test('каталог отделён от config: импорт, пагинация, detail и RBAC',async()=>{
  const doc={...DEFAULT_STATE,properties:[]};
  const response=await app.inject({method:'PUT',url:'/api/v1/control/state',headers,cookies:ownerCookie,payload:{state:doc,version:1}});assert.equal(response.statusCode,200,response.body);
  const publicState=(await app.inject('/api/v1/public/state')).json().state;assert.equal(publicState.properties.length,0);assert.equal(publicState.leadEngine,undefined);
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

 await t.test('единые фильтры каталога: планы, студии, 3+, море и сдача',async()=>{
 const fixtures=[{...DEFAULT_STATE.properties[0],id:'test-filter-a',city:'Владивосток',description:'Морской воздух',tags:[],features:[],delivery:'Дом введён',priceFrom:5,floorplans:[{roomLabel:'3-комнатная',priceFrom:9,areaFrom:70,areaTo:80,imageUrl:null,sortOrder:0}]},{...DEFAULT_STATE.properties[0],id:'test-filter-b',city:'Артём',description:'У моря',tags:[],features:[],delivery:'2028',priceFrom:4,floorplans:[{roomLabel:'Студия',priceFrom:4,areaFrom:20,areaTo:30,imageUrl:null,sortOrder:0}]},{...DEFAULT_STATE.properties[0],id:'test-filter-c',priceFrom:8,delivery:'Сдан',floorplans:[]}];
 for(const p of fixtures)await db.transaction(sql=>upsertCatalogProperty(sql,{...p,images:[]}));
 for(const filters of [{rooms:'Все',min:8_000_000,max:10_000_000},{rooms:'3+',min:0,max:10_000_000},{rooms:'Студия',min:0,max:10_000_000},{rooms:'Не важно',min:0,max:10_000_000},{rooms:'Все',min:0,max:100_000_000,sea:true},{rooms:'Все',min:0,max:100_000_000,delivery:'Сдан'}]){
  const expected=fixtures.filter(p=>matchesBudgetAndRooms(p,filters)&&(!filters.sea||hasSea(p))&&(!filters.delivery||deliveryMatches(p,filters.delivery))).map(p=>p.id).sort();
  const result=await listCatalog(db,{...filters,ids:fixtures.map(p=>p.id),view:'match'});
  assert.deepEqual(result.items.map(p=>p.id).sort(),expected,JSON.stringify(filters));
 }
 await db.query("delete from catalog_properties where id=any($1::text[])",[fixtures.map(p=>p.id)]);
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
 await t.test('баннерные кампании: загрузка изображения, расписание и публичная выдача',async()=>{
  const uploaded=await app.inject({
   method:'POST',url:'/api/v1/control/content/banner-media?filename=campaign.png',
   headers:{origin:config.PUBLIC_ORIGIN,'content-type':'image/png'},cookies:ownerCookie,payload:Buffer.from([137,80,78,71,13,10,26,10])
  });
  assert.equal(uploaded.statusCode,200,uploaded.body);assert.match(uploaded.json().imageUrl,/^\/media\/banners\//);
  assert.equal((await app.inject({method:'POST',url:'/api/v1/control/content/banner-media',headers:{origin:config.PUBLIC_ORIGIN,'content-type':'image/png'},cookies:managerCookie,payload:Buffer.from([1])})).statusCode,403);
  const snapshot=(await app.inject({url:'/api/v1/control/snapshot',cookies:ownerCookie})).json();
  const live={id:'campaign-live',title:'Живая кампания',body:'Показывается сейчас',imageUrl:uploaded.json().imageUrl,ctaLabel:'Подробнее',actionUrl:'https://example.com',city:null,audience:null,enabled:true,sortOrder:1,kind:'partner',eyebrow:'Партнёр',startsAt:new Date(Date.now()-60_000).toISOString(),endsAt:new Date(Date.now()+60_000).toISOString()};
  const future={...live,id:'campaign-future',title:'Будущая кампания',sortOrder:2,startsAt:new Date(Date.now()+3600_000).toISOString(),endsAt:new Date(Date.now()+7200_000).toISOString()};
  const expired={...live,id:'campaign-expired',title:'Завершённая кампания',sortOrder:3,startsAt:new Date(Date.now()-7200_000).toISOString(),endsAt:new Date(Date.now()-3600_000).toISOString()};
  const saved=await app.inject({method:'PUT',url:'/api/v1/control/state',headers,cookies:ownerCookie,payload:{state:{...snapshot.state,properties:[],banners:[live,future,expired]},version:snapshot.version}});
  assert.equal(saved.statusCode,200,saved.body);
  const publicState=(await app.inject('/api/v1/public/state')).json().state;
  assert.deepEqual(publicState.banners.map((item:any)=>item.id),['campaign-live']);
 });
 await t.test('каталог: устаревшая версия не затирает правки и загруженное медиа',async()=>{
  const url='/api/v1/control/catalog/solnechniy';
  const read=async()=>(await app.inject({url,cookies:ownerCookie})).json().property;
  const original=await read();
  const saved=await app.inject({method:'PUT',url,headers,cookies:ownerCookie,payload:{...original,name:'Новое название ЖК'}});
  assert.equal(saved.statusCode,200,saved.body);assert.ok(saved.json().property.revision>original.revision);
  const stale=await app.inject({method:'PUT',url,headers,cookies:ownerCookie,payload:{...original,description:'Устаревшая правка'}});
  assert.equal(stale.statusCode,409,stale.body);assert.equal((await read()).name,'Новое название ЖК');
  const current=await read();
  const uploaded=await app.inject({method:'POST',url:url+'/media?kind=gallery',headers:{origin:config.PUBLIC_ORIGIN,'content-type':'image/png'},cookies:ownerCookie,payload:Buffer.from([137,80,78,71,13,10,26,10])});
  assert.equal(uploaded.statusCode,200,uploaded.body);
  assert.equal((await app.inject({method:'PUT',url,headers,cookies:ownerCookie,payload:current})).statusCode,409);
  assert.equal((await read()).images.length,current.images.length+1);
  const {revision,...withoutVersion}=await read();
  assert.equal((await app.inject({method:'PUT',url,headers,cookies:ownerCookie,payload:withoutVersion})).statusCode,409);
 });
 await t.test('сессия выдана сервером; подмена пользователя/события отклоняется',async()=>{
  const identityResponse=await app.inject({method:'POST',url:'/api/v1/auth/session',headers,payload:{source:'test'}});identity=identityResponse.json();other=(await app.inject({method:'POST',url:'/api/v1/auth/session',headers,payload:{source:'other-device'}})).json();assert.ok(identity.accessToken);assert.notEqual(identity.sessionId,other.sessionId);assert.ok(identityResponse.headers['set-cookie']?.toString().includes('HttpOnly'));assert.ok(identityResponse.headers['set-cookie']?.toString().includes('SameSite=Strict'));
  const r=await app.inject({method:'POST',url:'/api/v1/events',headers:{...headers,authorization:'Bearer '+identity.accessToken},payload:{events:[{idempotencyKey:randomUUID(),eventType:'lead_created',occurredAt:new Date().toISOString()}]}});assert.equal(r.statusCode,400);
 });
 await t.test('событие записывается один раз и не принимает телефон в metadata',async()=>{
  const event={idempotencyKey:randomUUID(),eventType:'property_view',entityType:'property',entityId:'solnechniy',metadata:{city:'Владивосток',phone:'private'},occurredAt:new Date().toISOString()};
  const request={method:'POST' as const,url:'/api/v1/events',headers:{...headers,authorization:'Bearer '+identity.accessToken},payload:{events:[event]}};
  const response=await app.inject(request);assert.equal(response.statusCode,200,response.body);assert.equal(response.json().accepted,1);assert.equal((await app.inject(request)).json().duplicates,1);assert.equal((await db.query('select metadata from user_events')).rows[0].metadata.phone,undefined);
 });
 await t.test('реальная заявка видна в другой авторизованной сессии, повтор не создаёт дубль',async()=>{
  const payload={idempotencyKey:randomUUID(),name:'Тестовый клиент',phone:'8 (999) 123-45-67',source:'mortgage',propertyId:'solnechniy',comment:null,context:{program:'family',price:5_400_000,down:2_000_000,years:25,rate:6,payment:21_906},consent:true,consentVersion:config.CONSENT_VERSION};
  first={method:'POST' as const,url:'/api/v1/leads',headers:{...headers,authorization:'Bearer '+identity.accessToken},payload};
  const result=await app.inject(first);assert.equal(result.statusCode,200,result.body);leadId=result.json().id;
  const repeat=await app.inject(first);assert.equal(repeat.json().id,leadId);assert.equal(repeat.json().duplicate,true);
  assert.equal((await app.inject({...first,payload:{...payload,name:'Другой клиент'}})).statusCode,409);
  const snapshot=await app.inject({url:'/api/v1/control/snapshot',cookies:ownerCookie});assert.equal(snapshot.statusCode,200,snapshot.body);const data=snapshot.json();assert.equal(data.leads.length,1);assert.equal(data.leads[0].phone,'+79991234567');assert.equal(data.leads[0].comment,null);assert.equal(data.leads[0].requestContext.program,'family');assert.equal(data.leads[0].requestContext.payment,21906);assert.equal(data.tasks.length,1);assert.equal(data.notifications.length,1);
 });
 await t.test('Control масштабируется через bootstrap, pulse и paged resources',async()=>{
  const bootstrap=await app.inject({url:'/api/v1/control/bootstrap',cookies:ownerCookie});assert.equal(bootstrap.statusCode,200,bootstrap.body);const boot=bootstrap.json();assert.ok(Array.isArray(boot.state.properties));assert.equal(boot.leads,undefined);assert.equal(boot.tasks,undefined);assert.equal(boot.counts.leadsTotal,1);
  const pulse=await app.inject({url:'/api/v1/control/pulse',cookies:ownerCookie});assert.equal(pulse.statusCode,200,pulse.body);assert.equal(pulse.json().counts.leadsTotal,1);
  const pagedLeads=await app.inject({url:'/api/v1/control/leads?page=1&limit=1',cookies:ownerCookie});assert.equal(pagedLeads.statusCode,200,pagedLeads.body);assert.equal(pagedLeads.json().items.length,1);assert.equal(pagedLeads.json().total,1);assert.equal(pagedLeads.json().hasMore,false);
  const pagedTasks=await app.inject({url:'/api/v1/control/tasks?page=1&limit=1',cookies:ownerCookie});assert.equal(pagedTasks.statusCode,200,pagedTasks.body);assert.equal(pagedTasks.json().items.length,1);
  const pagedEvents=await app.inject({url:'/api/v1/control/events?page=1&limit=1',cookies:ownerCookie});assert.equal(pagedEvents.statusCode,200,pagedEvents.body);assert.equal(pagedEvents.json().items.length,1);assert.ok(pagedEvents.json().total>=1);
  const pagedProfiles=await app.inject({url:'/api/v1/control/profiles?page=1&limit=1',cookies:ownerCookie});assert.equal(pagedProfiles.statusCode,200,pagedProfiles.body);assert.equal(pagedProfiles.json().items.length,1);
  const analytics=await app.inject({url:'/api/v1/control/analytics-summary',cookies:ownerCookie});assert.equal(analytics.statusCode,200,analytics.body);assert.equal(analytics.json().leadsTotal,1);assert.ok(Number.isInteger(analytics.json().sessions));
 });
 await t.test('права менеджера ограничены назначением, изменение отражается в задачах',async()=>{
  await db.query('update leads set manager_id=$2 where id=$1',[leadId,owner.id]);await db.query('update crm_tasks set assigned_to=$2 where lead_id=$1',[leadId,owner.id]);
  assert.equal((await app.inject({url:'/api/v1/control/snapshot',cookies:managerCookie})).json().leads.length,0);
  const lead=(await app.inject({url:'/api/v1/control/snapshot',cookies:ownerCookie})).json().leads[0];
  assert.equal((await app.inject({method:'PATCH',url:'/api/v1/control/leads/'+leadId,headers,cookies:managerCookie,payload:{status:'contacted',expectedUpdatedAt:lead.updatedAt}})).statusCode,403);
  const assigned=await app.inject({method:'PATCH',url:'/api/v1/control/leads/'+leadId,headers,cookies:ownerCookie,payload:{manager:manager.id,expectedUpdatedAt:lead.updatedAt}});assert.equal(assigned.statusCode,200,assigned.body);
  const snapshot=(await app.inject({url:'/api/v1/control/snapshot',cookies:managerCookie})).json();assert.equal(snapshot.leads.length,1);assert.equal(snapshot.tasks.length,1);assert.equal(snapshot.members.length,1);assert.equal(snapshot.members[0].id,manager.id);
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
 await t.test('DNA: сервер объединяет проверенные сессии, соблюдает назначение и не доверяет клиентскому userId',async()=>{
  const second=(await app.inject({method:'POST',url:'/api/v1/auth/session',headers,payload:{source:'dna-test'}})).json();
  const authHeaders={...headers,authorization:'Bearer '+second.accessToken};
  const params=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:98765,first_name:'Test'})});
  const check=[...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');
  const secret=createHmac('sha256','WebAppData').update(config.BOT_TOKEN).digest();params.set('hash',createHmac('sha256',secret).update(check).digest('hex'));
  assert.equal((await app.inject({method:'POST',url:'/api/v1/auth/telegram',headers:authHeaders,payload:{initData:params.toString()}})).statusCode,200);
  const recorded=await app.inject({method:'POST',url:'/api/v1/events',headers:authHeaders,payload:{events:[{idempotencyKey:randomUUID(),eventType:'floorplan_view',entityType:'property',entityId:'solnechniy',metadata:{rooms:'2',price:8_000_000,userId:'forged',phone:'private'},occurredAt:new Date(Date.now()-1000).toISOString()}]}});
  assert.equal(recorded.statusCode,200,recorded.body);
  const url='/api/v1/control/interest/'+identity.sessionId;
  assert.equal((await app.inject(url)).statusCode,401);
  const ownerDNA=await app.inject({url,cookies:ownerCookie});assert.equal(ownerDNA.statusCode,200,ownerDNA.body);
  assert.equal(ownerDNA.json().linked,true);assert.equal(ownerDNA.json().dna.sessionCount,2);
  assert.ok(ownerDNA.json().events.some((e:any)=>e.sessionId===second.sessionId));
  const managerDNA=await app.inject({url,cookies:managerCookie});assert.equal(managerDNA.statusCode,200,managerDNA.body);
  assert.ok(managerDNA.json().events.every((e:any)=>e.sessionId===identity.sessionId));
  assert.equal((await app.inject({url:'/api/v1/control/interest/'+second.sessionId,cookies:managerCookie})).statusCode,404);
  assert.equal((await app.inject({url:'/api/v1/control/interest/'+randomUUID(),cookies:ownerCookie})).statusCode,404);
  assert.ok(ownerDNA.json().events.every((e:any)=>!e.metadata.userId&&!e.metadata.phone));
 });
 await t.test('DNA: уведомление об изменении запроса дедуплицируется и соблюдает паузу 12 часов',async()=>{
  await db.query("update leads set status='contacted' where id=$1",[leadId]);
  const make=(budget:number,ago:number)=>({idempotencyKey:randomUUID(),eventType:'select_submit',entityType:'selection',metadata:{city:'Владивосток',rooms:'2',purchaseMode:'cash',min:5_000_000,max:budget},occurredAt:new Date(Date.now()-ago).toISOString()});
  const batch={method:'POST' as const,url:'/api/v1/events',headers:first.headers,payload:{events:[make(8_000_000,100000),make(10_000_000,50000)]}};
  const added=await app.inject(batch);assert.equal(added.statusCode,200,added.body);
  const notifications=async()=>(await db.query("select * from outbox_events where topic='manager.interest_changed' and aggregate_id=$1",[leadId])).rows;
  assert.equal((await notifications()).length,1);
  assert.equal((await app.inject(batch)).statusCode,200);assert.equal((await notifications()).length,1);
  const again=await app.inject({...batch,payload:{events:[make(11_000_000,1000)]}});assert.equal(again.statusCode,200,again.body);assert.equal((await notifications()).length,1);
  await db.query("update leads set status='closed' where id=$1",[leadId]);
  assert.equal(await db.transaction(sql=>enqueueInterestChange(sql,identity.sessionId,config.PUBLIC_ORIGIN)),false);
 });
 await t.test('выход отзывает серверную сессию',async()=>{assert.equal((await app.inject({method:'POST',url:'/api/v1/control/logout',headers,cookies:managerCookie,payload:{}})).statusCode,200);assert.equal((await app.inject({url:'/api/v1/control/me',cookies:managerCookie})).statusCode,401);});
});


test('retention: старые закрытые лиды и идентификаторы клиента удаляются автоматически',async t=>{
 const db=await testDatabase();await migrate(db);const mediaRoot=await mkdtemp(join(tmpdir(),'pulse-retention-'));
 t.after(async()=>{await db.close();await rm(mediaRoot,{recursive:true,force:true});});
 const config=readConfig({NODE_ENV:'test',DATABASE_URL:'unused',PUBLIC_ORIGIN:'http://localhost:8080',MEDIA_ROOT:mediaRoot,CLIENT_DATA_RETENTION_DAYS:'30',ANALYTICS_RETENTION_DAYS:'30',AUDIT_RETENTION_DAYS:'30',OUTBOX_RETENTION_DAYS:'7'});
 const userId=randomUUID(),sessionId=randomUUID(),leadId=randomUUID(),old=new Date(Date.now()-45*86400_000).toISOString(),file=randomUUID()+'.pdf';
 await db.query("insert into app_users(id,telegram_user_id,first_name,last_seen_at,updated_at) values($1,$2,'Старый клиент',$3,$3)",[userId,99112233,old]);
 await db.query("insert into sessions(id,user_id,source,first_seen_at,last_seen_at) values($1,$2,'test',$3,$3)",[sessionId,userId,old]);
 await db.query("insert into leads(id,user_id,session_id,source,name,phone,status,created_at,updated_at) values($1,$2,$3,'test','Старый клиент','+79990000000','closed',$4,$4)",[leadId,userId,sessionId,old]);
 const attachmentUrl='/api/v1/journey-media/'+leadId+'/'+file;
 await db.query("insert into client_journeys(lead_id,revision,document,updated_at) values($1,1,$2::jsonb,$3)",[leadId,JSON.stringify({leadId,revision:1,collections:[],showings:[],messages:[{id:randomUUID(),author:'client',text:'старое',createdAt:old,attachment:{kind:'file',name:'old.pdf',url:attachmentUrl,mimeType:'application/pdf',size:12}}],nextStep:null}),old]);
 await db.query("insert into favorite_sets(owner,property_ids) values($1,'{}'),($2,'{}')",['session:'+sessionId,'user:'+userId]);
 const dir=join(mediaRoot,'private','chat',leadId);await mkdir(dir,{recursive:true});await writeFile(join(dir,file),'%PDF-old');
 const result=await runSecurityMaintenance(db,config);assert.equal(result.anonymizedLeads,1);assert.equal(result.deletedSessions,1);assert.equal(result.deletedUsers,1);
 const lead=(await db.query('select * from leads where id=$1',[leadId])).rows[0];assert.equal(lead.name,'Удалено');assert.equal(lead.phone,'Удалено');assert.deepEqual(lead.request_context,{});assert.equal(lead.user_id,null);assert.equal(lead.session_id,null);
 assert.equal((await db.query('select * from client_journeys where lead_id=$1',[leadId])).rows.length,0);
 assert.equal((await db.query('select * from sessions where id=$1',[sessionId])).rows.length,0);assert.equal((await db.query('select * from app_users where id=$1',[userId])).rows.length,0);
 await assert.rejects(access(join(dir,file)));
});
