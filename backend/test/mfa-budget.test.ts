import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
import {createApp} from '../src/app';
import {readConfig} from '../src/config';
import {hashPassword,mfaCodeHash} from '../src/security';

test('MFA: wrong attempts commit, five exhaust the budget, valid login and replay remain safe',async t=>{
 const db=await testDatabase();await migrate(db);
 const config=readConfig({NODE_ENV:'test',DATABASE_URL:'unused',PUBLIC_ORIGIN:'http://localhost:8080',BOT_TOKEN:'test-only-mfa-bot-token'});
 const app=await createApp(db,config);await app.ready();t.after(async()=>{await app.close();await db.close()});
 const member=(await db.query("insert into team_members(name,email,password_hash,role,telegram_user_id,mfa_enabled) values('MFA test','mfa-budget@test.local',$1,'owner',12345,true) returning id",[await hashPassword('long-test-password')])).rows[0];
 const headers={'content-type':'application/json',origin:config.PUBLIC_ORIGIN};let address=1;
 const post=(url:string,payload:unknown)=>app.inject({method:'POST',url,headers,payload:payload as any,remoteAddress:'127.0.0.'+(address++)});
 const challenge=async()=>{
  const response=await post('/api/v1/control/login',{email:'mfa-budget@test.local',password:'long-test-password'});assert.equal(response.statusCode,200,response.body);assert.equal(response.cookies.length,0);
  const id=response.json().challengeId;assert.ok(id);
  await db.query('update control_login_challenges set code_hash=$2 where id=$1',[id,mfaCodeHash(config.BOT_TOKEN,id,'000007')]);return id;
 };
 const verify=(challengeId:string,code:string)=>post('/api/v1/control/login/verify',{challengeId,code});
 const attempts=async(id:string)=>Number((await db.query('select attempts from control_login_challenges where id=$1',[id])).rows[0].attempts);
 const artifacts=async()=>({tokens:Number((await db.query("select count(*)::int n from auth_tokens where member_id=$1 and kind='control'",[member.id])).rows[0].n),audit:Number((await db.query("select count(*)::int n from audit_log where action='login.mfa' and member_id=$1",[member.id])).rows[0].n)});
 const id=await challenge();
 for(let count=1;count<=5;count++){
  const bad=await verify(id,'000008');assert.equal(bad.statusCode,401,bad.body);assert.equal(bad.cookies.length,0);assert.equal(await attempts(id),count);
 }
 assert.equal((await verify(id,'000007')).statusCode,401);assert.equal(await attempts(id),5);assert.deepEqual(await artifacts(),{tokens:0,audit:0});
 const fresh=await challenge();assert.equal((await verify(fresh,'000008')).statusCode,401);assert.equal(await attempts(fresh),1);
 const good=await verify(fresh,'000007');assert.equal(good.statusCode,200,good.body);assert.equal(good.json().member.id,member.id);assert.ok(good.cookies.find(c=>c.name==='pulse_control'));assert.deepEqual(await artifacts(),{tokens:1,audit:1});
 assert.equal((await verify(fresh,'000007')).statusCode,401);assert.deepEqual(await artifacts(),{tokens:1,audit:1});
 const concurrent=await challenge();
 const bads=await Promise.all(Array.from({length:6},()=>verify(concurrent,'000008')));assert.ok(bads.every(r=>r.statusCode===401));assert.equal(await attempts(concurrent),5);
 const exp=await challenge();await db.query("update control_login_challenges set expires_at=now()-interval '1 minute' where id=$1",[exp]);assert.equal((await verify(exp,'000007')).statusCode,401);assert.equal(await attempts(exp),0);
 assert.equal((await verify(randomUUID(),'000007')).statusCode,401);
 const active=await challenge();assert.equal((await verify(active,'7')).statusCode,400);assert.equal(await attempts(active),0);
 await db.query('update team_members set active=false where id=$1',[member.id]);assert.equal((await verify(active,'000007')).statusCode,401);assert.deepEqual(await artifacts(),{tokens:1,audit:1});
});
