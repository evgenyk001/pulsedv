import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm,access,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
import {createApp} from '../src/app';
import {readConfig} from '../src/config';
import {hashPassword} from '../src/security';
import {refreshStoredScores} from '../src/refreshScores';
import {cleanExpiredUploads,reserveUpload} from '../src/journeyUploads';

test('Audit regression: manual actions, events, media, history and CRM scope',async t=>{
 const db=await testDatabase();await migrate(db);await migrate(db);
 const root=await mkdtemp(join(tmpdir(),'pulse-audit-'));
 const config=readConfig({NODE_ENV:'test',DATABASE_URL:'unused',PUBLIC_ORIGIN:'http://localhost:8080',MEDIA_ROOT:root});
 const app=await createApp(db,config);await app.ready();t.after(async()=>{await app.close();await db.close();await rm(root,{recursive:true,force:true})});
 const headers={origin:config.PUBLIC_ORIGIN,'content-type':'application/json'};
 await db.query("insert into team_members(name,email,password_hash,role) values('Owner','audit@example.test',$1,'owner')",[await hashPassword('audit-long-password')]);
 const login=await app.inject({method:'POST',url:'/api/v1/control/login',headers,payload:{email:'audit@example.test',password:'audit-long-password'}});
 assert.equal(login.statusCode,200,login.body);const cookie=login.cookies.find(c=>c.name==='pulse_control')!;const cookies={pulse_control:cookie.value};
 const session=(await app.inject({method:'POST',url:'/api/v1/auth/session',headers,payload:{}})).json();
 const auth={...headers,authorization:'Bearer '+session.accessToken};
 const lead=(await db.query("insert into leads(session_id,name,phone,source,status) values($1,'Audit Client','+79990000000','test','new') returning *",[session.sessionId])).rows[0];
 const path='/api/v1/control/journeys/'+lead.id;
 await t.test('intro events coexist with useful analytics and last_seen advances',async()=>{
  await db.query("update sessions set last_seen_at=now()-interval '1 day' where id=$1",[session.sessionId]);
  const r=await app.inject({method:'POST',url:'/api/v1/events',headers:auth,payload:{events:['property_view','mortgage_intro_open','mortgage_intro_slide','mortgage_intro_complete','mortgage_intro_skip','mortgage_intro_replay'].map(eventType=>({idempotencyKey:randomUUID(),eventType,occurredAt:new Date().toISOString()}))}});
  assert.equal(r.statusCode,200,r.body);assert.equal(r.json().accepted,6);
  assert.ok(Date.now()-Date.parse((await db.query('select last_seen_at from sessions where id=$1',[session.sessionId])).rows[0].last_seen_at)<60_000);
 });
 await t.test('manual next action survives scoring and old interest expires',async()=>{
  const current=(await app.inject({url:'/api/v1/control/leads/'+lead.id,cookies})).json().lead;
  const changed=await app.inject({method:'PATCH',url:'/api/v1/control/leads/'+lead.id,headers,cookies,payload:{nextAction:'Позвонить в пятницу после 18:00',expectedUpdatedAt:current.updatedAt}});assert.equal(changed.statusCode,200,changed.body);
  await db.query("update user_events set occurred_at=now()-interval '31 days' where session_id=$1",[session.sessionId]);
  await refreshStoredScores(db);
  const row=(await db.query('select next_action,score from leads where id=$1',[lead.id])).rows[0];assert.equal(row.next_action,'Позвонить в пятницу после 18:00');assert.equal(row.score,0);
 });
 let attachment:any;
 await t.test('reject truncated media; real image is private, scoped and manager URL matches cookie path',async()=>{
  const upload=(payload:Buffer)=>app.inject({method:'POST',url:path+'/attachments?filename=test.png',headers:{origin:config.PUBLIC_ORIGIN,'content-type':'image/png'},cookies,payload});
  assert.equal((await upload(Buffer.from([137,80,78,71,13,10,26,10]))).statusCode,400);
  const good=await upload(await sharp({create:{width:4,height:4,channels:3,background:'red'}}).png().toBuffer());assert.equal(good.statusCode,200,good.body);attachment=good.json().attachment;
  let r=await app.inject({method:'POST',url:path,headers,cookies,payload:{revision:0,command:{type:'message',id:randomUUID(),text:'Фото',attachment}}});assert.equal(r.statusCode,200,r.body);
  const managerUrl=attachment.url.replace('/api/v1/journey-media/','/api/v1/control/journey-media/');assert.ok(managerUrl.startsWith(cookie.path+'/'));
  assert.equal((await app.inject({url:managerUrl,cookies})).statusCode,200);
  assert.equal((await app.inject(attachment.url)).statusCode,401);
  assert.equal((await app.inject({url:attachment.url,headers:auth})).statusCode,200);
  const stranger=(await app.inject({method:'POST',url:'/api/v1/auth/session',headers,payload:{}})).json();assert.equal((await app.inject({url:attachment.url,headers:{authorization:'Bearer '+stranger.accessToken}})).statusCode,404);
  r=await app.inject({method:'POST',url:path,headers,cookies,payload:{revision:1,command:{type:'message',id:randomUUID(),text:'Повтор чужого файла',attachment}}});assert.equal(r.statusCode,400);
 });
 await t.test('history exceeds 100 messages, pages without duplicates, retry is idempotent',async()=>{
  for(let i=0;i<105;i++){const id=randomUUID();await db.query('insert into journey_messages(id,lead_id,document) values($1,$2,$3::jsonb)',[id,lead.id,JSON.stringify({id,author:'client',text:'Сообщение '+i,at:new Date().toISOString()})]);}
  const id=randomUUID(),body={revision:1,command:{type:'message',id,text:'Сообщение 107'}};
  const sent=await app.inject({method:'POST',url:path,headers,cookies,payload:body});assert.equal(sent.statusCode,200,sent.body);
  assert.equal((await app.inject({method:'POST',url:path,headers,cookies,payload:body})).statusCode,200);
  const messages:any[]=[];let before:number|undefined;
  do{const r=await app.inject({url:path+'/messages'+(before?'?before='+before:''),cookies});assert.equal(r.statusCode,200,r.body);messages.push(...r.json().messages);before=r.json().messagesBefore;}while(before);
  assert.equal(messages.length,107);assert.equal(new Set(messages.map(m=>m.id)).size,107);
  assert.equal((await db.query("select document->'messages' as messages from client_journeys where lead_id=$1",[lead.id])).rows[0].messages,null);
 });
 await t.test('concurrent upload reservations respect the pending quota',async()=>{
  const results=await Promise.allSettled(Array.from({length:11},()=>reserveUpload(db,root,lead.id,'quota-test','/api/v1/journey-media/'+lead.id+'/'+randomUUID()+'.png',1)));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,10);assert.equal(results.filter(r=>r.status==='rejected').length,1);
  await db.query("delete from journey_uploads where actor='quota-test'");
 });
 await t.test('unattached uploads expire, closed lead refuses upload',async()=>{
  const orphan=await app.inject({method:'POST',url:path+'/attachments',headers:{origin:config.PUBLIC_ORIGIN,'content-type':'image/png'},cookies,payload:await sharp({create:{width:2,height:2,channels:3,background:'red'}}).png().toBuffer()});assert.equal(orphan.statusCode,200,orphan.body);
  const url=orphan.json().attachment.url;await db.query("update journey_uploads set created_at=now()-interval '2 days' where url=$1",[url]);await cleanExpiredUploads(db,root);
  await assert.rejects(access(join(root,'private','chat',lead.id,url.split('/').at(-1))));
  await db.query("update leads set status='closed' where id=$1",[lead.id]);
  assert.equal((await app.inject({method:'POST',url:path+'/attachments',headers:{origin:config.PUBLIC_ORIGIN,'content-type':'image/png'},cookies,payload:Buffer.from([1])})).statusCode,409);
 });
 await t.test('search is server-side; direct lead lookup enforces assignment',async()=>{
  for(let i=0;i<310;i++)await db.query("insert into leads(name,phone,source) values($1,'+79990000000','test')",['Other '+i]);
  const result=await app.inject({url:'/api/v1/control/leads?q=Audit%20Client&limit=1',cookies});assert.equal(result.statusCode,200,result.body);assert.equal(result.json().total,1);assert.equal(result.json().items[0].id,lead.id);
  await db.query("insert into team_members(name,email,password_hash,role) values('Manager','scoped@example.test',$1,'manager')",[await hashPassword('audit-long-password')]);
  const manager=await app.inject({method:'POST',url:'/api/v1/control/login',headers,payload:{email:'scoped@example.test',password:'audit-long-password'}});const scoped={pulse_control:manager.cookies[0].value};
  assert.equal((await app.inject({url:'/api/v1/control/leads/'+lead.id,cookies:scoped})).statusCode,404);
  assert.equal((await app.inject({url:'/api/v1/control/leads?q=Audit',cookies:scoped})).json().total,0);
 });
});


test('migration preserves old messages, attachments and manual agreements',async t=>{
 const db=await testDatabase();t.after(()=>db.close());
 const folder=new URL('../migrations/',import.meta.url);
 for(const name of (await readdir(folder)).filter(n=>n.endsWith('.sql')&&n<'011').sort())await db.query(await readFile(new URL(name,folder),'utf8'));
 const lead=(await db.query("insert into leads(name,phone,source,next_action) values('Legacy','+79990000000','test','Позвонить в пятницу') returning id")).rows[0];
 const messages=[0,1,2].map(i=>({id:randomUUID(),author:'client',text:'Legacy '+i,at:new Date().toISOString(),attachment:{kind:'file',name:'old.pdf',url:'/api/v1/journey-media/'+lead.id+'/'+randomUUID()+'.pdf',mimeType:'application/pdf',size:100}}));
 await db.query('insert into client_journeys(lead_id,revision,document) values($1,4,$2::jsonb)',[lead.id,JSON.stringify({leadId:lead.id,revision:4,collections:[],showings:[],nextStep:null,messages})]);
 const migrationSql=await readFile(new URL('011_audit_reliability.sql',folder),'utf8');
 await db.transaction(async sql=>{await sql.query(migrationSql)});
 assert.deepEqual((await db.query('select document from journey_messages where lead_id=$1 order by sequence',[lead.id])).rows.map(r=>r.document),messages);
 assert.equal((await db.query('select count(*)::int as n from journey_uploads where lead_id=$1',[lead.id])).rows[0].n,3);
 assert.equal((await db.query('select next_action_manual from leads where id=$1',[lead.id])).rows[0].next_action_manual,true);
});
