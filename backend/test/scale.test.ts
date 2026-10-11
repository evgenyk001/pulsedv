import {test} from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
import {createApp} from '../src/app';
import {readConfig} from '../src/config';
import {hashPassword} from '../src/security';

test('Scale: 1000 properties, 3000 plans, 5000 images, 2000 leads and 50000 events remain bounded and scoped',async t=>{
 const db=await testDatabase();await migrate(db);
 const config=readConfig({NODE_ENV:'test',DATABASE_URL:'unused',PUBLIC_ORIGIN:'http://localhost:8080'}),app=await createApp(db,config);await app.ready();t.after(async()=>{await app.close();await db.close()});
 const pass=await hashPassword('large-fixture-password');const owner=(await db.query("insert into team_members(name,email,password_hash,role) values('Owner','scale-owner@test.local',$1,'owner') returning id",[pass])).rows[0].id;
 const manager=(await db.query("insert into team_members(name,email,password_hash,role) values('Manager','scale-manager@test.local',$1,'manager') returning id",[pass])).rows[0].id;
 await db.query(`insert into catalog_properties(id,name,city,district,price_from,delivery,developer_name,status,sort_order,cover_image_url,latitude,longitude,description)
 select 'scale-'||lpad(n::text,4,'0'),'ЖК Тест '||n,case when n%2=0 then 'Владивосток' else 'Артём' end,'Тестовый район',5+n/100.0,'2027','Тестовый застройщик','published',n,'https://example.com/cover.webp',43.1+n/100000.0,131.9+n/100000.0,repeat('Описание ',50) from generate_series(1,1000) n`);
 await db.query(`insert into catalog_property_floorplans(id,property_id,room_label,area_from,area_to,price_from,image_url)
 select p.id||'-plan-'||n,p.id,n::text,30*n,35*n,p.price_from+n/10.0,'https://example.com/plan.webp' from catalog_properties p cross join generate_series(1,3) n`);
 await db.query(`insert into catalog_property_images(id,property_id,url,alt,sort_order) select p.id||'-image-'||n,p.id,'https://example.com/gallery.webp','Изображение',n from catalog_properties p cross join generate_series(1,5) n`);
 await db.query("insert into catalog_properties(id,name,city,status,price_from) values('private-draft','Секретный черновик','Владивосток','draft',1)");
 await db.query(`insert into sessions(id,source) select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'scale' from generate_series(1,2000) n`);
 await db.query(`insert into leads(session_id,source,name,phone,manager_id,status,score,priority,property_id,loss_reason,lost_at)
 select s.id,'scale','Клиент '||s.id,'+79990000000',case when row_number() over(order by s.id)%2=0 then $1::uuid else $2::uuid end,case when row_number() over(order by s.id)%4=0 then 'lost' else 'new' end,50,'warm','scale-0001',case when row_number() over(order by s.id)%4=0 then 'postponed' else null end,case when row_number() over(order by s.id)%4=0 then now() else null end from sessions s`,[manager,owner]);
 await db.query(`insert into user_events(idempotency_key,session_id,event_type,entity_type,entity_id,metadata,occurred_at)
 select s.id||'-'||n,s.id,case when n%2=0 then 'favorite_add' else 'property_view' end,'property','scale-0001','{}',now()-n*interval '1 second' from sessions s cross join generate_series(1,25) n`);
 await db.query('analyze');
 const headers={origin:config.PUBLIC_ORIGIN,'content-type':'application/json'};
 const login=async(email:string)=>({pulse_control:(await app.inject({method:'POST',url:'/api/v1/control/login',headers,payload:{email,password:'large-fixture-password'}})).cookies[0].value});
 const ownerCookies=await login('scale-owner@test.local'),managerCookies=await login('scale-manager@test.local');
 const stats:{name:string;p50Ms:number;p95Ms:number;bytes:number}[]=[];
 const measure=async(name:string,url:string,cookies?:any)=>{
  const times:number[]=[];let result:any;
  for(let i=0;i<7;i++){const start=performance.now();result=await app.inject({url,cookies});times.push(performance.now()-start);assert.equal(result.statusCode,200,result.body)}
  times.sort((a,b)=>a-b);stats.push({name,p50Ms:Math.round(times[3]*100)/100,p95Ms:Math.round(times[6]*100)/100,bytes:Buffer.byteLength(result.body)});return result.json();
 };
 const catalog=await measure('catalog page 20','/api/v1/public/catalog?limit=20');assert.equal(catalog.total,1000);assert.equal(catalog.items.length,20);assert.ok(catalog.hasMore);assert.ok(catalog.items.every((p:any)=>p.images.length===0&&p.floorplans.length===0&&!('freshness' in p)));assert.ok(stats.at(-1)!.bytes<40000);
 const last=(await app.inject('/api/v1/public/catalog?page=50&limit=20')).json();assert.equal(last.items.length,20);assert.equal(last.hasMore,false);assert.equal(last.items.at(-1).id,'scale-1000');
 const filtered=await measure('catalog filters','/api/v1/public/catalog?city=Владивосток&rooms=2&min=7000000&max=9000000&sort=priceAsc');assert.ok(filtered.total>0);assert.ok(filtered.items.every((p:any)=>p.city==='Владивосток'));assert.equal((await app.inject('/api/v1/public/catalog/private-draft')).statusCode,404);
 const match=await measure('selection data 1000','/api/v1/public/catalog?limit=1000&view=match');assert.equal(match.items.length,1000);assert.ok(match.items.every((p:any)=>p.floorplans.length===3&&p.floorplans.every((f:any)=>f.imageUrl===null)&&p.images.length===0));assert.ok(stats.at(-1)!.bytes<2200000);
 const detail=await measure('property detail','/api/v1/public/catalog/scale-1000');assert.equal(detail.property.images.length,5);assert.equal(detail.property.floorplans.length,3);
 const leads=await measure('CRM leads page 50','/api/v1/control/leads?limit=50',managerCookies);assert.equal(leads.total,1000);assert.equal(leads.items.length,50);assert.ok(leads.items.every((l:any)=>l.manager===manager));assert.ok(stats.at(-1)!.bytes<100000);
 const leadSearch=await measure('CRM exact search','/api/v1/control/leads?q=Клиент%2000000000-0000-4000-8000-000000002000',managerCookies);assert.equal(leadSearch.total,1);
 const events=await measure('CRM events page 50','/api/v1/control/events?limit=50',managerCookies);assert.equal(events.total,25000);assert.equal(events.items.length,50);assert.ok(stats.at(-1)!.bytes<40000);
 const summary=await measure('CRM analytics 50k','/api/v1/control/analytics-summary',ownerCookies);assert.equal(summary.sessions,2000);assert.equal(summary.leadsTotal,2000);assert.equal(summary.eventCounts.property_view,26000);assert.equal(summary.eventCounts.favorite_add,24000);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Vladivostok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const loss=await measure('CRM loss summary','/api/v1/control/loss-summary?from='+today+'&to='+today,managerCookies);assert.equal(loss.total,500);
 const bootstrap=await measure('CRM bootstrap 1000','/api/v1/control/bootstrap',ownerCookies);assert.equal(bootstrap.state.properties.length,1001);assert.equal(bootstrap.counts.leadsTotal,2000);assert.ok(!('events' in bootstrap));assert.ok(!('leads' in bootstrap));
 console.log('SCALE_BENCHMARK '+JSON.stringify({engine:process.env.TEST_DATABASE_URL?'PostgreSQL':'PGlite',fixture:{properties:1000,plans:3000,images:5000,leads:2000,events:50000},stats}));
 // Broad smoke budget only: timings are not a promise about production hardware or Internet speed.
 assert.ok(stats.every(s=>s.p95Ms<10000),'API operation exceeded the 10s isolated-fixture smoke budget');
});
