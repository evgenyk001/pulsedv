import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
import {createApp} from '../src/app';
import {readConfig} from '../src/config';
import {hashPassword} from '../src/security';
import {PARTNER_TERMS_VERSION} from '../../packages/partners/model';
import {businessDay,emptyFinance} from '../../packages/pulse-data/business';
function signed(id:number,token:string){const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'Buyer'})});const key=createHmac('sha256','WebAppData').update(token).digest();p.set('hash',createHmac('sha256',key).update([...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n')).digest('hex'));return p.toString()}

test('Server antifraud: opaque marks, cross-account signals, mandatory owner review and finance rechecks',async t=>{
 const db=await testDatabase();await migrate(db);
 const config=readConfig({NODE_ENV:'test',DATABASE_URL:'unused',PUBLIC_ORIGIN:'http://localhost:8080',BOT_TOKEN:'antifraud-test',PARTNER_OFFER_PUBLISHED:'true',PARTNER_OFFER_APPROVED_VERSION:PARTNER_TERMS_VERSION,LEGAL_OPERATOR_NAME:'Тест',LEGAL_OPERATOR_INN:'2540123456',LEGAL_OPERATOR_ADDRESS:'Адрес',LEGAL_OPERATOR_REGISTRATION:'1234567890123',LEGAL_CONTACT_EMAIL:'test@test.local'});
 const app=await createApp(db,config);await app.ready();t.after(async()=>{await app.close();await db.close()});
 const headers={origin:config.PUBLIC_ORIGIN,'content-type':'application/json','user-agent':'Test browser'};
 const password='antifraud-owner-password';const hash=await hashPassword(password);
 await db.query("insert into team_members(name,email,password_hash,role) values('Владелец','fraud-owner@test.local',$1,'owner'),('Администратор','fraud-admin@test.local',$1,'admin')",[hash]);
 const login=async(email:string)=>{const response=await app.inject({method:'POST',url:'/api/v1/control/login',headers,payload:{email,password}});assert.equal(response.statusCode,200,response.body);return {pulse_control:response.cookies.find(c=>c.name==='pulse_control')!.value}};
 const owner=await login('fraud-owner@test.local'),admin=await login('fraud-admin@test.local');
 let address=10;
 const visitor=async(id?:number,device?:string,ip?:string)=>{
  const remoteAddress=ip??'10.20.0.'+(address++);
  const session=await app.inject({method:'POST',url:'/api/v1/auth/session',headers,cookies:device?{pulse_device:device}:{},payload:{},remoteAddress});assert.equal(session.statusCode,200,session.body);
  const cookies={pulse_device:session.cookies.find(c=>c.name==='pulse_device')?.value??device!};
  const context={headers:{...headers,authorization:'Bearer '+session.json().accessToken},cookies,remoteAddress,sessionId:session.json().sessionId};
  if(id){const bind=await app.inject({method:'POST',url:'/api/v1/auth/telegram',...context,payload:{initData:signed(id,config.BOT_TOKEN)}});assert.equal(bind.statusCode,200,bind.body)}return context;
 };
 const post=(url:string,payload:any,v:any)=>app.inject({method:'POST',url,...v,payload});
 const control=(url:string,payload:any,cookies=owner)=>post(url,payload,{headers,cookies});
 const detail=async(id:string)=>(await app.inject({url:'/api/v1/control/partner-referrals/'+id,cookies:owner})).json().referral;
 const input=(phone:string,code?:string)=>({idempotencyKey:randomUUID(),source:'catalog',name:'Покупатель',phone,consent:true,consentVersion:config.CONSENT_VERSION,...(code?{referralCode:code,referralConsent:true}:{})});
 const partner=await visitor(700001),joined=await post('/api/v1/me/partner/join',{name:'Партнёр',phone:'+79996000001',consent:true,termsVersion:PARTNER_TERMS_VERSION},partner);assert.equal(joined.statusCode,200,joined.body);const p=joined.json().partner;
 const referral=async(v:any,phone:string,code=p.code)=>{const response=await post('/api/v1/leads',input(phone,code),v);assert.equal(response.statusCode,200,response.body);const r=(await db.query('select id from partner_referrals where lead_id=$1',[response.json().id])).rows[0];return detail(r.id)};
 const accept=(r:any,extra:any={})=>control('/api/v1/control/partner-referrals/'+r.id+'/review',{revision:r.revision,decision:'accept',contactConfirmed:true,note:'Связались с покупателем, проверили личность и рекомендацию',riskAcknowledged:true,riskFingerprint:r.antifraud.fingerprint,...extra});
 let flagged:any;
 await t.test('another phone and Telegram account on the partners browser are flagged, never auto-accepted',async()=>{
  const buyer=await visitor(700002,partner.cookies.pulse_device);
  flagged=await referral(buyer,'+79996000002');assert.equal(flagged.status,'pending');assert.equal(flagged.antifraud.level,'high');assert.ok(flagged.antifraud.signals.some((s:any)=>s.code==='partner_device'));
  assert.equal(flagged.antifraud.phoneVerification,'manual');assert.ok(!JSON.stringify(flagged).includes(partner.cookies.pulse_device));
  assert.equal((await accept(flagged,{riskAcknowledged:false})).statusCode,409);
  assert.equal((await accept(flagged,{riskFingerprint:'0'.repeat(64)})).statusCode,409);
  assert.equal((await control('/api/v1/control/partner-referrals/'+flagged.id+'/review',{revision:flagged.revision,decision:'accept',contactConfirmed:true,note:'Администратор не может закреплять'},admin)).statusCode,403);
  assert.equal(Number((await db.query('select count(*) as n from partner_client_claims where referral_id=$1',[flagged.id])).rows[0].n),0);
  assert.equal((await accept(flagged)).statusCode,200);assert.equal((await detail(flagged.id)).antifraud.reviewed,true);
  const cabinet=await app.inject({url:'/api/v1/me/partner',...partner});assert.equal(cabinet.statusCode,200,cabinet.body);assert.ok(!cabinet.body.includes('antifraud'));assert.ok(!cabinet.body.includes('partner_device'));
 });
 await t.test('initial device evidence survives clearing marks and removing live observations',async()=>{
  await db.query('delete from antifraud_observations where device_id=$1',[(await db.query('select antifraud_device_id from partner_referrals where id=$1',[flagged.id])).rows[0].antifraud_device_id]);
  const after=await detail(flagged.id);assert.ok(after.antifraud.signals.some((s:any)=>s.code==='partner_device'));assert.equal(after.antifraud.level,'high');
 });
 await t.test('same network alone does not identify the same device or deny a referral',async()=>{
  const pSession=await visitor(700001,undefined,'10.30.0.1');
  const buyer=await visitor(700003,undefined,'10.30.0.1');assert.notEqual(pSession.cookies.pulse_device,buyer.cookies.pulse_device);
  const r=await referral(buyer,'+79996000003');assert.equal(r.antifraud.level,'clear');assert.ok(r.antifraud.signals.some((s:any)=>s.code==='partner_network'));assert.ok(!r.antifraud.signals.some((s:any)=>s.code==='partner_device'));assert.equal((await accept(r)).statusCode,200);
 });
 await t.test('new device association after acceptance blocks accrual and payment until fresh owner review',async()=>{
  const buyer=await visitor(700004);let r=await referral(buyer,'+79996000004');assert.equal(r.antifraud.level,'clear');assert.equal((await accept(r)).statusCode,200);r=await detail(r.id);
  await db.query("update leads set status='deal',finance=$2::jsonb where id=$1",[r.leadId,JSON.stringify({...emptyFinance(),commissionRub:100000,receivedOn:businessDay()})]);
  const accrued=await control('/api/v1/control/partner-referrals/'+r.id+'/accrue',{revision:r.revision});assert.equal(accrued.statusCode,200,accrued.body);const reward=accrued.json().reward;
  await visitor(700001,partner.cookies.pulse_device);await visitor(700004,partner.cookies.pulse_device);let current=await detail(r.id);assert.equal(current.antifraud.level,'high');assert.equal(current.antifraud.reviewed,false);
  await app.inject({url:'/api/v1/me/partner',...buyer,cookies:{pulse_device:'0'.repeat(64)}});
  assert.equal((await detail(r.id)).antifraud.level,'high');
  const pay={revision:reward.revision,withheldMinor:0,paidOn:businessDay(),payoutReference:'Тестовая операция',documentReference:'Проверенные документы',documentsChecked:true};
  assert.equal((await control('/api/v1/control/partner-referrals/'+r.id+'/accrue',{revision:r.revision})).statusCode,409);
  assert.equal((await control('/api/v1/control/partner-rewards/'+reward.id+'/pay',pay)).statusCode,409);
  const review={revision:r.revision,contactConfirmed:true,riskAcknowledged:true,riskFingerprint:r.antifraud.fingerprint,note:'Повторно подтвердили личность, совместное устройство объяснено'};
  assert.equal((await control('/api/v1/control/partner-referrals/'+r.id+'/risk-review',review)).statusCode,409);
  assert.equal((await control('/api/v1/control/partner-referrals/'+r.id+'/risk-review',{...review,riskFingerprint:current.antifraud.fingerprint})).statusCode,200);
  current=await detail(r.id);assert.equal(current.antifraud.reviewed,true);assert.equal((await control('/api/v1/control/partner-rewards/'+reward.id+'/pay',pay)).statusCode,200);
  assert.equal(Number((await db.query('select count(*) as n from partner_risk_reviews where referral_id=$1',[r.id])).rows[0].n),2);
 });
 await t.test('earlier direct enquiry is linked through its original browser mark despite a new account and phone',async()=>{
  const direct=await visitor();const response=await post('/api/v1/leads',{...input('+79996000005'),source:'partner'},direct);assert.equal(response.statusCode,200,response.body);
  const buyer=await visitor(700005,direct.cookies.pulse_device),r=await referral(buyer,'+79996000006');assert.equal(r.antifraud.level,'high');const signal=r.antifraud.signals.find((s:any)=>s.code==='device_direct_client');assert.ok(signal);assert.ok(signal.evidence.includes(response.json().id));
 });
 await t.test('arbitrary mark and forwarded IP cannot be supplied as trusted device or network identity',async()=>{
  const forged='a'.repeat(64),v=await visitor(700006,forged);assert.notEqual(v.cookies.pulse_device,forged);
  const observed=(await db.query('select * from antifraud_observations where session_id=$1',[v.sessionId])).rows[0];assert.match(observed.ip_hash,/^[a-f0-9]{64}$/);assert.notEqual(observed.ip_hash,v.remoteAddress);
  const before=observed.ip_hash;
  await app.inject({url:'/api/v1/me/partner',...v,headers:{...v.headers,'x-forwarded-for':'8.8.8.8'}});
  assert.equal((await db.query('select ip_hash from antifraud_observations where session_id=$1',[v.sessionId])).rows[0].ip_hash,before);
 });
 await t.test('hard identity violations are recorded outside the rolled-back lead transaction',async()=>{
  const response=await post('/api/v1/leads',input('+79996000007',p.code),partner);assert.equal(response.statusCode,400);
  const queue=await app.inject({url:'/api/v1/control/partners',cookies:owner});assert.equal(queue.statusCode,200,queue.body);assert.ok(queue.json().securityAttempts.some((s:any)=>s.partnerName===p.name&&s.reason.includes('Собственная покупка')));
  assert.equal(Number((await db.query('select count(*) as n from leads where normalized_phone=$1',['+79996000007'])).rows[0].n),0);
 });
 await t.test('old automatic claims cannot move to finance without owner review, which preserves their dates',async()=>{
  const buyer=await visitor(700008);let r=await referral(buyer,'+79996000008');
  await db.query("update partner_referrals set status='accepted',accepted_at=now(),claim_started_on='2026-01-01',claim_expires_on='2026-02-01',reviewed_by=null where id=$1",[r.id]);
  await db.query("update leads set status='deal',finance=$2::jsonb where id=$1",[r.leadId,JSON.stringify({...emptyFinance(),commissionRub:100000,receivedOn:businessDay()})]);
  assert.equal((await control('/api/v1/control/partner-referrals/'+r.id+'/accrue',{revision:r.revision,dealOn:'2026-01-15'})).statusCode,409);
  r=await detail(r.id);assert.equal((await control('/api/v1/control/partner-referrals/'+r.id+'/risk-review',{revision:r.revision,contactConfirmed:true,riskAcknowledged:true,riskFingerprint:r.antifraud.fingerprint,note:'Владелец проверил старое автоматическое закрепление'})).statusCode,200);
  const after=await detail(r.id);assert.equal(after.claimStartedOn,'2026-01-01');assert.equal(after.claimExpiresOn,'2026-02-01');assert.ok(after.riskReviews.some((v:any)=>v.reviewerName==='Владелец'));
 });
 await t.test('active reservation cap cannot be bypassed by spreading reservations over several days',async()=>{
  for(let i=0;i<19;i++){
   const invitation=(await db.query('insert into partner_invitations(partner_id,code,label) values($1,$2,$3) returning id',[p.id,'i'+randomUUID().replaceAll('-',''),'Ранее созданная бронь'])).rows[0];
   await db.query("insert into partner_client_reservations(id,partner_id,invitation_id,normalized_phone,created_at) values($1,$2,$3,$4,now()-interval '1 day')",[randomUUID(),p.id,invitation.id,'+7999610'+String(1000+i)]);
  }
  const reserve=(phone:string)=>post('/api/v1/me/partner/reservations',{phone,label:'Новый покупатель',contactConsent:true,idempotencyKey:randomUUID()},partner);
  assert.equal((await reserve('+79996200001')).statusCode,200);const blocked=await reserve('+79996200002');assert.equal(blocked.statusCode,429,blocked.body);assert.match(blocked.body,/активных броней/);
 });

});
