import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
import {createApp} from '../src/app';
import {readConfig} from '../src/config';
import {handleBotUpdate} from '../src/telegramBot';
import {hashPassword} from '../src/security';
test('Mandatory contact: signed identity, consent, own contact, CRM permissions and no false leads',async()=>{
 const db=await testDatabase();await migrate(db);const config=readConfig({DATABASE_URL:'unused',NODE_ENV:'test',BOT_TOKEN:'test-token',REQUIRE_TELEGRAM_PHONE:'true'});const app=await createApp(db,config);
 try{
  const origin={origin:config.PUBLIC_ORIGIN};
  const session=await app.inject({method:'POST',url:'/api/v1/auth/session',headers:origin,payload:{}});const headers={...origin,authorization:'Bearer '+session.json().accessToken};
  assert.equal((await app.inject({url:'/api/v1/public/state'})).json().requiresPhone,true);
  assert.equal((await app.inject({url:'/api/v1/me/favorites',headers})).statusCode,403);
  assert.equal((await app.inject({method:'POST',url:'/api/v1/leads',headers,payload:{}})).statusCode,403);
  assert.equal((await app.inject({url:'/api/v1/me/account',headers})).json().registered,false);
  const contactRequest=(payload:any)=>app.inject({method:'POST',url:'/api/v1/me/account/contact-request',headers,payload});
  assert.equal((await contactRequest({consent:true,consentVersion:config.CONSENT_VERSION})).statusCode,401);
  const params=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:123,first_name:'Анна',last_name:'Иванова',username:'anna'})});const secret=createHmac('sha256','WebAppData').update(config.BOT_TOKEN).digest();params.set('hash',createHmac('sha256',secret).update([...params].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n')).digest('hex'));
  assert.equal((await app.inject({method:'POST',url:'/api/v1/auth/telegram',headers,payload:{initData:params.toString()}})).statusCode,200);
  assert.equal((await app.inject({url:'/api/v1/me/announcements',headers})).statusCode,403); // Phone gate still applies.
  assert.equal((await contactRequest({consent:true,consentVersion:'stale'})).statusCode,409);
  assert.equal((await contactRequest({consent:true,consentVersion:config.CONSENT_VERSION,phone:'+79991234567'})).statusCode,400,'client cannot submit a phone as proof');
  assert.equal((await contactRequest({consent:true,consentVersion:config.CONSENT_VERSION})).statusCode,200);
  const update=(id:number)=>({update_id:1,message:{chat:{id:123,type:'private'},from:{id:123,first_name:'Анна',last_name:'Иванова',username:'anna'},contact:{user_id:id,phone_number:'79991234567'}}});
  await db.transaction(sql=>handleBotUpdate(sql,config,async()=>({}),update(456)));
  assert.equal((await app.inject({url:'/api/v1/me/account',headers})).json().registered,false);
  await db.transaction(sql=>handleBotUpdate(sql,config,async()=>({}),update(123)));
  assert.equal((await app.inject({url:'/api/v1/me/account',headers})).json().registered,true);
  assert.equal((await app.inject({url:'/api/v1/me/favorites',headers})).statusCode,200);
  assert.equal((await app.inject({url:'/api/v1/me/announcements',headers})).json().enabled,true);
  await app.inject({method:'PUT',url:'/api/v1/me/announcements',headers,payload:{enabled:false}});
  await app.inject({method:'POST',url:'/api/v1/auth/telegram',headers,payload:{initData:params.toString()}});
  assert.equal((await app.inject({url:'/api/v1/me/announcements',headers})).json().enabled,false);
  assert.equal(Number((await db.query('select count(*) from leads')).rows[0].count),0);
  assert.equal((await app.inject('/api/v1/control/registrations')).statusCode,401);
  for(const role of ['owner','manager']){
   await db.query('insert into team_members(name,email,password_hash,role) values($1,$2,$3,$4)',[role,role+'@test.ru',await hashPassword('a-long-password-123'),role]);
   const login=await app.inject({method:'POST',url:'/api/v1/control/login',headers:origin,payload:{email:role+'@test.ru',password:'a-long-password-123'}});
   const cookies={pulse_control:login.cookies[0].value};const list=await app.inject({url:'/api/v1/control/registrations?q=7999',cookies});
   assert.equal(list.statusCode,role==='owner'?200:403);
   if(role==='owner'){assert.equal(list.json().total,1);assert.equal(list.json().items[0].first_name,'Анна');assert.equal(list.json().items[0].phone,'+79991234567');assert.equal(list.json().items[0].telegram_username,'anna');}
  }
 }finally{await app.close();await db.close()}
});
