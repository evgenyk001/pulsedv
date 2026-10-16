import {test} from 'node:test';
import {claimExpiresOn,claimDateError} from '../../packages/partners/policy';
import {offerText,OFFER_VERSION} from '../../packages/partners/offer';
import assert from 'node:assert/strict';
import {randomUUID,createHmac,createHash} from 'node:crypto';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
import {createApp} from '../src/app';
import {readConfig} from '../src/config';
import {hashPassword} from '../src/security';
import {runSecurityMaintenance} from '../src/maintenance';
import {businessDay,emptyFinance} from '../../packages/pulse-data/business';
import {PARTNER_TERMS_VERSION,partnerReward,referralCodeFromStart} from '../../packages/partners/model';
function signed(id:number,token:string){const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'Buyer'})});const secret=createHmac('sha256','WebAppData').update(token).digest();p.set('hash',createHmac('sha256',secret).update([...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n')).digest('hex'));return p.toString()}
test('Partner amounts use kopecks, exact commission and valid Telegram invitation parameters',()=>{
 assert.deepEqual(partnerReward(100000),{commissionRub:100000,reserveMinor:600000,baseMinor:9400000,grossMinor:2820000});
 assert.equal(partnerReward(7543219).grossMinor,212718776);assert.throws(()=>partnerReward(100.2));assert.throws(()=>partnerReward(-1));
 assert.equal(referralCodeFromStart('ref_p01234567890123456789'),'p01234567890123456789');assert.equal(referralCodeFromStart('ref_../../leads'),null);
});
test('Six calendar months clamp month end; deal date must be real, inclusive and within the claim',()=>{
 assert.equal(claimExpiresOn('2025-08-31'),'2026-02-28');assert.equal(claimExpiresOn('2023-08-31'),'2024-02-29');assert.equal(claimExpiresOn('2026-10-14'),'2027-04-14');
 assert.equal(claimDateError('2025-01-01','2025-07-01','2025-07-01','2026-10-14'),'');
 assert.match(claimDateError('2025-01-01','2025-07-01','2025-07-02','2026-10-14'),/окончания/);
 assert.match(claimDateError('2025-01-01','2025-07-01','2024-12-31','2026-10-14'),/раньше/);
 assert.match(claimDateError(null,null,'2026-02-30','2026-10-14'),/фактическую/);
 assert.match(claimDateError(null,null,'2026-10-15','2026-10-14'),/сегодняшнего/);
 assert.equal(claimDateError(null,null,'2025-07-02','2026-10-14'),'');
});
test('Partners API: identity, attribution, uniqueness, own cabinet, immutable accrual and manual payout',async t=>{
 const db=await testDatabase();await migrate(db);const config=readConfig({NODE_ENV:'test',DATABASE_URL:'unused',PUBLIC_ORIGIN:'http://localhost:8080',BOT_TOKEN:'partner-test-token',PARTNER_OFFER_PUBLISHED:'true',PARTNER_OFFER_APPROVED_VERSION:PARTNER_TERMS_VERSION,LEGAL_OPERATOR_NAME:'Тестовый организатор',LEGAL_OPERATOR_INN:'2540123456',LEGAL_OPERATOR_ADDRESS:'Тестовый адрес',LEGAL_OPERATOR_REGISTRATION:'1234567890123',LEGAL_CONTACT_EMAIL:'offer@test.local'});const app=await createApp(db,config);await app.ready();t.after(async()=>{await app.close();await db.close()});
 const headers={origin:config.PUBLIC_ORIGIN,'content-type':'application/json'},password='partner-long-password',hash=await hashPassword(password);
 const members=(await db.query("insert into team_members(name,email,password_hash,role) values('Owner','partner-owner@test.local',$1,'owner'),('Manager','partner-manager@test.local',$1,'manager'),('Admin','partner-admin@test.local',$1,'admin') returning *",[hash])).rows;
 const cookies=[];for(const m of members){const login=await app.inject({method:'POST',url:'/api/v1/control/login',headers,payload:{email:m.email,password}});assert.equal(login.statusCode,200,login.body);cookies.push({pulse_control:login.cookies.find(c=>c.name==='pulse_control')!.value})}
 const owner=cookies[0],manager=cookies[1],admin=cookies[2];
 const visitor=async(id?:number)=>{const r=await app.inject({method:'POST',url:'/api/v1/auth/session',headers,payload:{}});assert.equal(r.statusCode,200,r.body);const h={...headers,authorization:'Bearer '+r.json().accessToken};if(id){const bind=await app.inject({method:'POST',url:'/api/v1/auth/telegram',headers:h,payload:{initData:signed(id,config.BOT_TOKEN)}});assert.equal(bind.statusCode,200,bind.body)}return h};
 const a=await visitor(30001),b=await visitor(30002),buyer=await visitor(40001),anonymous=await visitor();
 const get=(url:string,h=a)=>app.inject({url,headers:h});
 let requestNumber=10;
 const post=(url:string,payload:any,h=a,c=undefined as any)=>app.inject({remoteAddress:'127.0.1.'+(requestNumber++),method:'POST',url,headers:h,cookies:c,payload});
 const control=(url:string,payload:any,c=owner)=>post(url,payload,headers,c);
 const join=(h:any,name:string,phone:string)=>post('/api/v1/me/partner/join',{name,phone,consent:true,termsVersion:PARTNER_TERMS_VERSION},h);
 const leadInput=(phone:string,code?:string)=>({idempotencyKey:randomUUID(),source:'catalog',propertyId:null,name:'Покупатель Иванов',phone,comment:null,consent:true,consentVersion:config.CONSENT_VERSION,...(code?{referralCode:code,referralConsent:true}:{})});
 let partnerA:any,partnerB:any,invite:any,ref:any,leadId:string,reward:any,leadSubmission:any;
 const referral=(id:string)=>app.inject({url:'/api/v1/control/leads/'+id+'/partner',cookies:owner});
 const review=(r:any,decision='accept',reason?:string)=>control('/api/v1/control/partner-referrals/'+r.id+'/review',{revision:r.revision,decision,contactConfirmed:true,note:'Покупатель подтвердил рекомендацию. Сверили CRM.',...(reason?{reason}:{})});
 const patch=async(id:string,payload:any)=>{const current=(await app.inject({url:'/api/v1/control/leads/'+id,cookies:owner})).json().lead;return app.inject({method:'PATCH',url:'/api/v1/control/leads/'+id,headers,cookies:owner,payload:{expectedUpdatedAt:current.updatedAt,...payload}})};
 await t.test('only verified Telegram identity joins, terms are required and joining is idempotent',async()=>{
  assert.equal((await join(anonymous,'Guest','+79991234567')).statusCode,403);
  assert.equal((await post('/api/v1/me/partner/join',{name:'Partner',phone:'+79991234567',consent:false,termsVersion:PARTNER_TERMS_VERSION})).statusCode,400);
  const first=await join(a,'Партнёр Анна','8 (999) 123-45-67');assert.equal(first.statusCode,200,first.body);partnerA=first.json().partner;assert.equal(partnerA.phone,'+79991234567');
  assert.equal((await join(a,'Партнёр Анна','+79991234567')).json().partner.id,partnerA.id);
  partnerB=(await join(b,'Партнёр Борис','+79991234568')).json().partner;
  assert.equal((await get('/api/v1/me/partner',anonymous)).json().authenticated,false);
  assert.equal((await get('/api/v1/me/partner',buyer)).json().partner,null);
  const publicData=(await app.inject('/api/v1/public/partner-invites/'+partnerA.code)).json();assert.equal(publicData.partnerName,partnerA.name);assert.equal(publicData.phone,undefined);assert.equal(publicData.userId,undefined);
 });
 await t.test('personal invitation is idempotent and cannot be overwritten by another partner',async()=>{
  const input={label:'Покупатель из Уссурийска',idempotencyKey:randomUUID()};const r=await post('/api/v1/me/partner/invitations',input);assert.equal(r.statusCode,200,r.body);invite=r.json().invitation;
  assert.equal((await post('/api/v1/me/partner/invitations',input)).json().invitation.code,invite.code);
  assert.equal((await post('/api/v1/me/partner/invitations',input,b)).statusCode,409);
  assert.equal((await post('/api/v1/me/partner/invitations',{...input,label:'Changed'})).statusCode,409);
 });
 await t.test('buyer consent and self-referral checked atomically; retry preserves original attribution',async()=>{
  assert.equal((await post('/api/v1/leads',{...leadInput('+79990000000',invite.code),referralConsent:false},buyer)).statusCode,400);
  assert.equal((await post('/api/v1/leads',leadInput('+79990000000',invite.code),a)).statusCode,400);
  assert.equal((await post('/api/v1/leads',leadInput(partnerA.phone,invite.code),buyer)).statusCode,400);
  assert.equal((await post('/api/v1/leads',leadInput('+79990000000','invalid0123456789'),buyer)).statusCode,404);
  assert.equal(Number((await db.query('select count(*) as n from leads')).rows[0].n),0);
  const input=leadInput('8 (999) 000-00-00',invite.code);leadSubmission=input;const r=await post('/api/v1/leads',input,buyer);assert.equal(r.statusCode,200,r.body);leadId=r.json().id;
  assert.equal((await post('/api/v1/leads',input,buyer)).json().id,leadId);
  assert.equal((await post('/api/v1/leads',{...input,referralCode:partnerB.code},buyer)).statusCode,409);
  assert.equal(Number((await db.query('select count(*) as n from partner_referrals')).rows[0].n),1);
  ref=(await referral(leadId)).json().referral;assert.equal(ref.invitationId,invite.id);assert.equal(ref.status,'pending');assert.equal(ref.conflict,false);
  assert.equal((await app.inject({url:'/api/v1/control/partners',cookies:manager})).statusCode,403);
  assert.equal((await app.inject({url:'/api/v1/control/partners',cookies:admin})).statusCode,200);
  assert.equal((await control('/api/v1/control/partner-referrals/'+ref.id+'/review',{revision:1,decision:'accept',contactConfirmed:true,note:'Owner only'},manager)).statusCode,403);
 });
 await t.test('confirmed new buyer can be claimed only once by phone and verified identity',async()=>{
  assert.equal((await control('/api/v1/control/partner-referrals/'+ref.id+'/review',{revision:1,decision:'accept',contactConfirmed:false,note:'Incomplete'})).statusCode,400);
  assert.equal((await review(ref)).statusCode,200);assert.equal((await review(ref)).statusCode,409);ref=(await referral(leadId)).json().referral;
  const otherBuyer=await visitor(40002),dup=await post('/api/v1/leads',leadInput('+7 (999) 000-00-00',partnerB.code),otherBuyer);assert.equal(dup.statusCode,200,dup.body);
  const duplicate=(await referral(dup.json().id)).json().referral;assert.equal(duplicate.conflict,true);assert.equal((await review(duplicate)).statusCode,409);assert.equal((await review(duplicate,'reject','duplicate')).statusCode,200);
  const sameUser=await post('/api/v1/leads',leadInput('+79990000002',partnerB.code),buyer),sameRef=(await referral(sameUser.json().id)).json().referral;assert.equal(sameRef.conflict,true);assert.equal((await review(sameRef)).statusCode,409);
  assert.equal(Number((await db.query('select count(*) as n from partner_client_claims')).rows[0].n),1);
 });
 await t.test('pre-existing direct client is not unique and earlier unconfirmed referral can be rejected',async()=>{
  const v=await visitor();const direct=await post('/api/v1/leads',leadInput('+79990000003'),v);assert.equal(direct.statusCode,200,direct.body);
  const referred=await post('/api/v1/leads',leadInput('8 999 000 00 03',partnerB.code),v),r=(await referral(referred.json().id)).json().referral;assert.equal(r.conflict,true);assert.match(r.conflictDetails,/прямое обращение/);assert.equal((await review(r)).statusCode,409);
  const first=await post('/api/v1/leads',leadInput('+79990000004',partnerA.code),v),second=await post('/api/v1/leads',leadInput('+79990000004',partnerB.code),v);
  const r1=(await referral(first.json().id)).json().referral,r2=(await referral(second.json().id)).json().referral;
  assert.equal((await review(r2)).statusCode,409);assert.equal((await review(r1,'reject','unconfirmed')).statusCode,200);assert.equal((await review(r2)).statusCode,200);
 });
 await t.test('simultaneous submissions cannot create two claims for one normalized phone',async()=>{
  const v1=await visitor(),v2=await visitor();const submitted=await Promise.all([post('/api/v1/leads',leadInput('+79990000009',partnerA.code),v1),post('/api/v1/leads',leadInput('8 (999) 000-00-09',partnerB.code),v2)]);for(const r of submitted)assert.equal(r.statusCode,200,r.body);
  const rows=await Promise.all(submitted.map(async s=>(await referral(s.json().id)).json().referral));const reviewed=await Promise.all(rows.map(r=>review(r)));assert.deepEqual(reviewed.map(r=>r.statusCode).sort(),[200,409]);
  assert.equal(Number((await db.query('select count(*) as n from partner_client_claims where normalized_phone=$1',['+79990000009'])).rows[0].n),1);
 });
 await t.test('partner sees own history and masked name, no CRM notes, phone or documents',async()=>{
  const pa=(await get('/api/v1/me/partner')).json(),pb=(await get('/api/v1/me/partner',b)).json();assert.ok(!pb.referrals.some((r:any)=>r.id===ref.id));const r=pa.referrals.find((r:any)=>r.id===ref.id);
  assert.equal(r.clientName,'Покупатель И.');assert.equal(r.clientPhone,undefined);assert.equal(r.reviewNote,undefined);assert.equal(r.conflictDetails,undefined);assert.equal(r.leadId,null);
  assert.ok(r.events.some((e:any)=>e.kind==='accepted'));
  const result=await patch(leadId,{status:'showing',comment:'Private financial discussion'});assert.equal(result.statusCode,200,result.body);
  const cabinet=await get('/api/v1/me/partner');assert.ok(cabinet.json().referrals.find((r:any)=>r.id===ref.id).events.some((e:any)=>e.label==='Организуем показ'));assert.ok(!cabinet.body.includes('Private financial discussion'));
  assert.equal((await get('/api/v1/me/partner?limit=101')).statusCode,400);
 });
 await t.test('accrual requires received commission and deal, exact amount is snapshotted once',async()=>{
  const url='/api/v1/control/partner-referrals/'+ref.id+'/accrue';assert.equal((await control(url,{revision:ref.revision})).statusCode,400);
  assert.equal((await patch(leadId,{status:'deal',finance:{...emptyFinance(),commissionRub:100000}})).statusCode,200);assert.equal((await control(url,{revision:ref.revision})).statusCode,400);
  assert.equal((await patch(leadId,{finance:{...emptyFinance(),commissionRub:100000,receivedOn:businessDay()}})).statusCode,200);
  const responses=await Promise.all([control(url,{revision:ref.revision}),control(url,{revision:ref.revision})]);for(const r of responses)assert.equal(r.statusCode,200,r.body);reward=responses[0].json().reward;
  assert.equal(responses[1].json().reward.id,reward.id);assert.equal(reward.grossMinor,2820000);assert.equal(reward.receivedOn,businessDay());
  assert.equal((await patch(leadId,{finance:{...emptyFinance(),commissionRub:200000,receivedOn:businessDay()}})).statusCode,409);
  assert.equal((await patch(leadId,{status:'showing'})).statusCode,409);
  assert.equal((await post('/api/v1/me/partner/rewards/'+reward.id+'/request',{recipientType:'person'},b)).statusCode,404);
 });
 await t.test('unpaid accrual can be voided and corrected without erasing history',async()=>{
  assert.equal((await control('/api/v1/control/partner-rewards/'+reward.id+'/void',{revision:reward.revision,reason:'Проверка первичных документов'})).statusCode,200);
  const r=await control('/api/v1/control/partner-referrals/'+ref.id+'/accrue',{revision:ref.revision});assert.equal(r.statusCode,200,r.body);const old=reward.id;reward=r.json().reward;assert.notEqual(old,reward.id);
  assert.equal(Number((await db.query('select count(*) as n from partner_rewards where referral_id=$1',[ref.id])).rows[0].n),2);
  const request=()=>post('/api/v1/me/partner/rewards/'+reward.id+'/request',{recipientType:'person'});assert.equal((await request()).statusCode,200);assert.equal((await request()).statusCode,200);
  reward=(await referral(leadId)).json().referral.reward;assert.equal(reward.status,'requested');assert.equal(reward.revision,2);
 });
 await t.test('payout needs owner, documents and actual date; concurrency cannot pay twice; summary subtracts gross',async()=>{
  const url='/api/v1/control/partner-rewards/'+reward.id+'/pay',payload={revision:reward.revision,withheldMinor:366600,paidOn:businessDay(),payoutReference:'Payment-001',documentReference:'Contract-001 / act',documentsChecked:true};
  assert.equal((await control(url,payload,admin)).statusCode,403);assert.equal((await control(url,{...payload,documentsChecked:false})).statusCode,400);assert.equal((await control(url,{...payload,withheldMinor:2820001})).statusCode,400);
  const results=await Promise.all([control(url,payload),control(url,payload)]);assert.deepEqual(results.map(r=>r.statusCode).sort(),[200,409]);
  const cabinet=(await get('/api/v1/me/partner')).json(),r=cabinet.referrals.find((r:any)=>r.id===ref.id);assert.equal(r.reward.status,'paid');assert.equal(r.reward.paidMinor,2453400);assert.equal(r.reward.paidOn,businessDay());assert.equal(r.reward.documentReference,undefined);assert.equal(r.reward.payoutReference,undefined);assert.equal(cabinet.summary.paidMinor,2453400);
  assert.equal((await control('/api/v1/control/partner-rewards/'+reward.id+'/void',{revision:3,reason:'Cannot void paid'})).statusCode,409);
  const summary=(await app.inject({url:'/api/v1/control/finance-summary?from='+businessDay()+'&to='+businessDay(),cookies:owner})).json();assert.equal(summary.partnerPaid,28200);assert.equal(summary.received,100000);assert.equal(summary.balance,71800);
 });
 await t.test('pause disables new invitations and attribution but keeps existing ledger and idempotent leads',async()=>{
  const r=await app.inject({method:'PATCH',url:'/api/v1/control/partners/'+partnerA.id,headers,cookies:owner,payload:{status:'paused'}});assert.equal(r.statusCode,200,r.body);
  assert.equal((await app.inject('/api/v1/public/partner-invites/'+invite.code)).statusCode,404);
  assert.equal((await post('/api/v1/me/partner/invitations',{label:'New invite',idempotencyKey:randomUUID()})).statusCode,403);
  assert.equal((await post('/api/v1/leads',leadInput('+79990000005',invite.code),buyer)).statusCode,404);
  assert.equal((await get('/api/v1/me/partner')).json().summary.paidMinor,2453400);
  const retry=await post('/api/v1/leads',leadSubmission,buyer);assert.equal(retry.statusCode,200,retry.body);assert.equal(retry.json().id,leadId);
 });
 await t.test('retention anonymizes buyer identifiers and private notes, preserves partner account and financial snapshot',async()=>{
  await db.query("alter table leads disable trigger user");
  await db.query("update leads set status='closed',updated_at=now()-interval '800 days' where id=$1",[leadId]);
  await db.query("alter table leads enable trigger user");
  await runSecurityMaintenance(db,config);
  const r=(await db.query('select * from partner_referrals where id=$1',[ref.id])).rows[0],claim=(await db.query('select * from partner_client_claims where referral_id=$1',[ref.id])).rows[0];assert.equal(r.normalized_phone,null);assert.equal(r.buyer_user_id,null);assert.equal(r.review_note,null);assert.equal(claim.normalized_phone,null);
  assert.equal((await get('/api/v1/me/partner')).json().summary.paidMinor,2453400);assert.equal((await get('/api/v1/me/partner')).json().partner.id,partnerA.id);
 });
 await t.test('published offer and acceptance keep full text, issuer, hash and version; retries do not duplicate',async()=>{
  const offer=(await get('/api/v1/public/partner-offer')).json();assert.equal(offer.published,true);assert.equal(offer.version,OFFER_VERSION);assert.equal(offer.operator.registration,config.LEGAL_OPERATOR_REGISTRATION);
  assert.equal((await get('/api/v1/public/partner-offer?version=unknown')).statusCode,400);
  assert.equal((await get('/api/v1/public/partner-offer?version=partners-v1')).json().published,false);
  const snapshots=(await db.query('select * from partner_terms_acceptances where partner_id=$1',[partnerB.id])).rows;assert.equal(snapshots.length,1);const saved=snapshots[0];
  assert.equal(saved.document_text,offerText());assert.equal(saved.terms_version,OFFER_VERSION);assert.equal(saved.publication_state,'published');assert.ok(saved.accepted_at);
  assert.equal(saved.document_sha256,createHash('sha256').update(JSON.stringify({version:OFFER_VERSION,text:offerText(),operator:offer.operator})).digest('hex'));
  assert.equal((await post('/api/v1/me/partner/terms',{consent:true,termsVersion:OFFER_VERSION},b)).statusCode,200);
  assert.equal(Number((await db.query('select count(*) as n from partner_terms_acceptances where partner_id=$1',[partnerB.id])).rows[0].n),1);
  const draft=await createApp(db,readConfig({NODE_ENV:'test',DATABASE_URL:'unused',PUBLIC_ORIGIN:config.PUBLIC_ORIGIN,BOT_TOKEN:config.BOT_TOKEN}));await draft.ready();
  try{assert.equal((await draft.inject('/api/v1/public/partner-offer')).json().published,false);assert.equal((await draft.inject({method:'POST',url:'/api/v1/me/partner/terms',headers:b,payload:{consent:true,termsVersion:OFFER_VERSION}})).statusCode,409)}finally{await draft.close()}
 });
 await t.test('new claims expire in six months; late commission is allowed only for a deal within the claim',async()=>{
  const v=await visitor(),submitted=await post('/api/v1/leads',leadInput('+79990000020',partnerB.code),v);assert.equal(submitted.statusCode,200,submitted.body);const id=submitted.json().id;
  let r=(await referral(id)).json().referral;assert.equal(r.termsVersion,OFFER_VERSION);assert.equal((await review(r)).statusCode,200);r=(await referral(id)).json().referral;
  assert.equal(r.claimStartedOn,businessDay());assert.equal(r.claimExpiresOn,claimExpiresOn(businessDay()));
  assert.equal((await patch(id,{status:'deal',finance:{...emptyFinance(),commissionRub:100000,receivedOn:businessDay()}})).statusCode,200);
  await db.query("update partner_referrals set claim_started_on='2025-01-01',claim_expires_on='2025-07-01' where id=$1",[r.id]);
  const url='/api/v1/control/partner-referrals/'+r.id+'/accrue';
  const outside=await control(url,{revision:r.revision,dealOn:'2025-07-02'});assert.equal(outside.statusCode,400,outside.body);
  assert.equal((await control(url,{revision:r.revision,dealOn:'2024-12-31'})).statusCode,400);
  assert.equal((await control(url,{revision:r.revision,dealOn:'2025-02-30'})).statusCode,400);
  const inside=await control(url,{revision:r.revision,dealOn:'2025-07-01'});assert.equal(inside.statusCode,200,inside.body);assert.equal(inside.json().reward.dealOn,'2025-07-01');assert.equal(inside.json().reward.grossMinor,2820000);
  const duplicate=await post('/api/v1/leads',leadInput('+79990000020',partnerB.code),await visitor());const duplicateRef=(await referral(duplicate.json().id)).json().referral;assert.equal(duplicateRef.conflict,true);assert.equal((await review(duplicateRef)).statusCode,409);
 });
 await t.test('new acceptance is explicit, preserves legacy referrals and enables invitations again',async()=>{
  const v=await visitor(),submitted=await post('/api/v1/leads',leadInput('+79990000021',partnerB.code),v);assert.equal(submitted.statusCode,200,submitted.body);const id=submitted.json().id;
  await db.query("update partner_profiles set terms_version='partners-v1' where id=$1",[partnerB.id]);await db.query("update partner_referrals set terms_version='partners-v1' where lead_id=$1",[id]);
  assert.equal((await get('/api/v1/public/partner-invites/'+partnerB.code)).statusCode,404);
  assert.equal((await post('/api/v1/me/partner/invitations',{label:'Старая редакция',idempotencyKey:randomUUID()},b)).statusCode,403);
  assert.equal((await join(b,partnerB.name,partnerB.phone)).json().partner.termsVersion,'partners-v1');
  assert.equal((await post('/api/v1/me/partner/terms',{consent:false,termsVersion:OFFER_VERSION},b)).statusCode,400);
  assert.equal((await post('/api/v1/me/partner/terms',{consent:true,termsVersion:OFFER_VERSION},b)).statusCode,200);
  assert.equal((await get('/api/v1/public/partner-invites/'+partnerB.code)).statusCode,200);
  let old=(await referral(id)).json().referral;assert.equal((await review(old)).statusCode,200);old=(await referral(id)).json().referral;assert.equal(old.termsVersion,'partners-v1');assert.equal(old.claimStartedOn,null);assert.equal(old.claimExpiresOn,null);
  const submitted2=await post('/api/v1/leads',leadInput('+79990000022',partnerB.code),await visitor());const current=(await referral(submitted2.json().id)).json().referral;assert.equal(current.termsVersion,OFFER_VERSION);
  assert.equal((await review(current,'reject','fraud')).statusCode,200);assert.equal((await referral(submitted2.json().id)).json().referral.rejectionReason,'fraud');
 });

});
