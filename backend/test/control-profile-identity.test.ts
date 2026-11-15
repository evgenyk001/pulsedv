import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
import {createApp} from '../src/app';
import {readConfig} from '../src/config';
import {hashPassword} from '../src/security';
import {clientName,clientSearch} from '../../apps/control-center/src/clientIdentity';

test('Control client paths resolve current account contacts and preserve manager scope',async()=>{
 const db=await testDatabase();await migrate(db);
 const config=readConfig({DATABASE_URL:'unused',NODE_ENV:'test'});const app=await createApp(db,config);
 try{
  const user=(await db.query("insert into app_users(telegram_user_id,first_name,last_name,telegram_username) values(9007199254740991,'Анна','Иванова','anna') returning id")).rows[0];
  const session=randomUUID(),pwa=randomUUID(),anonymous=randomUUID();
  await db.query('insert into sessions(id,user_id) values($1,$2),($3,null),($4,$2)',[session,user.id,anonymous,pwa]);
  // A pre-existing profile can have no user_id while its session is already linked.
  await db.query('insert into visitor_profiles(session_id,score,event_count) values($1,25,1),($2,0,0),($3,10,1)',[session,anonymous,pwa]);
  await db.query("insert into user_events(idempotency_key,session_id,event_type,occurred_at) values($1,$2,'property_view',now()-interval '3 minutes'),($3,$4,'favorite_add',now()-interval '3 minutes')",[randomUUID(),session,randomUUID(),pwa]);
  await db.query("update sessions set auth_provider='telegram' where id=$1",[session]);
  await db.query("update sessions set auth_provider='telegram-web' where id=$1",[pwa]);
  await db.query(`insert into user_events(idempotency_key,session_id,event_type,occurred_at,metadata)
   values($1,$2,'page_view',now()-interval '2 minutes','{}'),
   ($3,$4,'page_view',now()-interval '1 minute','{"clientChannel":"pwa"}'),
   ($5,$4,'page_view',now()-interval '30 seconds','{"clientChannel":"pwa"}')`,[randomUUID(),session,randomUUID(),pwa,randomUUID()]);
  const cookies:Record<string,Record<string,string>>={};let managerId='';
  for(const role of ['owner','manager']){
   const member=(await db.query('insert into team_members(name,email,password_hash,role) values($1,$2,$3,$4) returning id',[role,role+'@test.ru',await hashPassword('long-test-password'),role])).rows[0];
   if(role==='manager')managerId=member.id;
   const login=await app.inject({method:'POST',url:'/api/v1/control/login',headers:{origin:config.PUBLIC_ORIGIN},payload:{email:role+'@test.ru',password:'long-test-password'}});
   assert.equal(login.statusCode,200,login.body);cookies[role]={pulse_control:login.cookies[0].value};
  }
  assert.equal((await app.inject('/api/v1/control/profiles')).statusCode,401);
  const before=(await app.inject({url:'/api/v1/control/profiles',cookies:cookies.owner})).json().items;
  assert.equal(before.find((p:any)=>p.sessionId===session).client.phone,null);
  assert.equal(before.length,2);
  const page=await app.inject({url:'/api/v1/control/profiles?limit=1',cookies:cookies.owner});
  assert.equal(page.json().total,2);
  // Sharing a phone immediately updates old paths, without a new event or profile rebuild.
  await db.query('update app_users set phone=$2 where id=$1',[user.id,'+79991234567']);
  for(const endpoint of ['profiles','snapshot']){
   const response=await app.inject({url:'/api/v1/control/'+endpoint,cookies:cookies.owner});assert.equal(response.statusCode,200,response.body);
   const rows=endpoint==='profiles'?response.json().items:response.json().profiles;
   const profile=rows.find((p:any)=>p.sessionId===session);
   assert.equal(profile.userId,user.id);
   assert.equal(profile.id,user.id);
   assert.deepEqual([...profile.sessionIds].sort(),[session,pwa].sort());
   assert.equal(profile.eventCount,2);
   assert.deepEqual(profile.client,{firstName:'Анна',lastName:'Иванова',phone:'+79991234567',username:'anna',telegramId:'9007199254740991'});
   assert.equal(clientName(profile),'Анна Иванова');
   for(const term of ['+79991234567','anna','9007199254740991'])assert.ok(clientSearch(profile).includes(term));
   const unknown=rows.find((p:any)=>p.sessionId===anonymous);assert.equal(unknown.client,null);assert.equal(clientName(unknown),'Посетитель '+anonymous.slice(0,8));
   const manager=await app.inject({url:'/api/v1/control/'+endpoint,cookies:cookies.manager});
   assert.deepEqual(endpoint==='profiles'?manager.json().items:manager.json().profiles,[]);
  }
  await db.query("insert into leads(session_id,source,name,phone,manager_id) values($1,'mini_app','Анна','+79991234567',$2)",[session,managerId]);
  for(const endpoint of ['profiles','snapshot']){
   const response=await app.inject({url:'/api/v1/control/'+endpoint,cookies:cookies.manager});assert.equal(response.statusCode,200,response.body);
   const rows=endpoint==='profiles'?response.json().items:response.json().profiles;
   assert.equal(rows.length,1);assert.deepEqual(rows[0].sessionIds,[session]);assert.equal(rows[0].sessionId,session);assert.equal(rows[0].client.phone,'+79991234567');
  }
  const history=(role:string,id:string)=>app.inject({url:'/api/v1/control/interest/'+id,cookies:cookies[role]});
  const all=await history('owner',session);assert.equal(all.statusCode,200,all.body);
  assert.deepEqual([...new Set(all.json().events.map((e:any)=>e.sessionId))].sort(),[session,pwa].sort());
  const assigned=await history('manager',session);assert.equal(assigned.statusCode,200,assigned.body);
  assert.deepEqual([...new Set(assigned.json().events.map((e:any)=>e.sessionId))],[session]);
  assert.equal((await history('manager',pwa)).statusCode,404);
  const summary=await app.inject({url:'/api/v1/control/analytics-summary',cookies:cookies.owner});
  assert.equal(summary.statusCode,200,summary.body);
  assert.deepEqual(summary.json().channels,{miniApp:1,pwa:1,unknown:0},'repeated PWA page views count once');
  const scopedSummary=await app.inject({url:'/api/v1/control/analytics-summary',cookies:cookies.manager});
  assert.deepEqual(scopedSummary.json().channels,{miniApp:1,pwa:0,unknown:0});
  const lead=(await db.query('select id from leads where session_id=$1',[session])).rows[0];
  const chat=await app.inject({url:'/api/v1/control/journeys/'+lead.id,cookies:cookies.manager});
  assert.equal(chat.statusCode,200,chat.body);
  assert.equal(chat.json().entry.lastClientActivity.channel,'pwa','chat reflects the latest activity of the linked account');
 }finally{await app.close();await db.close()}
});
