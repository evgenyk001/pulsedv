import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
import {createApp} from '../src/app';
import {readConfig} from '../src/config';
import {mergeNotificationReads} from '../src/clientNotificationRoutes';
import {emptyJourney} from '../../packages/journey/model';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';
import {upsertCatalogProperty} from '../src/catalogRepository';

async function fixture(t:any){
 const db=await testDatabase();await migrate(db);
 await db.transaction(sql=>upsertCatalogProperty(sql,DEFAULT_STATE.properties[0]));
 const config=readConfig({NODE_ENV:'test',DATABASE_URL:'unused',PUBLIC_ORIGIN:'http://localhost:8080'});
 const app=await createApp(db,config);await app.ready();t.after(async()=>{await app.close();await db.close()});
 const headers={origin:config.PUBLIC_ORIGIN,'content-type':'application/json'};
 const session=async()=>{const s=(await app.inject({method:'POST',url:'/api/v1/auth/session',headers,payload:{source:'test'}})).json();return {...s,headers:{...headers,authorization:'Bearer '+s.accessToken}}};
 const a=await session(),b=await session();
 const lead=async(sid:string)=>(await db.query("insert into leads(session_id,source,name,phone) values($1,'test','Test','+79990000000') returning id",[sid])).rows[0].id;
 const leadId=await lead(a.sessionId),other=await lead(b.sessionId);
 const message=async(id:string,thread=leadId,read=false,author='manager')=>db.query('insert into journey_messages(id,lead_id,document) values($1,$2,$3::jsonb)',[id,thread,JSON.stringify({id,at:new Date().toISOString(),text:'Ответ '+id,author,...(read?{readAt:new Date().toISOString()}:{})})]);
 const get=(h=a.headers)=>app.inject({url:'/api/v1/me/notifications',headers:h});
 const mark=(payload:unknown,h=a.headers)=>app.inject({method:'POST',url:'/api/v1/me/notifications/read',headers:h,payload});
 return {db,app,a,b,leadId,other,message,get,mark};
}
test('Inbox counts all unread messages beyond list/history limits, scopes owners and persists read receipts',async t=>{
 const {db,a,b,leadId,other,message,get,mark}=await fixture(t);
 const ids=Array.from({length:105},()=>randomUUID());
 for(let n=0;n<ids.length;n++)await message(ids[n],leadId,n===0);
 await message(randomUUID(),leadId,false,'client');const privateId=randomUUID();await message(privateId,other);
 const j=emptyJourney(leadId);j.collections=[{id:randomUUID(),title:'Под вас',published:true,createdAt:new Date().toISOString(),items:[]},{id:randomUUID(),title:'Черновик',published:false,createdAt:new Date().toISOString(),items:[]}];
 j.showings=[{id:randomUUID(),propertyId:'primorskiy',at:new Date().toISOString(),status:'confirmed',note:'',result:'',updatedAt:new Date().toISOString(),updatedBy:'manager'}];
 await db.query('insert into client_journeys(lead_id,document) values($1,$2::jsonb)',[leadId,JSON.stringify(j)]);
 const searchId=randomUUID();await db.query('insert into search_profiles(owner,feed) values($1,$2::jsonb)',['session:'+a.sessionId,JSON.stringify([{id:searchId,propertyId:'primorskiy',name:'ЖК Приморский',title:'Изменилась цена',kind:'price',at:new Date().toISOString()},{id:randomUUID(),propertyId:'missing',title:'Не опубликовано',at:new Date().toISOString()}])]);
 const first=await get();assert.equal(first.statusCode,200,first.body);assert.equal(first.json().unreadCount,107);assert.equal(first.json().items.length,80);assert.ok(!first.json().items.some((x:any)=>x.id==='message:'+privateId));
 assert.equal((await get(b.headers)).json().unreadCount,1);
 assert.equal((await mark({ids:['message:'+privateId]})).json().unreadCount,107);assert.equal((await get(b.headers)).json().unreadCount,1);
 assert.equal((await mark({ids:['message:'+ids[1]]})).json().unreadCount,106);
 assert.equal((await mark({ids:['message:'+ids[1]]})).json().unreadCount,106);
 const all=await mark({all:true});assert.equal(all.statusCode,200,all.body);assert.equal(all.json().unreadCount,0);assert.equal((await get()).json().unreadCount,0);
 await message(randomUUID());assert.equal((await get()).json().unreadCount,1);
 await db.query("update journey_messages set document=jsonb_set(document,'{readAt}',to_jsonb(now()::text)) where lead_id=$1",[leadId]);assert.equal((await get()).json().unreadCount,0);
 assert.equal((await mark({all:true,owner:'user:other'})).statusCode,400);
 assert.equal((await mark({ids:[]})).statusCode,400);
 assert.equal((await get({} as any)).statusCode,401);
});
test('Inbox read receipts merge on Telegram binding without leaking to other visitors',async t=>{
 const {db,a,b,leadId,message,get,mark}=await fixture(t);
 await message(randomUUID());await mark({all:true});
 const user=(await db.query('insert into app_users(telegram_user_id) values(345678) returning id')).rows[0].id;
 await db.transaction(async sql=>{await mergeNotificationReads(sql,a.sessionId,user);await sql.query('update sessions set user_id=$2 where id=$1',[a.sessionId,user]);await sql.query('update leads set user_id=$2 where id=$1',[leadId,user]);});
 assert.equal((await get()).json().unreadCount,0);
 await db.query('update sessions set user_id=$2 where id=$1',[b.sessionId,user]);assert.equal((await get(b.headers)).json().unreadCount,0);
 await message(randomUUID());assert.equal((await get(b.headers)).json().unreadCount,1);
 assert.equal((await db.query('select * from client_notification_reads where owner=$1',['session:'+a.sessionId])).rows.length,0);
});

test('Dismissal removes only owned notices, fixes unread counts, survives sign-in and keeps future replies',async t=>{
 const {db,app,a,b,leadId,other,message,get}=await fixture(t);
 const own=randomUUID(),foreign=randomUUID();await message(own);await message(foreign,other);
 const dismiss=(ids:string[],headers=a.headers)=>app.inject({method:'POST',url:'/api/v1/me/notifications/dismiss',headers,payload:{ids}});
 assert.equal((await dismiss(['message:'+foreign])).json().unreadCount,1);assert.equal((await get(b.headers)).json().items.length,1);
 const hidden=await dismiss(['message:'+own]);assert.equal(hidden.statusCode,200,hidden.body);assert.equal(hidden.json().items.length,0);assert.equal(hidden.json().unreadCount,0);
 assert.equal((await dismiss(['message:'+own])).json().items.length,0);assert.equal((await db.query('select id from journey_messages where id=$1',[own])).rows.length,1);
 const user=(await db.query('insert into app_users(telegram_user_id) values(987654) returning id')).rows[0].id;
 await db.transaction(async sql=>{await mergeNotificationReads(sql,a.sessionId,user);await sql.query('update sessions set user_id=$2 where id=$1',[a.sessionId,user]);await sql.query('update leads set user_id=$2 where id=$1',[leadId,user])});
 assert.equal((await get()).json().items.length,0);
 await message(randomUUID());assert.equal((await get()).json().unreadCount,1);assert.equal((await get()).json().items.length,1);
 assert.equal((await dismiss([])).statusCode,400);
});

test('Journey pin/hide preferences are private, merge at sign-in, sync across sessions and reveal a new manager reply without changing CRM',async t=>{
 const {db,app,a,b,leadId,other,message}=await fixture(t);
 const patch=(id:string,payload:unknown,headers=a.headers)=>app.inject({method:'PATCH',url:'/api/v1/me/journeys/'+id+'/preferences',headers,payload});
 const list=async(headers=a.headers)=>(await app.inject({url:'/api/v1/me/journeys',headers})).json().items;
 assert.equal((await patch(other,{hidden:true})).statusCode,404);
 assert.equal((await patch(leadId,{pinned:true})).statusCode,200);assert.ok((await list())[0].pinnedAt);
 assert.equal((await patch(leadId,{hidden:true})).statusCode,200);assert.ok((await list())[0].hiddenAt);
 assert.equal((await list(b.headers))[0].hiddenAt,null);
 assert.equal((await db.query('select status from leads where id=$1',[leadId])).rows[0].status,'new');
 const user=(await db.query('insert into app_users(telegram_user_id) values(987655) returning id')).rows[0].id;
 await db.transaction(async sql=>{await mergeNotificationReads(sql,a.sessionId,user);await sql.query('update sessions set user_id=$2 where id=$1',[a.sessionId,user]);await sql.query('update leads set user_id=$2 where id=$1',[leadId,user])});
 assert.ok((await list())[0].hiddenAt);assert.ok((await list())[0].pinnedAt);
 await db.query('update sessions set user_id=$2 where id=$1',[b.sessionId,user]);
 const same=(await list(b.headers)).find((e:any)=>e.leadId===leadId);assert.ok(same.hiddenAt);assert.ok(same.pinnedAt);
 const reply=randomUUID();await message(reply);await db.query("update journey_messages set document=jsonb_set(document,'{at}',to_jsonb((now()+interval '1 second')::text)) where id=$1",[reply]);
 assert.equal((await list()).find((e:any)=>e.leadId===leadId).hiddenAt,null);assert.ok((await list()).find((e:any)=>e.leadId===leadId).pinnedAt);
 await patch(leadId,{hidden:true});await patch(leadId,{hidden:false,pinned:false});assert.equal((await list())[0].pinnedAt,null);assert.equal((await list())[0].hiddenAt,null);
 assert.equal((await patch(leadId,{})).statusCode,400);assert.equal((await patch(leadId,{owner:'another',hidden:true})).statusCode,400);
});
