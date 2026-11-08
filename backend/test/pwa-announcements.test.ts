import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import * as webpush from 'web-push';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
import {createApp} from '../src/app';
import {readConfig} from '../src/config';
import {issueToken,tokenHash} from '../src/security';
import {deliverWebPush} from '../src/webPush';
import {outboxRepository} from '../src/outboxRepository';
import {processNotificationOutbox} from '../src/notificationWorker';
const content={kind:'news',title:'Новости PULSEDV.RU',body:'Новая подборка квартир.\n\n'+('Подробное описание предложения. '.repeat(20)),imageUrl:null,buttonLabel:'Открыть каталог',buttonPath:'/catalog'};
async function fixture(t:any,bot=true){
 const db=await testDatabase();await migrate(db);const keys=webpush.generateVAPIDKeys();const config=readConfig({DATABASE_URL:'unused',NODE_ENV:'test',BOT_TOKEN:bot?'test-bot':'',WEB_PUSH_PUBLIC_KEY:keys.publicKey,WEB_PUSH_PRIVATE_KEY:keys.privateKey});const app=await createApp(db,config);t.after(async()=>{await app.close();await db.close()});
 const member=(await db.query("insert into team_members(name,role) values('Тестовый владелец','owner') returning id")).rows[0].id,token=randomUUID();await db.query("insert into auth_tokens(token_hash,kind,member_id,expires_at) values($1,'control',$2,now()+interval '1 day')",[tokenHash(token),member]);
 const control={origin:config.PUBLIC_ORIGIN,cookie:'pulse_control='+token};
 const call=(method:any,path:string,body?:any,headers:any=control)=>app.inject({method,url:'/api/v1'+path,headers,...(body===undefined?{}:{payload:body})});
 const user=async(n:number,tg=false)=>{const phone='+7999555'+String(n).padStart(4,'0'),id=(await db.query('insert into app_users(phone,first_name,telegram_user_id) values($1,$2,$3) returning id',[phone,'Тест '+n,tg?1000+n:null])).rows[0].id;await db.query('insert into phone_registrations(user_id,phone,consent_version) values($1,$2,$3)',[id,phone,config.CONSENT_VERSION]);const sid=randomUUID();await db.query("insert into sessions(id,user_id,auth_provider) values($1,$2,'sms')",[sid,id]);const a=await issueToken(db,'visitor',sid);return {id,sid,h:{origin:config.PUBLIC_ORIGIN,authorization:'Bearer '+a.token}}};
 const subscribe=async(u:any,name:string)=>{const keys={p256dh:Buffer.concat([Buffer.from([4]),Buffer.alloc(64,1)]).toString('base64url'),auth:Buffer.alloc(16,2).toString('base64url')};const r=await call('POST','/me/push/subscribe',{endpoint:'https://fcm.googleapis.com/fcm/send/'+name,keys},u.h);assert.equal(r.statusCode,200,r.body)};
 const opt=async(u:any,enabled=true)=>{const r=await call('PUT','/me/pwa-announcements',{enabled},u.h);assert.equal(r.statusCode,200,r.body)};
 const campaign=async()=>{const id=randomUUID(),saved=await call('PUT','/control/broadcasts/'+id,{version:0,content});assert.equal(saved.statusCode,200,saved.body);return saved.json().item};
 const send=async(item:any)=>{const r=await call('POST','/control/broadcasts/'+item.id+'/send',{version:item.version});assert.equal(r.statusCode,200,r.body);return r.json().item};
 return {db,config,app,call,user,subscribe,opt,campaign,send};
}
test('PWA campaigns have explicit consent, immutable full-text inbox, scoped reads, one channel per user and separate push counts',async t=>{
 const f=await fixture(t),a=await f.user(1),b=await f.user(2,true),c=await f.user(3,true);
 assert.equal((await f.call('GET','/me/pwa-announcements',undefined,a.h)).json().enabled,false);
 for(const u of [b,c])await f.call('PUT','/me/announcements',{enabled:true},u.h);
 await f.subscribe(a,'a');await f.subscribe(b,'b1');await f.subscribe(b,'b2');await f.opt(a);await f.opt(b);
 const audience=(await f.call('GET','/control/broadcasts')).json();assert.equal(audience.subscribers,3);assert.equal(audience.pwaSubscribers,2);assert.equal(audience.telegramSubscribers,1);
 const draft=await f.campaign(),item=await f.send(draft);assert.equal(item.total,3);assert.equal(item.pwaInbox,2);assert.equal(item.sent,2);assert.equal(item.pending,1);assert.equal(item.pushPending,3);
 assert.equal((await f.send(draft)).total,3);assert.equal(Number((await f.db.query('select count(*) from pwa_announcement_receipts')).rows[0].count),2);
 const inbox=await f.call('GET','/me/notifications',undefined,a.h);assert.equal(inbox.statusCode,200,inbox.body);assert.equal(inbox.json().unreadCount,1);const notice=inbox.json().items.find((n:any)=>n.kind==='announcement');assert.ok(notice);const id=notice.href.split('/').at(-1);
 assert.equal((await f.call('GET','/me/pwa-announcements/'+id,undefined,a.h)).json().body,content.body.trim());
 assert.equal((await f.call('GET','/me/pwa-announcements/'+id,undefined,b.h)).statusCode,404,'same campaign does not permit another recipient receipt');
 assert.equal((await f.call('POST','/me/notifications/read',{ids:[notice.id]},a.h)).json().unreadCount,0);
 assert.equal((await f.call('POST','/me/notifications/dismiss',{ids:[notice.id]},a.h)).json().items.length,0);
 assert.equal((await f.call('GET','/me/pwa-announcements/'+id,undefined,a.h)).statusCode,200,'dismissal preserves the full message');
 const sent:any[]=[];await processNotificationOutbox(outboxRepository(f.db),{async sendMessage(m){sent.push(m)}},10);assert.equal(sent.length,1);assert.equal(sent[0].chatId,'1003');
 const pushes:any[]=[];await deliverWebPush(f.db,f.config,async(_s,p)=>{pushes.push(JSON.parse(p))});assert.equal(pushes.length,3);assert.ok(pushes.every(p=>p.url.startsWith('/app/#/announcements/')&&!p.body.includes(content.body)));
 const stats=(await f.call('GET','/control/broadcasts')).json().items[0];assert.equal(stats.sent,3);assert.equal(stats.pushSent,3);assert.equal(stats.pushPending,0);assert.equal(stats.status,'completed');
 const later=await f.user(4);await f.opt(later);assert.equal((await f.call('GET','/me/notifications',undefined,later.h)).json().items.length,0,'no history broadcast to later subscribers');
});
test('PWA-only campaigns work without a bot or push permission; revocation and cancellation prevent pending push',async t=>{
 const f=await fixture(t,false),a=await f.user(5),b=await f.user(6);await f.opt(a);await f.opt(b);await f.subscribe(a,'revoke');
 const first=await f.send(await f.campaign());assert.equal(first.total,2);assert.equal(first.sent,2);assert.equal(first.pushPending,1);
 assert.equal((await f.call('GET','/me/notifications',undefined,b.h)).json().unreadCount,1,'OS permission is not required for inbox delivery');
 await f.opt(a,false);await f.opt(a,true);let calls=0;await deliverWebPush(f.db,f.config,async()=>{calls++});assert.equal(calls,0,'re-enabling does not resurrect an old push');
 const second=await f.send(await f.campaign());assert.equal(second.pushPending,1);
 const cancel=await f.call('POST','/control/broadcasts/'+second.id+'/cancel',{version:second.version});assert.equal(cancel.statusCode,200,cancel.body);
 await deliverWebPush(f.db,f.config,async()=>{calls++});assert.equal(calls,0);assert.equal((await f.call('GET','/me/notifications',undefined,b.h)).json().unreadCount,2,'already saved inbox messages remain');
 const third=await f.send(await f.campaign());await deliverWebPush(f.db,f.config,async()=>{throw {statusCode:500}});assert.equal(Number((await f.db.query('select count(*) from push_deliveries where delivered_at is null and dead_at is null')).rows[0].count),1,'network failure is retryable');
 await f.db.query('update push_deliveries set available_at=now() where delivered_at is null and dead_at is null');await deliverWebPush(f.db,f.config,async()=>{calls++});assert.equal(calls,1);
 assert.equal((await f.send(third)).total,2);
});
test('PWA reminder push respects outbox schedule and skips a cancelled or missing showing',async t=>{
 const f=await fixture(t),a=await f.user(7);await f.subscribe(a,'reminder');
 await f.db.query("insert into outbox_events(topic,aggregate_type,aggregate_id,payload,available_at) values('user.showing_reminder','lead',$1,$2::jsonb,now()+interval '1 hour')",[randomUUID(),JSON.stringify({userId:a.id,showingId:randomUUID(),at:new Date(Date.now()+25*3600000).toISOString(),hours:24})]);
 let calls=0;await deliverWebPush(f.db,f.config,async()=>{calls++});assert.equal(calls,0,'not delivered immediately on scheduling');
 await f.db.query('update push_deliveries set available_at=now()');await deliverWebPush(f.db,f.config,async()=>{calls++});assert.equal(calls,0,'missing or cancelled showing does not notify');
});
test('PWA installation keeps only a public in-app destination with a stable app identity',async t=>{
 const f=await fixture(t,false);
 for(const route of ['/property/project-1','/partner-invite?code=p123456789012','/announcements/'+randomUUID()]){
  const r=await f.call('GET','/public/pwa-manifest?route='+encodeURIComponent(route));assert.equal(r.statusCode,200,r.body);assert.equal(r.json().id,'/app/');assert.equal(r.json().scope,'/app/');assert.equal(r.json().start_url,'/app/#'+route);
 }
 for(const route of ['https://attacker.test/','//attacker.test/','/profile?token=secret','/journey?phone=79995550101']){
  const r=await f.call('GET','/public/pwa-manifest?route='+encodeURIComponent(route));assert.equal(r.json().start_url,'/app/');
 }
 const anon=(await f.app.inject({method:'POST',url:'/api/v1/auth/session',headers:{origin:f.config.PUBLIC_ORIGIN},payload:{}})).json();assert.equal((await f.call('GET','/me/pwa-announcements',undefined,{origin:f.config.PUBLIC_ORIGIN,authorization:'Bearer '+anon.accessToken})).statusCode,403);
});
test('Choosing Telegram again revokes queued PWA marketing; operational notifications are unaffected',async t=>{
 const f=await fixture(t),a=await f.user(8,true);await f.opt(a);await f.subscribe(a,'switch');await f.send(await f.campaign());
 const change=await f.call('PUT','/me/announcements',{enabled:true},a.h);assert.equal(change.statusCode,200,change.body);assert.equal((await f.call('GET','/me/pwa-announcements',undefined,a.h)).json().enabled,false);
 let sent=0;await deliverWebPush(f.db,f.config,async()=>{sent++});assert.equal(sent,0);
 await f.db.query("insert into outbox_events(topic,aggregate_type,aggregate_id,payload) values('user.journey','lead',$1,$2::jsonb)",[randomUUID(),JSON.stringify({userId:a.id,deepLink:f.config.PUBLIC_ORIGIN+'/pulsedv/mini-app/#/journey'})]);
 await deliverWebPush(f.db,f.config,async()=>{sent++});assert.equal(sent,1,'marketing opt-out does not disable service updates');
});
test('A due showing push validates the live schedule even after Telegram delivery; reschedule invalidates it',async t=>{
 const f=await fixture(t),a=await f.user(9);await f.subscribe(a,'due-showing');
 const lead=(await f.db.query("insert into leads(user_id,session_id,source,name,phone) values($1,$2,'pwa','Тест','+79995550009') returning id",[a.id,a.sid])).rows[0].id;
 const showingId=randomUUID(),at=new Date(Date.now()+2*3600000-1000).toISOString();
 await f.db.query('insert into client_journeys(lead_id,document) values($1,$2::jsonb)',[lead,JSON.stringify({showings:[{id:showingId,status:'confirmed',at}]})]);
 const event=(await f.db.query("insert into outbox_events(topic,aggregate_type,aggregate_id,payload,processed_at) values('user.showing_reminder','lead',$1,$2::jsonb,now()) returning id",[lead,JSON.stringify({userId:a.id,showingId,at,hours:2})])).rows[0].id;
 let sent=0;await deliverWebPush(f.db,f.config,async()=>{sent++});assert.equal(sent,1,'Telegram settlement does not block the independent push');
 await f.db.query("insert into outbox_events(topic,aggregate_type,aggregate_id,payload) values('user.showing_reminder','lead',$1,$2::jsonb)",[lead,JSON.stringify({userId:a.id,showingId,at,hours:2})]);
 await f.db.query('update client_journeys set document=$2::jsonb where lead_id=$1',[lead,JSON.stringify({showings:[{id:showingId,status:'cancelled',at}]})]);
 await deliverWebPush(f.db,f.config,async()=>{sent++});assert.equal(sent,1,'cancelled schedule blocks an old due event');
 const delivered=(await f.db.query('select delivered_at from push_deliveries where event_id=$1',[event])).rows[0].delivered_at;assert.ok(delivered);
});
