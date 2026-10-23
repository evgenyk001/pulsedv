import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
import {createApp} from '../src/app';
import {readConfig} from '../src/config';
import {tokenHash} from '../src/security';
import {outboxRepository} from '../src/outboxRepository';
import {processNotificationOutbox,TelegramDeliveryError} from '../src/notificationWorker';
import {telegramSender} from '../src/telegramSender';
import {broadcastText} from '../../packages/broadcasts';
const content={kind:'apartment',title:'Квартира дня',body:'ЖК у моря. Условия уточнит менеджер.',imageUrl:null,buttonLabel:'Смотреть ЖК',buttonPath:'/property/primorskiy'};
async function fixture(t:any,bot=true){
 const db=await testDatabase();await migrate(db);const media=await mkdtemp(join(tmpdir(),'pulse-broadcast-'));const config=readConfig({NODE_ENV:'test',DATABASE_URL:'unused',PUBLIC_ORIGIN:'http://localhost:8080',BOT_TOKEN:bot?'test-token':'',MEDIA_ROOT:media});const app=await createApp(db,config);await app.ready();t.after(async()=>{await app.close();await db.close();await rm(media,{recursive:true,force:true})});
 const headers={origin:config.PUBLIC_ORIGIN,'content-type':'application/json'};
 const controls:Record<string,any>={};for(const role of ['owner','manager']){const id=(await db.query('insert into team_members(name,role,telegram_user_id) values($1,$1,$2) returning id',[role,role==='owner'?9000:9001])).rows[0].id;const token=randomUUID();await db.query("insert into auth_tokens(token_hash,kind,member_id,expires_at) values($1,'control',$2,now()+interval '1 day')",[tokenHash(token),id]);controls[role]={...headers,cookie:'pulse_control='+token};}
 const visitors=[];for(let i=0;i<3;i++){const session=(await app.inject({method:'POST',url:'/api/v1/auth/session',headers,payload:{}})).json();const user=(await db.query('insert into app_users(telegram_user_id) values($1) returning id',[1000+i])).rows[0].id;if(i<2)await db.query('update sessions set user_id=$2 where id=$1',[session.sessionId,user]);visitors.push({...headers,authorization:'Bearer '+session.accessToken});}
 const call=(method:any,url:string,payload?:any,h=controls.owner)=>app.inject({method,url:'/api/v1'+url,headers:h,...(payload===undefined?{}:{payload})});
 const save=(id=randomUUID(),version=0,c=content)=>call('PUT','/control/broadcasts/'+id,{version,content:c});
 return {db,app,config,controls,visitors,call,save};
}
test('Broadcasts: opt-in audience, role boundaries, immutable snapshot, duplicate send and persistent delivery totals',async t=>{
 const {db,call,save,controls,visitors}=await fixture(t);
 assert.equal((await call('GET','/control/broadcasts',undefined,controls.manager)).statusCode,403);
 assert.equal((await call('PUT','/me/announcements',{enabled:true},visitors[2])).statusCode,400);
 assert.equal((await call('GET','/me/announcements',undefined,visitors[0])).json().enabled,false);
 await call('PUT','/me/announcements',{enabled:true},visitors[0]);
 const saved=(await save()).json().item;assert.ok(saved.id);assert.equal(saved.status,'draft');
 assert.equal((await call('POST','/control/broadcasts/'+saved.id+'/send',{version:99})).statusCode,409);
 const first=await call('POST','/control/broadcasts/'+saved.id+'/send',{version:saved.version});assert.equal(first.statusCode,200,first.body);assert.equal(first.json().item.total,1);
 assert.equal((await call('POST','/control/broadcasts/'+saved.id+'/send',{version:saved.version})).json().item.total,1);
 assert.equal((await save(saved.id,saved.version,{...content,body:'Changed'})).statusCode,409);
 const deliveries:any[]=[];await processNotificationOutbox(outboxRepository(db),{async sendMessage(v){deliveries.push(v)}},10);
 assert.equal(deliveries.length,1);assert.equal(deliveries[0].chatId,'1000');assert.equal(deliveries[0].text,broadcastText(content as any));assert.match(deliveries[0].deepLink,/#\/property\/primorskiy$/);assert.match(deliveries[0].preferencesLink,/#\/profile$/);
 await db.query("delete from outbox_events where topic='user.broadcast' and processed_at is not null");
 const listed=(await call('GET','/control/broadcasts')).json().items[0];assert.equal(listed.sent,1);assert.equal(listed.pending,0);assert.equal(listed.status,'completed');
});
test('Broadcasts: unsubscribe/re-subscribe and cancellation invalidate already claimed deliveries; retries and blocked chats settle once',async t=>{
 const {db,call,save,visitors}=await fixture(t);for(const h of visitors.slice(0,2))await call('PUT','/me/announcements',{enabled:true},h);
 let item=(await save()).json().item;item=(await call('POST','/control/broadcasts/'+item.id+'/send',{version:item.version})).json().item;
 const repo=outboxRepository(db),claimed=await repo.claimBatch(10);assert.equal(claimed.length,2);
 await call('PUT','/me/announcements',{enabled:false},visitors[0]);await call('PUT','/me/announcements',{enabled:true},visitors[0]);
 const forFirst=claimed.find(e=>e.payload.userId===claimed[0].payload.userId)!;
 const rows=(await db.query("select payload->>'userId' id from outbox_events where last_error='Announcement subscription changed'")).rows;assert.equal(rows.length,1);assert.equal(await repo.canDeliver(claimed.find(e=>e.payload.userId===rows[0].id)!),false);
 const cancelled=await call('POST','/control/broadcasts/'+item.id+'/cancel',{version:item.version});assert.equal(cancelled.json().item.skipped,2);for(const e of claimed)assert.equal(await repo.canDeliver(e),false);
 await repo.markProcessed(forFirst.id);assert.equal((await call('GET','/control/broadcasts')).json().items[0].sent,0,'revoked lease cannot increment totals');
 item=(await save()).json().item;await call('POST','/control/broadcasts/'+item.id+'/send',{version:item.version});
 const result=await processNotificationOutbox(outboxRepository(db),{async sendMessage(){throw new TelegramDeliveryError('Flood',30)}},1);assert.equal(result.retryAfterSeconds,30);
 assert.ok(new Date((await db.query("select available_at from outbox_events where last_error='Flood'")).rows[0].available_at).getTime()>Date.now()+29000);
 await db.query("update outbox_events set available_at=now(),locked_until=null where processed_at is null");
 await processNotificationOutbox(outboxRepository(db),{async sendMessage(){throw new TelegramDeliveryError('Blocked',0,true)}},10);
 const complete=(await call('GET','/control/broadcasts')).json().items.find((i:any)=>i.id===item.id);assert.equal(complete.failed,2);assert.equal(complete.pending,0);assert.equal(complete.status,'completed');
});
test('Broadcasts: upload normalisation, caption and URL validation, private test sends, and server without bot',async t=>{
 const {app,call,save,controls,db}=await fixture(t);
 const image=await sharp({create:{width:20,height:20,channels:3,background:'#f20d1d'}}).png().toBuffer();
 const upload=await app.inject({method:'POST',url:'/api/v1/control/content/broadcast-media',headers:{...controls.owner,'content-type':'image/png'},payload:image});assert.equal(upload.statusCode,200,upload.body);assert.match(upload.json().imageUrl,/\/broadcasts\/.*\.jpg$/);
 assert.equal((await save(randomUUID(),0,{...content,buttonPath:'javascript:alert(1)'})).statusCode,400);
 assert.equal((await save(randomUUID(),0,{...content,imageUrl:upload.json().imageUrl,body:'a'.repeat(1024)})).statusCode,400);
 const item=(await save(randomUUID(),0,{...content,imageUrl:upload.json().imageUrl})).json().item;
 const requestId=randomUUID();for(let i=0;i<2;i++)assert.equal((await call('POST','/control/broadcasts/'+item.id+'/test',{version:item.version,requestId})).statusCode,200);
 const sent:any[]=[];await processNotificationOutbox(outboxRepository(db),{async sendMessage(v){sent.push(v)}},10);assert.equal(sent.length,1);assert.equal(sent[0].chatId,'9000');assert.equal(sent[0].imageUrl,upload.json().imageUrl);
 const requests:any[]=[];const sender=telegramSender({PUBLIC_ORIGIN:'https://pulsedv.ru',BOT_TOKEN:'test'},async(url,options)=>{requests.push({url,body:JSON.parse(String(options?.body))});return new Response(JSON.stringify({ok:true}))});await sender.sendMessage(sent[0]);assert.match(requests[0].url,/sendPhoto$/);assert.equal(requests[0].body.photo,'https://pulsedv.ru'+upload.json().imageUrl);assert.equal(requests[0].body.caption,'<b>'+content.title+'</b>\n\n'+content.body);assert.equal(requests[0].body.parse_mode,'HTML');
 await sender.sendMessage({chatId:'9000',text:'<unsafe>\n\nA & B',richTitle:true});assert.equal(requests[1].body.text,'<b>&lt;unsafe&gt;</b>\n\nA &amp; B');
 assert.equal((await db.query("select count(*)::int n from outbox_events where topic='user.broadcast'")).rows[0].n,0);
 const noBot=await fixture(t,false),draft=(await noBot.save()).json().item;assert.equal((await noBot.call('POST','/control/broadcasts/'+draft.id+'/send',{version:draft.version})).statusCode,409);
});
