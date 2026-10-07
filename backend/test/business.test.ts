import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
import {createApp} from '../src/app';
import {readConfig} from '../src/config';
import {hashPassword} from '../src/security';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';
import {businessDay,emptyFinance,financeError,financeSummary,needsCatalogReview} from '../../packages/pulse-data/business';

test('Business dates and demo finance separate expectations, receipts and payouts',()=>{
 assert.equal(businessDay(new Date('2026-01-31T15:00:00Z')),'2026-02-01');
 assert.equal(needsCatalogReview(undefined,'2026-02-01'),true);
 const freshness={source:'Прайс',responsible:'Евгений',verifiedAt:'2026-01-31T00:00:00Z',reviewDueOn:'2026-02-01'};
 assert.equal(needsCatalogReview(freshness,'2026-02-01'),true);
 assert.equal(needsCatalogReview({...freshness,reviewDueOn:'2026-02-02'},'2026-02-01'),false);
 assert.equal(financeError({...emptyFinance(),commissionRub:100,agentPayoutRub:101}),'Выплата агенту не может превышать комиссию');
 assert.deepEqual(financeSummary([
  {finance:{...emptyFinance(),commissionRub:250000,agentPayoutRub:100000,receivedOn:'2026-02-01',agentPaidOn:'2026-03-01'}},
  {finance:{...emptyFinance(),commissionRub:200000,expectedPaymentOn:'2026-02-28'}},
  {finance:{...emptyFinance(),commissionRub:50000,receivedOn:'2026-01-31',agentPayoutRub:20000,agentPaidOn:'2026-02-28'}},
 ],'2026-02-01','2026-02-28'),{expected:200000,received:250000,agentPaid:20000,balance:230000,receivedDeals:1});
});

test('Catalog freshness and finance API persist safely and respect CRM scope',async t=>{
 const db=await testDatabase();await migrate(db);
 const root=await mkdtemp(join(tmpdir(),'pulse-business-'));
 const config=readConfig({NODE_ENV:'test',DATABASE_URL:'unused',PUBLIC_ORIGIN:'http://localhost:8080',MEDIA_ROOT:root});
 const app=await createApp(db,config);await app.ready();
 t.after(async()=>{await app.close();await db.close();await rm(root,{recursive:true,force:true})});
 const headers={origin:config.PUBLIC_ORIGIN,'content-type':'application/json'};
 const password='business-long-password',hash=await hashPassword(password);
 const members=(await db.query("insert into team_members(name,email,password_hash,role) values('Owner','business-owner@test.example',$1,'owner'),('Manager','business-manager@test.example',$1,'manager') returning id,email,role",[hash])).rows;
 async function login(email:string){const r=await app.inject({method:'POST',url:'/api/v1/control/login',headers,payload:{email,password}});assert.equal(r.statusCode,200,r.body);return {pulse_control:r.cookies.find(c=>c.name==='pulse_control')!.value};}
 const owner=await login(members[0].email),manager=await login(members[1].email);
 const today=businessDay(),future=businessDay(new Date(Date.now()+7*86400000));
 const freshness={source:'Закрытый прайс застройщика',responsible:'Евгений',verifiedAt:new Date().toISOString(),reviewDueOn:future};
 const property={...DEFAULT_STATE.properties[0],id:'business-fresh',freshness,documents:[]};
 let saved:any;
 await t.test('verification stays private; unverified and due objects form a paginated queue',async()=>{
  const r=await app.inject({method:'POST',url:'/api/v1/control/catalog',headers,cookies:owner,payload:property});assert.equal(r.statusCode,200,r.body);saved=r.json().property;
  for(const [id,f] of [['business-due',{...freshness,reviewDueOn:today}],['business-unverified',undefined]] as const){const created=await app.inject({method:'POST',url:'/api/v1/control/catalog',headers,cookies:owner,payload:{...property,id,freshness:f}});assert.equal(created.statusCode,200,created.body);}
  for(const url of ['/api/v1/public/catalog/business-fresh','/api/v1/public/catalog?view=card','/api/v1/public/catalog?view=match']){const response=await app.inject(url);assert.equal(response.statusCode,200,response.body);assert.ok(!response.body.includes(freshness.source));assert.ok(!response.body.includes('freshness'));}
  const queue=await app.inject({url:'/api/v1/control/catalog?needsReview=1&limit=1',cookies:owner});assert.equal(queue.statusCode,200,queue.body);assert.equal(queue.json().total,2);assert.equal(queue.json().items.length,1);assert.equal(queue.json().hasMore,true);
  const queue2=(await app.inject({url:'/api/v1/control/catalog?needsReview=1&limit=1&page=2',cookies:owner})).json();assert.notEqual(queue2.items[0].id,queue.json().items[0].id);
  assert.equal((await app.inject({url:'/api/v1/control/catalog?needsReview=1',cookies:manager})).statusCode,403);
 });
 await t.test('import and older clients preserve verification; revisions reject lost edits',async()=>{
  const {freshness:omit,...oldBody}=saved;
  const changed=await app.inject({method:'PUT',url:'/api/v1/control/catalog/business-fresh',headers,cookies:owner,payload:{...oldBody,description:'Обновлённое описание'}});assert.equal(changed.statusCode,200,changed.body);assert.deepEqual(changed.json().property.freshness,freshness);
  assert.equal((await app.inject({method:'PUT',url:'/api/v1/control/catalog/business-fresh',headers,cookies:owner,payload:oldBody})).statusCode,409);
  const imported=await app.inject({method:'POST',url:'/api/v1/control/catalog/import',headers,cookies:owner,payload:{properties:[{...oldBody,name:'Обновлённое название'}],replace:{images:false,features:false,floorplans:false,documents:false}}});assert.equal(imported.statusCode,200,imported.body);
  assert.deepEqual((await app.inject({url:'/api/v1/control/catalog/business-fresh',cookies:owner})).json().property.freshness,freshness);
  const invalid=await app.inject({method:'POST',url:'/api/v1/control/catalog',headers,cookies:owner,payload:{...property,id:'business-invalid',freshness:{...freshness,source:''}}});assert.equal(invalid.statusCode,400,invalid.body);
 });
 const lead=(await db.query("insert into leads(name,phone,source,status,manager_id) values('Client','+79990000000','test','deal',$1) returning id",[members[1].id])).rows[0];
 const other=(await db.query("insert into leads(name,phone,source,status) values('Other','+79990000001','test','booking') returning id")).rows[0];
 async function getLead(id:string,cookies=owner){const r=await app.inject({url:'/api/v1/control/leads/'+id,cookies});assert.equal(r.statusCode,200,r.body);return r.json().lead;}
 const finance={...emptyFinance(),commissionRub:250000,agentPayoutRub:100000,expectedPaymentOn:today,receivedOn:today,agentPaidOn:today};
 await t.test('invalid amounts and dates cannot enter totals; own manager edits are allowed',async()=>{
  const current=await getLead(lead.id);
  for(const f of [{...finance,commissionRub:-1},{...finance,commissionRub:1.5},{...finance,agentPayoutRub:250001},{...finance,receivedOn:future},{...finance,commissionRub:null},{...finance,receivedOn:'not-a-date'}]){
   const r=await app.inject({method:'PATCH',url:'/api/v1/control/leads/'+lead.id,headers,cookies:manager,payload:{finance:f,expectedUpdatedAt:current.updatedAt}});assert.equal(r.statusCode,400,r.body);
  }
  const saved=await app.inject({method:'PATCH',url:'/api/v1/control/leads/'+lead.id,headers,cookies:manager,payload:{finance,expectedUpdatedAt:current.updatedAt}});assert.equal(saved.statusCode,200,saved.body);
  assert.deepEqual((await getLead(lead.id)).finance,finance);
  assert.equal((await app.inject({method:'PATCH',url:'/api/v1/control/leads/'+lead.id,headers,cookies:owner,payload:{finance:emptyFinance(),expectedUpdatedAt:current.updatedAt}})).statusCode,409);
  assert.equal((await app.inject({method:'PATCH',url:'/api/v1/control/leads/'+other.id,headers,cookies:manager,payload:{finance,expectedUpdatedAt:(await getLead(other.id)).updatedAt}})).statusCode,403);
 });
 await t.test('summary separates received and expected; manager sees own clients only',async()=>{
  const pending={...emptyFinance(),commissionRub:200000,expectedPaymentOn:today};
  const r=await app.inject({method:'PATCH',url:'/api/v1/control/leads/'+other.id,headers,cookies:owner,payload:{finance:pending,expectedUpdatedAt:(await getLead(other.id)).updatedAt}});assert.equal(r.statusCode,200,r.body);
  const url='/api/v1/control/finance-summary?from='+today+'&to='+today;
  assert.equal((await app.inject(url)).statusCode,401);
  assert.deepEqual((await app.inject({url,cookies:owner})).json(),financeSummary([{finance},{finance:pending}],today,today));
  assert.deepEqual((await app.inject({url,cookies:manager})).json(),{expected:0,received:250000,agentPaid:100000,balance:150000,receivedDeals:1});
  assert.equal((await app.inject({url:'/api/v1/control/finance-summary?from=2020-01-01&to='+today,cookies:owner})).statusCode,400);
  await migrate(db);
  assert.deepEqual((await getLead(lead.id)).finance,finance);
  assert.equal((await app.inject({url:'/api/v1/control/catalog/business-fresh',cookies:owner})).json().property.name,'Обновлённое название');
 });
});
