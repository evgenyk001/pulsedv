import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHmac} from 'node:crypto';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
import {createApp} from '../src/app';
import {readConfig} from '../src/config';
import {hashPassword} from '../src/security';
import {PARTNER_TERMS_VERSION} from '../../packages/partners/model';
import {businessDay,emptyFinance} from '../../packages/pulse-data/business';
import {claimExpiresOn} from '../../packages/partners/policy';
function signed(id:number,token:string){const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'Synthetic'})});const secret=createHmac('sha256','WebAppData').update(token).digest();p.set('hash',createHmac('sha256',secret).update([...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n')).digest('hex'));return p.toString()}
test('Partner reservations: atomic first claimant, CRM uniqueness, buyer confirmation and private status',async t=>{
 const db=await testDatabase();await migrate(db);
 const config=readConfig({NODE_ENV:'test',DATABASE_URL:'unused',PUBLIC_ORIGIN:'http://localhost:8080',BOT_TOKEN:'reservation-test-token',PARTNER_OFFER_PUBLISHED:'true',PARTNER_OFFER_APPROVED_VERSION:PARTNER_TERMS_VERSION,LEGAL_OPERATOR_NAME:'Тест',LEGAL_OPERATOR_INN:'2540123456',LEGAL_OPERATOR_ADDRESS:'Тест',LEGAL_OPERATOR_REGISTRATION:'1234567890123',LEGAL_CONTACT_EMAIL:'test@example.test'});
 const app=await createApp(db,config);await app.ready();t.after(async()=>{await app.close();await db.close()});
 const headers={origin:config.PUBLIC_ORIGIN,'content-type':'application/json'};let n=10;
 const post=(url:string,payload:any,h:any=headers,cookies?:any)=>app.inject({method:'POST',url,payload,headers:h,cookies,remoteAddress:'127.2.0.'+(n++%240)});
 const visitor=async(id?:number)=>{const session=await post('/api/v1/auth/session',{});const h={...headers,authorization:'Bearer '+session.json().accessToken};if(id){const r=await post('/api/v1/auth/telegram',{initData:signed(id,config.BOT_TOKEN)},h);assert.equal(r.statusCode,200,r.body)}return h};
 const a=await visitor(810001),b=await visitor(810002),buyer=await visitor(810003),guest=await visitor();
 const join=async(h:any,name:string,phone:string)=>{const r=await post('/api/v1/me/partner/join',{name,phone,consent:true,termsVersion:PARTNER_TERMS_VERSION},h);assert.equal(r.statusCode,200,r.body);return r.json().partner};
 const pa=await join(a,'Первый партнёр','+79991000001'),pb=await join(b,'Второй партнёр','+79991000002');
 const input=(phone:string)=>({phone,label:'Синтетическая рекомендация',contactConsent:true,idempotencyKey:randomUUID()});
 const reserve=(data:any,h=a)=>post('/api/v1/me/partner/reservations',data,h);
 const leadInput=(phone:string,code?:string)=>({phone,name:'Тестовый покупатель',idempotencyKey:randomUUID(),source:'catalog',consent:true,consentVersion:config.CONSENT_VERSION,...(code?{referralCode:code,referralConsent:true}:{})});
 const password='synthetic-owner-password';await db.query("insert into team_members(name,email,password_hash,role) values('Owner','reservation-owner@example.test',$1,'owner'),('Admin','reservation-admin@example.test',$1,'admin')",[await hashPassword(password)]);
 const login=async(email:string)=>{const r=await post('/api/v1/control/login',{email,password});assert.equal(r.statusCode,200,r.body);return {pulse_control:r.cookies.find(c=>c.name==='pulse_control')!.value}};
 const owner=await login('reservation-owner@example.test'),admin=await login('reservation-admin@example.test');
 let held:any,heldInput:any;
 const accept=async(r:any)=>{const risk=(await app.inject({url:'/api/v1/control/partner-referrals/'+r.id,cookies:owner})).json().referral.antifraud;const result=await post('/api/v1/control/partner-referrals/'+r.id+'/review',{revision:r.revision,decision:'accept',contactConfirmed:true,note:'Контакт покупателя и сигналы проверены владельцем',riskAcknowledged:true,riskFingerprint:risk.fingerprint},headers,owner);assert.equal(result.statusCode,200,result.body);return (await db.query('select * from partner_referrals where id=$1',[r.id])).rows[0]};
 await t.test('requires verified partner and explicit permission; normalizes Russian phone formats',async()=>{
  assert.equal((await reserve(input('+79991111111'),guest)).statusCode,403);
  assert.equal((await reserve({...input('+79991111111'),contactConsent:false})).statusCode,400);
  assert.equal((await reserve(input('8 999 100 00 01'))).json().outcome,'self');
  heldInput=input('8 (999) 111-11-11');const first=await reserve(heldInput);assert.equal(first.statusCode,200,first.body);held=first.json().reservation;
  assert.equal(first.json().outcome,'reserved');assert.equal(held.phoneHint,'••• 1111');assert.equal(held.phone,undefined);
  const again=await reserve(heldInput);assert.equal(again.json().reservation.id,held.id);assert.equal(again.json().reservation.expiresAt,held.expiresAt);
  assert.equal((await reserve({...heldInput,label:'Другая подпись'})).statusCode,409);
  const duplicate=await reserve(input('+7 999 111 11 11'),b);assert.equal(duplicate.json().outcome,'not_unique');assert.equal(duplicate.json().reservation,undefined);assert.ok(!duplicate.body.includes(pa.name));
 });
 await t.test('20 concurrent reservations have exactly one owner and one active database record',async()=>{
  const results=await Promise.all(Array.from({length:20},(_,i)=>reserve(input(i%2?'+7 (999) 222-22-22':'8 999 222 22 22'),i%2?a:b)));
  for(const r of results)assert.equal(r.statusCode,200,r.body);
  const winners=results.filter(r=>r.json().outcome==='reserved');assert.equal(new Set(winners.map(r=>r.json().reservation.id)).size,1);
  assert.equal(results.filter(r=>r.json().outcome==='not_unique').length,10);
  assert.equal(Number((await db.query("select count(*) as n from partner_client_reservations where normalized_phone='+79992222222' and released_at is null and converted_referral_id is null")).rows[0].n),1);
 });
 await t.test('known direct buyers are rejected without exposing name or CRM details',async()=>{
  const r=await post('/api/v1/leads',leadInput('+79993333333'),guest);assert.equal(r.statusCode,200,r.body);
  const checked=await reserve(input('8 999 333 33 33'));assert.equal(checked.json().outcome,'not_unique');assert.ok(!checked.body.includes('Тестовый покупатель'));assert.ok(!checked.body.includes(r.json().id));
 });
 await t.test('buyer confirmation waits for owner review; only owner review converts a hold to a one-month claim',async()=>{
  const wrong=await post('/api/v1/leads',leadInput('+79994444444',held.code),buyer);assert.equal(wrong.statusCode,409,wrong.body);
  const stolen=await post('/api/v1/leads',leadInput('+79991111111',pb.code),buyer);assert.equal(stolen.statusCode,409,stolen.body);
  const data=leadInput('+7 (999) 111-11-11',held.code),r=await post('/api/v1/leads',data,buyer);assert.equal(r.statusCode,200,r.body);
  const retry=await post('/api/v1/leads',data,buyer);assert.equal(retry.json().id,r.json().id);assert.equal(retry.json().duplicate,true);
  assert.equal((await post('/api/v1/leads',{...data,referralCode:pb.code},buyer)).statusCode,409);
  let referral=(await db.query('select * from partner_referrals where lead_id=$1',[r.json().id])).rows[0];assert.equal(referral.status,'pending');assert.equal(Number((await db.query('select count(*) as n from partner_client_claims where referral_id=$1',[referral.id])).rows[0].n),0);referral=await accept(referral);assert.equal(referral.status,'accepted');assert.equal(referral.partner_id,pa.id);
  const date=(v:any)=>(v instanceof Date?v.toISOString():String(v)).slice(0,10);assert.equal(date(referral.claim_started_on),businessDay());assert.equal(date(referral.claim_expires_on),claimExpiresOn(businessDay()));
  assert.equal(Number((await db.query('select count(*) as n from partner_client_claims where referral_id=$1',[referral.id])).rows[0].n),1);
  assert.equal((await reserve(input('+79991111111'),b)).json().outcome,'not_unique');
  const cabinet=await app.inject({url:'/api/v1/me/partner',headers:a});assert.ok(!cabinet.body.includes('+79991111111'));assert.ok(cabinet.json().referrals.some((x:any)=>x.status==='accepted'));
  assert.equal((await reserve(heldInput)).json().outcome,'confirmed');
  const release=await post('/api/v1/control/partner-reservations/'+held.id+'/release',{reason:'Нельзя снять состоявшийся закреп'},headers,owner);assert.equal(release.statusCode,409);
 });
 await t.test('only owner can release with a recorded reason; released phone may be checked again',async()=>{
  const hold=(await reserve(input('+79995555555'))).json().reservation;
  const url='/api/v1/control/partner-reservations/'+hold.id+'/release';assert.equal((await post(url,{reason:'Покупатель отозвал согласие'},headers,admin)).statusCode,403);
  assert.equal((await post(url,{reason:'мало'},headers,owner)).statusCode,400);
  assert.equal((await post(url,{reason:'Покупатель отозвал согласие'},headers,owner)).statusCode,200);
  assert.equal((await reserve(input('+79995555555'),b)).json().outcome,'reserved');
  const logs=await db.query("select * from audit_log where action='partner.reservation.release' and entity_id=$1",[hold.id]);assert.equal(logs.rows.length,1);
 });
 await t.test('anonymous buyer waits for contact verification; owner acceptance converts the same hold',async()=>{
  const hold=(await reserve(input('+79997777777'))).json().reservation;
  const direct=await post('/api/v1/leads',leadInput('+79997777777'),guest);assert.equal(direct.statusCode,200,direct.body);
  const lead=await post('/api/v1/leads',leadInput('+79997777777',hold.code),guest);assert.equal(lead.statusCode,200,lead.body);
  const r=(await db.query('select * from partner_referrals where lead_id=$1',[lead.json().id])).rows[0];assert.equal(r.status,'pending');
  const cabinet=(await app.inject({url:'/api/v1/me/partner',headers:a})).json();assert.equal(cabinet.reservations.find((x:any)=>x.id===hold.id).submitted,true);
  const review=await post('/api/v1/control/partner-referrals/'+r.id+'/review',{revision:r.revision,decision:'accept',contactConfirmed:true,note:'Контакт покупателя подтверждён владельцем'},headers,owner);assert.equal(review.statusCode,200,review.body);
  assert.equal((await db.query('select converted_referral_id from partner_client_reservations where id=$1',[hold.id])).rows[0].converted_referral_id,r.id);
 });
 await t.test('a normal enquiry after the hold cannot steal its priority when the buyer later confirms',async()=>{
  const hold=(await reserve(input('+79990123456'))).json().reservation,v=await visitor(810004);
  const direct=await post('/api/v1/leads',leadInput('+79990123456'),v);assert.equal(direct.statusCode,200,direct.body);
  const confirmed=await post('/api/v1/leads',leadInput('+79990123456',hold.code),v);assert.equal(confirmed.statusCode,200,confirmed.body);
  const pending=(await db.query('select * from partner_referrals where lead_id=$1',[confirmed.json().id])).rows[0];assert.equal(pending.status,'pending');const r=await accept(pending);assert.equal(r.status,'accepted');assert.equal(r.partner_id,pa.id);
  assert.equal(Number((await db.query("select count(*) as n from partner_client_claims where normalized_phone='+79990123456'")).rows[0].n),1);
 });
 await t.test('verified identity cannot claim another phone after its first accepted referral',async()=>{
  const hold=(await reserve(input('+79998888888'),b)).json().reservation;
  const r=await post('/api/v1/leads',leadInput('+79998888888',hold.code),buyer);assert.equal(r.statusCode,409,r.body);
  assert.equal(Number((await db.query("select count(*) as n from partner_client_claims where normalized_phone='+79998888888'")).rows[0].n),0);
 });
 await t.test('expired holds are not silently renewed; a new request can claim the phone',async()=>{
  const data=input('+79996666666'),hold=(await reserve(data)).json().reservation;
  await db.query("update partner_client_reservations set created_at=now()-interval '8 days',expires_at=now()-interval '1 day' where id=$1",[hold.id]);
  assert.equal((await reserve(data)).json().outcome,'expired');const newHold=await reserve(input('+79996666666'),b);assert.equal(newHold.json().outcome,'reserved');assert.notEqual(newHold.json().reservation.id,hold.id);
 });
 await t.test('an ordinary invitation also honors the existing reservation of the same partner',async()=>{
  const hold=(await reserve(input('+79990300001'))).json().reservation,v=await visitor(810006);
  const lead=await post('/api/v1/leads',leadInput('+79990300001',pa.code),v);assert.equal(lead.statusCode,200,lead.body);
  const pending=(await db.query('select * from partner_referrals where lead_id=$1',[lead.json().id])).rows[0];assert.equal(pending.status,'pending');const r=await accept(pending);assert.equal(r.status,'accepted');assert.equal(r.partner_id,pa.id);
  assert.equal((await db.query('select converted_referral_id from partner_client_reservations where id=$1',[hold.id])).rows[0].converted_referral_id,r.id);
  const stolen=await post('/api/v1/leads',leadInput('+79990300001',pb.code),await visitor());assert.equal(stolen.statusCode,409,stolen.body);
 });
 await t.test('uniqueness priority preserves PostgreSQL timestamp microseconds',async()=>{
  const v=await visitor(810005),direct=await post('/api/v1/leads',leadInput('+79990200002'),v);assert.equal(direct.statusCode,200,direct.body);
  const hold=(await reserve(input('+79990200001'))).json().reservation;
  await db.query("update leads set created_at='2000-01-01T00:00:00.123123Z' where id=$1",[direct.json().id]);
  await db.query("update partner_client_reservations set created_at='2000-01-01T00:00:00.123456Z' where id=$1",[hold.id]);
  const r=await post('/api/v1/leads',leadInput('+79990200001',hold.code),v);assert.equal(r.statusCode,409,r.body);
 });
 await t.test('linking Telegram after an anonymous enquiry cannot bypass uniqueness at review',async()=>{
  const hold=(await reserve(input('+79990400003'),b)).json().reservation,g=await visitor();
  const lead=await post('/api/v1/leads',leadInput('+79990400003',hold.code),g);assert.equal(lead.statusCode,200,lead.body);
  const bind=await post('/api/v1/auth/telegram',{initData:signed(810003,config.BOT_TOKEN)},g);assert.equal(bind.statusCode,200,bind.body);
  const r=(await db.query('select * from partner_referrals where lead_id=$1',[lead.json().id])).rows[0];
  const review=await post('/api/v1/control/partner-referrals/'+r.id+'/review',{revision:r.revision,decision:'accept',contactConfirmed:true,note:'Проверка поздно подтверждённого аккаунта'},headers,owner);assert.equal(review.statusCode,409,review.body);
  const detail=await app.inject({url:'/api/v1/control/partner-referrals/'+r.id,cookies:owner});assert.equal(detail.json().referral.conflict,true);
 });
 await t.test('late identity overlap blocks both new accrual and recording payment of an earlier accrual',async()=>{
  const clients=[] as Array<{h:any;ref:any;leadId:string}>;
  for(const [phone,h] of [['+79990400001',a],['+79990400002',b]] as const){
   const hold=(await reserve(input(phone),h)).json().reservation,g=await visitor(),lead=await post('/api/v1/leads',leadInput(phone,hold.code),g);assert.equal(lead.statusCode,200,lead.body);
   let r=(await db.query('select * from partner_referrals where lead_id=$1',[lead.json().id])).rows[0];
   const review=await post('/api/v1/control/partner-referrals/'+r.id+'/review',{revision:r.revision,decision:'accept',contactConfirmed:true,note:'Контакт проверен до привязки Telegram'},headers,owner);assert.equal(review.statusCode,200,review.body);
   r=(await db.query('select * from partner_referrals where id=$1',[r.id])).rows[0];await db.query("update leads set status='deal',finance=$2::jsonb where id=$1",[lead.json().id,JSON.stringify({...emptyFinance(),commissionRub:100000,receivedOn:businessDay()})]);clients.push({h:g,ref:r,leadId:lead.json().id});
  }
  const accrued=await post('/api/v1/control/partner-referrals/'+clients[0].ref.id+'/accrue',{revision:clients[0].ref.revision},headers,owner);assert.equal(accrued.statusCode,200,accrued.body);const reward=accrued.json().reward;
  for(const c of clients){const bind=await post('/api/v1/auth/telegram',{initData:signed(810008,config.BOT_TOKEN)},c.h);assert.equal(bind.statusCode,200,bind.body)}
  const blockedAccrual=await post('/api/v1/control/partner-referrals/'+clients[1].ref.id+'/accrue',{revision:clients[1].ref.revision},headers,owner);assert.equal(blockedAccrual.statusCode,409,blockedAccrual.body);
  const blockedPay=await post('/api/v1/control/partner-rewards/'+reward.id+'/pay',{revision:reward.revision,withheldMinor:0,paidOn:businessDay(),payoutReference:'Тестовая операция',documentReference:'Тестовые документы',documentsChecked:true},headers,owner);assert.equal(blockedPay.statusCode,409,blockedPay.body);
  assert.equal((await db.query('select status from partner_rewards where id=$1',[reward.id])).rows[0].status,'accrued');
 });
 await t.test('a late Telegram binding cannot turn the partners own purchase into a reward',async()=>{
  const hold=(await reserve(input('+79990400004'))).json().reservation,g=await visitor();
  const lead=await post('/api/v1/leads',leadInput('+79990400004',hold.code),g);assert.equal(lead.statusCode,200,lead.body);let r=(await db.query('select * from partner_referrals where lead_id=$1',[lead.json().id])).rows[0];
  assert.equal((await post('/api/v1/control/partner-referrals/'+r.id+'/review',{revision:r.revision,decision:'accept',contactConfirmed:true,note:'Контакт проверен до привязки аккаунта'},headers,owner)).statusCode,200);
  r=(await db.query('select * from partner_referrals where id=$1',[r.id])).rows[0];await db.query("update leads set status='deal',finance=$2::jsonb where id=$1",[lead.json().id,JSON.stringify({...emptyFinance(),commissionRub:100000,receivedOn:businessDay()})]);
  assert.equal((await post('/api/v1/auth/telegram',{initData:signed(810001,config.BOT_TOKEN)},g)).statusCode,200);
  const accrue=await post('/api/v1/control/partner-referrals/'+r.id+'/accrue',{revision:r.revision},headers,owner);assert.equal(accrue.statusCode,409,accrue.body);assert.match(accrue.body,/Собственная покупка/);
  const detail=await app.inject({url:'/api/v1/control/partner-referrals/'+r.id,cookies:owner});assert.equal(detail.json().referral.conflict,true);
 });
 await t.test('Control reservation queue is independently paginated and includes its full count',async()=>{
  for(let i=0;i<35;i++){
   const invitation=(await db.query('insert into partner_invitations(partner_id,code,label) values($1,$2,$3) returning id',[pa.id,'queue'+randomUUID().replaceAll('-',''),'Очередь '+i])).rows[0];
   await db.query('insert into partner_client_reservations(id,partner_id,invitation_id,normalized_phone) values($1,$2,$3,$4)',[randomUUID(),pa.id,invitation.id,'+7988'+String(1000000+i)]);
  }
  const first=await app.inject({url:'/api/v1/control/partners?reservationPage=1',cookies:owner}),second=await app.inject({url:'/api/v1/control/partners?reservationPage=2',cookies:owner});assert.equal(first.statusCode,200,first.body);assert.equal(second.statusCode,200,second.body);
  assert.equal(first.json().reservations.length,30);assert.equal(first.json().reservationHasMore,true);assert.ok(first.json().reservationTotal>=35);assert.ok(second.json().reservations.length>0);
  assert.ok(second.json().reservations.every((x:any)=>!first.json().reservations.some((y:any)=>x.id===y.id)));
 });
 await t.test('payments and Control filters operate before pagination',async()=>{
  const old=(await db.query("insert into partner_referrals(partner_id,terms_version,attribution_code,created_at,status) values($1,$2,$3,now()-interval '10 days','accepted') returning id",[pa.id,PARTNER_TERMS_VERSION,pa.code])).rows[0];
  await db.query("insert into partner_rewards(referral_id,commission_rub,received_on,reserve_minor,base_minor,gross_minor,status) values($1,100000,current_date,600000,9400000,2820000,'requested')",[old.id]);
  for(let i=0;i<35;i++)await db.query('insert into partner_referrals(partner_id,terms_version,attribution_code) values($1,$2,$3)',[pa.id,PARTNER_TERMS_VERSION,pa.code]);
  const cabinet=await app.inject({url:'/api/v1/me/partner?filter=payments',headers:a});assert.equal(cabinet.statusCode,200,cabinet.body);assert.equal(cabinet.json().total,2);assert.ok(cabinet.json().referrals.some((r:any)=>r.id===old.id));
  const control=await app.inject({url:'/api/v1/control/partners?filter=payouts',cookies:owner});assert.equal(control.statusCode,200,control.body);assert.equal(control.json().total,2);assert.ok(control.json().referrals.some((r:any)=>r.id===old.id));
 });
});
