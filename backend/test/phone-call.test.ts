import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
import {createApp} from '../src/app';
import {readConfig} from '../src/config';
import {zvonokCallSender,type PhoneCallSender} from '../src/phoneCall';
const settings={DATABASE_URL:'unused',NODE_ENV:'test',PWA_CALL_LOGIN:'true',ZVONOK_PUBLIC_KEY:'synthetic-key',ZVONOK_CAMPAIGN_ID:'123',PHONE_OTP_SECRET:'synthetic-secret-longer-than-thirty-two-characters'};
async function fixture(t:TestContext,call:PhoneCallSender=async()=>({code:'0042',callId:'1234'})){
 const db=await testDatabase();await migrate(db);const config=readConfig(settings);
 let calls=0;const app=await createApp(db,config,{phoneCall:async phone=>{calls++;return call(phone)},sms:async()=>{throw Error('SMS must never run')}});
 t.after(async()=>{await app.close();await db.close()});
 const session=async()=>{const s=(await app.inject({method:'POST',url:'/api/v1/auth/session',headers:{origin:config.PUBLIC_ORIGIN},payload:{}})).json();return {s,headers:{origin:config.PUBLIC_ORIGIN,authorization:'Bearer '+s.accessToken}}};
 const request=(h:any,phone='+79990001111')=>app.inject({method:'POST',url:'/api/v1/me/account/call/request',headers:h,payload:{phone,consent:true,consentVersion:config.CONSENT_VERSION}});
 const verify=(h:any,id:string,code='0042')=>app.inject({method:'POST',url:'/api/v1/me/account/call/verify',headers:h,payload:{challengeId:id,code}});
 return {db,app,config,session,request,verify,calls:()=>calls};
}
test('Flash Call adapter uses official form endpoint and keeps provider-selected leading zeros',async()=>{
 const config=readConfig(settings);
 const send=zvonokCallSender(config,(async(url:any,options:any)=>{
  assert.equal(url,'https://zvonok.com/manager/cabapi_external/api/v1/phones/flashcall/');
  assert.equal(options.redirect,'error');assert.equal(options.method,'POST');
  const form=options.body as FormData;assert.equal(form.get('public_key'),'synthetic-key');assert.equal(form.get('campaign_id'),'123');assert.equal(form.get('phone'),'+79990001111');assert.equal(form.has('phone_suffix'),false);
  return new Response(JSON.stringify({status:'ok',data:{pincode:'0042',call_id:1234,phone:'+79990001111'}}));
 }) as typeof fetch);
 assert.deepEqual(await send('+79990001111'),{code:'0042',callId:'1234'});
 for(const data of [{pincode:'12345',call_id:1,phone:'+79990001111'},{pincode:'0042',call_id:1,phone:'+79990002222'},{pincode:'0042',phone:'+79990001111'}]){
  await assert.rejects(zvonokCallSender(config,(async()=>new Response(JSON.stringify({status:'ok',data}))) as typeof fetch)('+79990001111'));
 }
});
test('Call challenge is session-bound, hashed, limited to three attempts and consumes no SMS',async t=>{
 const f=await fixture(t),a=await f.session(),b=await f.session();
 assert.equal((await f.app.inject({url:'/api/v1/public/pwa'})).json().phoneChannel,'call');
 const r=await f.request(a.headers);assert.equal(r.statusCode,200,r.body);assert.equal(r.json().codeLength,4);assert.equal(r.json().retryAfter,90);assert.ok(!r.body.includes('0042'));
 const id=r.json().challengeId,stored=(await f.db.query('select * from phone_login_challenges where id=$1',[id])).rows[0];assert.notEqual(stored.code_hash,'0042');assert.equal(stored.channel,'call');
 assert.equal((await f.verify(b.headers,id)).statusCode,400);
 assert.equal((await f.request(b.headers)).statusCode,429);
 for(let i=0;i<3;i++)assert.equal((await f.verify(a.headers,id,'0000')).statusCode,400);
 assert.equal((await f.verify(a.headers,id)).statusCode,400);
 const next=await f.request(a.headers,'+79990002222');const good=await f.verify(a.headers,next.json().challengeId);assert.equal(good.statusCode,200,good.body);assert.ok(good.headers['set-cookie']);
 assert.equal((await f.app.inject({url:'/api/v1/me/account',headers:a.headers})).statusCode,401);
 const h={...a.headers,authorization:'Bearer '+good.json().accessToken};
 assert.equal((await f.app.inject({url:'/api/v1/me/account',headers:h})).json().registered,true);
 assert.equal((await f.db.query('select auth_provider from sessions where id=$1',[a.s.sessionId])).rows[0].auth_provider,'call');
 assert.equal((await f.verify(h,next.json().challengeId)).statusCode,400);
 assert.equal((await f.app.inject({method:'POST',url:'/api/v1/me/account/sms/request',headers:b.headers,payload:{}})).statusCode,503);
 assert.equal(f.calls(),2);
});
test('Call expiry, pending delivery and failure cannot authorize; failed delivery still consumes quota',async t=>{
 const f=await fixture(t),a=await f.session();
 const r=await f.request(a.headers),id=r.json().challengeId;
 await f.db.query("update phone_login_challenges set delivery_state='pending' where id=$1",[id]);
 assert.equal((await f.verify(a.headers,id)).statusCode,400);
 await f.db.query("update phone_login_challenges set delivery_state='ready',expires_at=now()-interval '1 second' where id=$1",[id]);
 assert.equal((await f.verify(a.headers,id)).statusCode,400);
 const fail=await fixture(t,async()=>{throw Error('provider unavailable')});const b=await fail.session();
 assert.equal((await fail.request(b.headers)).statusCode,503);
 assert.equal((await fail.request(b.headers)).statusCode,429);
 assert.equal((await fail.db.query('select delivery_state from phone_login_challenges')).rows[0].delivery_state,'failed');
 assert.equal(fail.calls(),1);
});
test('Call login reuses a verified Telegram phone identity and requires separate partner protection',async t=>{
 const f=await fixture(t),a=await f.session();
 const user=(await f.db.query("insert into app_users(telegram_user_id,phone,first_name) values(123456789,'+79990001111','Тест') returning id")).rows[0].id;
 await f.db.query('insert into telegram_contact_consent(user_id,consent_version,accepted_at) values($1,$2,now())',[user,f.config.CONSENT_VERSION]);
 const r=await f.request(a.headers),v=await f.verify(a.headers,r.json().challengeId);assert.equal(v.statusCode,200,v.body);
 assert.equal((await f.db.query('select user_id from sessions where id=$1',[a.s.sessionId])).rows[0].user_id,user);
 const headers={...a.headers,authorization:'Bearer '+v.json().accessToken};
 assert.equal((await f.app.inject({url:'/api/v1/me/partner',headers})).statusCode,423,'a call login cannot bypass partner passkey protection');
 const options=await f.app.inject({method:'POST',url:'/api/v1/me/account/passkeys/register/options',headers,payload:{}});
 assert.equal(options.statusCode,200,options.body);
 await f.db.query("update sessions set phone_verified_at=now()-interval '6 minutes' where id=$1",[a.s.sessionId]);
 assert.equal((await f.app.inject({method:'POST',url:'/api/v1/me/account/passkeys/register/options',headers,payload:{}})).statusCode,428);
 assert.equal(Number((await f.db.query('select count(*) from app_users')).rows[0].count),1);
});
