import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm,access,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
import {createApp} from '../src/app';
import {readConfig} from '../src/config';
import {hashPassword} from '../src/security';
import {DEFAULT_PROPERTIES} from '../../packages/pulse-data/model';
import {outboxRepository} from '../src/outboxRepository';
import {processNotificationOutbox} from '../src/notificationWorker';
import {safeMetadata,safeLeadContext} from '../src/validation';
import {describeLeadRequestContext} from '../../packages/pulse-data/leadContext';
import {offerText} from '../../packages/partners/offer';
import {offerText as oldOfferText} from '../../packages/partners/offer-v2';

test('CRM calculation context preserves the scenario without putting family/health information into analytics',()=>{
 const input={program:'family',status:'blocked',blockReason:'Сумма кредита выше доступного лимита',price:7543219,down:0,payment:0,childrenCount:2,hasYoungChild:true,disabledChild:true,scenarioVersion:1,projection:{firstMonths:180,futurePayment:98765,phone:'+79990000000'},phone:'+79990000000'};
 const context=safeLeadContext(input),analytics=safeMetadata(input);
 assert.equal(context.childrenCount,2);assert.equal(context.hasYoungChild,true);assert.equal(context.disabledChild,undefined);assert.equal(context.phone,undefined);
 assert.deepEqual(context.projection,{firstMonths:180,futurePayment:98765});assert.equal(analytics.childrenCount,undefined);assert.equal(analytics.hasYoungChild,undefined);
 const summary=describeLeadRequestContext(context,'mortgage');assert.ok(summary.lines.some(x=>x.includes('Расчёт недоступен')));assert.ok(!summary.lines.some(x=>x.includes('Платёж ≈')));
 assert.equal(offerText('partners-v2-2026-10-14'),oldOfferText());assert.match(offerText(),/7 суток/);assert.doesNotMatch(offerText('partners-v2-2026-10-14'),/7 суток/);
});

test('Catalog child IDs are scoped per property; shared cover files survive replacement and have optimized derivatives',async t=>{
 const db=await testDatabase();await migrate(db);const root=await mkdtemp(join(tmpdir(),'pulse-audit-media-'));
 const config=readConfig({NODE_ENV:'test',DATABASE_URL:'unused',PUBLIC_ORIGIN:'http://localhost:8080',MEDIA_ROOT:root});const app=await createApp(db,config);await app.ready();t.after(async()=>{await app.close();await db.close();await rm(root,{recursive:true,force:true})});
 const password='audit-regression-password';await db.query("insert into team_members(name,email,password_hash,role) values('Owner','audit@example.test',$1,'owner')",[await hashPassword(password)]);
 const headers={origin:config.PUBLIC_ORIGIN,'content-type':'application/json'};
 const login=await app.inject({method:'POST',url:'/api/v1/control/login',headers,payload:{email:'audit@example.test',password}});assert.equal(login.statusCode,200,login.body);const cookies={pulse_control:login.cookies.find(c=>c.name==='pulse_control')!.value};
 const ids=[randomUUID(),randomUUID()];
 for(const id of ids){const p=structuredClone(DEFAULT_PROPERTIES[0]);p.id=id;p.images=[{id:'facade',url:'https://example.test/image.jpg',alt:'Фасад',sortOrder:0}];p.floorplans=[{id:'2room-56',roomLabel:'2',areaFrom:56,areaTo:56,priceFrom:7,imageUrl:null,sortOrder:0}];const r=await app.inject({method:'POST',url:'/api/v1/control/catalog',headers,cookies,payload:p});assert.equal(r.statusCode,200,r.body)}
 assert.equal(Number((await db.query("select count(*) as n from catalog_property_floorplans where id='2room-56' and property_id=any($1::text[])",[ids])).rows[0].n),2);
 const png=await sharp({create:{width:3000,height:1000,channels:3,background:'#c9ccd1'}}).png().toBuffer();
 const upload=()=>app.inject({method:'POST',url:'/api/v1/control/catalog/'+ids[0]+'/media?kind=cover&compact=1',headers:{origin:config.PUBLIC_ORIGIN,'content-type':'image/png'},cookies,payload:png});
 const first=await upload();assert.equal(first.statusCode,200,first.body);const old=first.json().url,oldPath=join(root,old.slice('/media/'.length));
 assert.equal((await sharp(await readFile(oldPath)).metadata()).width,2400);assert.equal((await sharp(await readFile(oldPath+'.card.webp')).metadata()).width,800);assert.equal((await sharp(await readFile(oldPath+'.thumb.webp')).metadata()).width,160);
 await db.query("insert into catalog_property_images(id,property_id,url,alt,sort_order) values('shared-cover',$1,$2,'Общее фото',1)",[ids[1],old]);
 assert.equal((await upload()).statusCode,200);await access(oldPath);await access(oldPath+'.card.webp');
 const removed=await app.inject({method:'DELETE',url:'/api/v1/control/catalog/'+ids[1]+'/media/shared-cover?kind=gallery',headers,cookies,payload:{}});assert.equal(removed.statusCode,200,removed.body);
 await assert.rejects(access(oldPath));await assert.rejects(access(oldPath+'.card.webp'));await assert.rejects(access(oldPath+'.thumb.webp'));
});

test('Expired, consumed and legacy MFA codes are skipped; active codes take priority over ordinary work alerts',async t=>{
 const db=await testDatabase();await migrate(db);t.after(()=>db.close());
 const member=(await db.query("insert into team_members(name,email,password_hash,role,telegram_user_id) values('Owner','code@example.test','hash','owner',9000) returning id")).rows[0].id;
 const active=randomUUID(),expired=randomUUID(),consumed=randomUUID();
 for(const [id,expires,used] of [[active,"now()+interval '5 minutes'",'null'],[expired,"now()-interval '1 minute'",'null'],[consumed,"now()+interval '5 minutes'",'now()']])await db.query(`insert into control_login_challenges(id,member_id,code_hash,expires_at,consumed_at) values($1,$2,'test',${expires},${used})`,[id,member]);
 await db.query("insert into outbox_events(topic,aggregate_type,created_at,payload) values('manager.journey','lead',now()-interval '1 day',$1::jsonb)",[JSON.stringify({title:'Обычное сообщение'})]);
 const enqueue=async(challengeId:string|undefined,code:string,expiresAt=new Date(Date.now()+300000).toISOString())=>db.query("insert into outbox_events(topic,aggregate_type,aggregate_id,payload) values('manager.security_code','member',$1,$2::jsonb)",[member,JSON.stringify({managerId:member,challengeId,code,expiresAt})]);
 await enqueue(active,'111111');const repo=outboxRepository(db),sent:any[]=[];await processNotificationOutbox(repo,{async sendMessage(v){sent.push(v)}},1);assert.equal(sent.length,1);assert.match(sent[0].text,/111111/);
 await enqueue(expired,'222222',new Date(Date.now()-60000).toISOString());await enqueue(consumed,'333333');await enqueue(undefined,'444444');
 await processNotificationOutbox(repo,{async sendMessage(v){sent.push(v)}},10);assert.equal(sent.length,2);assert.match(sent[1].text,/Обычное сообщение/);assert.ok(sent.every(x=>!/[234]{6}/.test(x.text)));
 const pending=(await db.query("select id from outbox_events where topic='manager.security_code' and processed_at is null")).rows;assert.equal(pending.length,0);
});
