import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
import {createApp} from '../src/app';
import {readConfig} from '../src/config';
import {hashPassword} from '../src/security';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';
import {upsertCatalogProperty} from '../src/catalogRepository';
import {emptyJourney} from '../../packages/journey/model';
import {scheduleShowingReminders} from '../src/showingReminders';
import {outboxRepository} from '../src/outboxRepository';
import {processNotificationOutbox} from '../src/notificationWorker';
import {lossSummary} from '../../packages/pulse-data/loss';

async function fixture(t:any){
 const db=await testDatabase();await migrate(db);const config=readConfig({NODE_ENV:'test',DATABASE_URL:'unused',PUBLIC_ORIGIN:'http://localhost:8080'});const app=await createApp(db,config);await app.ready();t.after(async()=>{await app.close();await db.close()});
 const password=await hashPassword('long-test-password');const members=[];
 for(const [i,role] of ['owner','manager','manager'].entries())members.push((await db.query('insert into team_members(name,email,password_hash,role,telegram_user_id) values($1,$2,$3,$4,$5) returning id',['Manager '+i,`member${i}@test.local`,password,role,1000+i])).rows[0].id);
 const headers={origin:config.PUBLIC_ORIGIN,'content-type':'application/json'};
 const cookies=[];for(let i=0;i<3;i++)cookies.push({pulse_control:(await app.inject({method:'POST',url:'/api/v1/control/login',headers,payload:{email:`member${i}@test.local`,password:'long-test-password'}})).cookies[0].value});
 const user=(await db.query('insert into app_users(telegram_user_id) values(2000) returning id')).rows[0].id;
 const lead=(await db.query("insert into leads(source,name,phone,manager_id,user_id) values('property','Test client','+79990000000',$1,$2) returning id",[members[1],user])).rows[0].id;
 for(const p of DEFAULT_STATE.properties.slice(0,1))await db.transaction(sql=>upsertCatalogProperty(sql,p));
 return {db,app,config,members,cookies,headers,user,lead,property:DEFAULT_STATE.properties[0].id};
}

test('Showing reminders: confirmed only, dedup, short notice, reschedule, cancel, recipient change and stale lease',async t=>{
 const {db,app,config,cookies,headers,lead,property,members}=await fixture(t);
 const showing={id:randomUUID(),propertyId:property,at:new Date(Date.now()+48*3600000).toISOString(),status:'requested' as const,note:'',result:'',updatedAt:new Date().toISOString(),updatedBy:'client' as const};
 const journey={...emptyJourney(lead),showings:[showing]};
 await db.query('insert into client_journeys(lead_id,revision,document) values($1,0,$2::jsonb)',[lead,JSON.stringify(journey)]);
 const post=(command:any,revision:number)=>app.inject({method:'POST',url:'/api/v1/control/journeys/'+lead,headers,cookies:cookies[1],payload:{command,revision}});
 const reminders=async()=>(await db.query("select * from outbox_events where topic in ('manager.showing_reminder','user.showing_reminder') order by available_at")).rows;
 const pending=async()=>(await reminders()).filter(r=>!r.processed_at);
 await scheduleShowingReminders(db,config.PUBLIC_ORIGIN);assert.equal((await reminders()).length,0);
 let response=await post({type:'showing_status',id:showing.id,status:'confirmed',result:''},0);assert.equal(response.statusCode,200,response.body);
 assert.equal((await pending()).length,4);
 for(const row of await pending()){assert.equal(new Date(row.available_at).getTime(),Date.parse(showing.at)-row.payload.hours*3600000);assert.match(row.payload.body,/Владивосток/);assert.match(row.payload.deepLink,/journey\?lead=|leads\?lead=/)}
 await scheduleShowingReminders(db,config.PUBLIC_ORIGIN);await scheduleShowingReminders(db,config.PUBLIC_ORIGIN);assert.equal((await reminders()).length,4);
 const proposedAt=new Date(Date.now()+72*3600000).toISOString();
 let doc=(await db.query('select document from client_journeys where lead_id=$1',[lead])).rows[0].document;doc.showings[0].proposedAt=proposedAt;doc.showings[0].changeDecision='pending';
 await db.query('update client_journeys set document=$2::jsonb where lead_id=$1',[lead,JSON.stringify(doc)]);
 response=await post({type:'showing_reschedule',id:showing.id,accept:true},1);assert.equal(response.statusCode,200,response.body);
 assert.equal((await pending()).length,4);assert.ok((await pending()).every(r=>r.payload.at===proposedAt));assert.equal((await reminders()).filter(r=>r.last_error==='Showing reminder superseded').length,4);
 // A claimed reminder must still be refused after cancellation clears its lease.
 await db.query("delete from outbox_events where topic not in ('manager.showing_reminder','user.showing_reminder')");
 await db.query("update outbox_events set available_at=now()-interval '1 second' where processed_at is null");
 const repo=outboxRepository(db),claimed=await repo.claimBatch(10);assert.equal(claimed.length,4);
 response=await post({type:'showing_status',id:showing.id,status:'cancelled',result:''},2);assert.equal(response.statusCode,200,response.body);
 for(const event of claimed)assert.equal(await repo.canDeliver!(event),false);
 await scheduleShowingReminders(db,config.PUBLIC_ORIGIN);assert.equal((await pending()).length,0);
 // New schedule with less than 24h: only the 2h reminder, never a missed 24h burst.
 doc=(await db.query('select document from client_journeys where lead_id=$1',[lead])).rows[0].document;
 const short={...showing,id:randomUUID(),at:new Date(Date.now()+4*3600000).toISOString(),status:'confirmed'};doc.showings.push(short);
 await db.query('update client_journeys set document=$2::jsonb where lead_id=$1',[lead,JSON.stringify(doc)]);
 await scheduleShowingReminders(db,config.PUBLIC_ORIGIN);assert.equal((await pending()).length,2);assert.ok((await pending()).every(r=>r.payload.hours===2));
 await db.query('update leads set manager_id=$2 where id=$1',[lead,members[2]]);await scheduleShowingReminders(db,config.PUBLIC_ORIGIN);
 assert.equal((await pending()).length,2);assert.equal((await pending()).find(r=>r.topic==='manager.showing_reminder').payload.managerId,members[2]);
 await db.query("update outbox_events set available_at=now()-interval '1 second' where processed_at is null");
 await db.query("delete from outbox_events where topic not in ('manager.showing_reminder','user.showing_reminder')");
 const sent:any[]=[];const delivered=await processNotificationOutbox(outboxRepository(db),{async sendMessage(input){sent.push(input)}},10);
 assert.equal(delivered.processed,2);assert.equal(sent.length,2);assert.ok(sent.every(s=>s.text.includes('Показ через 2 часа')));assert.ok(sent.some(s=>s.chatId==='1002'));assert.ok(sent.some(s=>s.chatId==='2000'));
 await scheduleShowingReminders(db,config.PUBLIC_ORIGIN);assert.equal((await pending()).length,0);
 // Retry cannot deliver an expired showing even if the job was left due during downtime.
 doc.showings.push({...short,id:randomUUID(),at:new Date(Date.now()+3*3600000).toISOString()});await db.query('update client_journeys set document=$2::jsonb where lead_id=$1',[lead,JSON.stringify(doc)]);await scheduleShowingReminders(db,config.PUBLIC_ORIGIN);
 const newId=doc.showings.at(-1).id;doc.showings.at(-1).at=new Date(Date.now()-1000).toISOString();await db.query('update client_journeys set document=$2::jsonb where lead_id=$1',[lead,JSON.stringify(doc)]);
 await db.query("update outbox_events set available_at=now()-interval '1 second' where payload->>'showingId'=$1",[newId]);
 await processNotificationOutbox(outboxRepository(db),{async sendMessage(){assert.fail('expired reminder sent')}},10);
});

test('Loss reason API: required, atomic, optimistic, scoped, Vladivostok dates and reopening',async t=>{
 const {db,app,cookies,headers,lead,members}=await fixture(t);
 const get=async()=> (await app.inject({url:'/api/v1/control/leads/'+lead,cookies:cookies[1]})).json().lead;
 const patch=async(payload:any,actor=1)=>app.inject({method:'PATCH',url:'/api/v1/control/leads/'+lead,headers,cookies:cookies[actor],payload:{expectedUpdatedAt:(await get()).updatedAt,...payload}});
 assert.equal((await patch({status:'lost'})).statusCode,400);assert.equal((await get()).status,'new');
 assert.equal((await patch({status:'lost',lossReason:'invented'})).statusCode,400);
 assert.equal((await patch({status:'lost',lossReason:'other',lossNote:'   '})).statusCode,400);
 assert.equal((await patch({status:'lost',lossReason:'down_payment'},2)).statusCode,403);
 let response=await patch({status:'lost',lossReason:'down_payment',lossNote:'  Вернуться через месяц  '});assert.equal(response.statusCode,200,response.body);
 let item=await get();assert.equal(item.lossReason,'down_payment');assert.equal(item.lossNote,'Вернуться через месяц');assert.ok(item.lostAt);
 const at=item.lostAt;assert.equal((await patch({lossReason:'postponed'})).statusCode,200);assert.equal((await get()).lostAt,at);
 const stale=item.updatedAt;assert.equal((await patch({expectedUpdatedAt:stale,lossReason:'no_contact'})).statusCode,409);
 await db.query("update leads set lost_at='2026-10-10T15:00:00Z' where id=$1",[lead]);
 await db.query("insert into leads(source,name,phone,status,manager_id,loss_reason,lost_at) values('property','Other','+79990000001','lost',$1,'mortgage_declined','2026-10-11T00:00:00Z'),('property','Old','+79990000002','lost',$2,null,null)",[members[2],members[1]]);
 const url='/api/v1/control/loss-summary?from=2026-10-11&to=2026-10-11';
 assert.equal((await app.inject(url)).statusCode,401);
 let report=(await app.inject({url,cookies:cookies[1]})).json();assert.equal(report.total,1);assert.equal(report.undated,1);assert.deepEqual(report.items,[{reason:'postponed',count:1,percent:100}]);
 assert.equal((await app.inject({url,cookies:cookies[0]})).json().total,2);assert.equal((await app.inject({url:url+'&manager='+members[2],cookies:cookies[1]})).statusCode,400);
 assert.equal((await app.inject({url:'/api/v1/control/loss-summary?from=2026-10-12&to=2026-10-11',cookies:cookies[0]})).statusCode,400);
 const demo=lossSummary([{status:'lost',lossReason:'postponed',lostAt:'2026-10-10T15:00:00Z'},{status:'lost',lostAt:null}], '2026-10-11','2026-10-11');assert.deepEqual(demo,report);
 assert.equal((await patch({status:'qualified',lossReason:null,lossNote:null})).statusCode,200);item=await get();assert.equal(item.lostAt,null);assert.equal(item.lossReason,null);assert.equal(item.lossNote,null);
 assert.equal((await patch({lossReason:'no_contact'})).statusCode,400);
 assert.equal((await app.inject({url,cookies:cookies[1]})).json().total,0);
});
