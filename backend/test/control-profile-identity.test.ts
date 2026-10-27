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
  const session=randomUUID(),anonymous=randomUUID();
  await db.query('insert into sessions(id,user_id) values($1,$2),($3,null)',[session,user.id,anonymous]);
  // A pre-existing profile can have no user_id while its session is already linked.
  await db.query('insert into visitor_profiles(session_id) values($1),($2)',[session,anonymous]);
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
  // Sharing a phone immediately updates old paths, without a new event or profile rebuild.
  await db.query('update app_users set phone=$2 where id=$1',[user.id,'+79991234567']);
  for(const endpoint of ['profiles','snapshot']){
   const response=await app.inject({url:'/api/v1/control/'+endpoint,cookies:cookies.owner});assert.equal(response.statusCode,200,response.body);
   const rows=endpoint==='profiles'?response.json().items:response.json().profiles;
   const profile=rows.find((p:any)=>p.sessionId===session);
   assert.equal(profile.userId,user.id);
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
   assert.equal(rows.length,1);assert.equal(rows[0].sessionId,session);assert.equal(rows[0].client.phone,'+79991234567');
  }
 }finally{await app.close();await db.close()}
});
