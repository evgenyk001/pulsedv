/** Isolated QA server. Synthetic records + actual API in an in-memory PGlite DB.
 * Not imported by either app and not included in Docker builds. No live credentials.
 */
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {testDatabase} from '../../../backend/test/database';
import {migrate} from '../../../backend/src/migrate';
import {createApp} from '../../../backend/src/app';
import {readConfig} from '../../../backend/src/config';
import {issueToken} from '../../../backend/src/security';
import {upsertCatalogProperty} from '../../../backend/src/catalogRepository';
import {complexProject} from '../project-buildings';
import {DEFAULT_GIVEAWAY} from '../../../packages/giveaway';
const repo=fileURLToPath(new URL('../../../',import.meta.url)),web=resolve(repo,'dist/control-center');
const port=Number(process.env.PORT)||4173,origin='http://127.0.0.1:'+port,media=await mkdtemp(join(tmpdir(),'pulse-control-workspace-'));
// Always in memory, irrespective of a developer's normal TEST_DATABASE_URL.
const previousTestUrl=process.env.TEST_DATABASE_URL;delete process.env.TEST_DATABASE_URL;
const db=await testDatabase();if(previousTestUrl)process.env.TEST_DATABASE_URL=previousTestUrl;
await migrate(db);
const config=readConfig({NODE_ENV:'test',DATABASE_URL:'unused',PUBLIC_ORIGIN:origin,MEDIA_ROOT:media,BOT_TOKEN:'fixture-not-a-real-bot'});
const app=await createApp(db,config);await app.ready();
const owner=(await db.query("insert into team_members(name,email,role) values('Демо · тестовые данные','owner@fixture.test','owner') returning id")).rows[0].id;
const token=(await issueToken(db,'control',owner)).token;
const cityNames=['Уссурийск','Владивосток','Артём'];
const projects=['Кленовый парк','Пархоменко','Александровские высоты','Междуречье','Новый квартал','Южный берег'];
for(let n=0;n<projects.length;n++){
 const project={...complexProject(),id:'fixture-project-'+n,name:projects[n],city:cityNames[n%3],status:n===5?'draft' as const:'published' as const,coverImageUrl:null,galleryImages:[],description:'Тестовый объект для проверки интерфейса. Не является реальным предложением.',sortOrder:n};
 project.floorplans=Array.from({length:20},(_,i)=>({...project.floorplans[i%4],id:'plan-'+i,sortOrder:i}));
 await upsertCatalogProperty(db,project);
}
const names=['Анна · тестовая запись','Дмитрий · тестовая запись','Мария · тестовая запись','Сергей · тестовая запись','Елена · тестовая запись','Александр · тестовая запись'];
for(let n=0;n<names.length;n++){
 const uid=(await db.query("insert into app_users(telegram_user_id,first_name,phone,telegram_username) values($1,$2,$3,$4) returning id",[900000+n,names[n],'+7999000000'+n,'fixture_'+n])).rows[0].id;
 await db.query('insert into telegram_contact_consent(user_id,consent_version,accepted_at) values($1,$2,now())',[uid,config.CONSENT_VERSION]);
 const session=randomUUID();await db.query("insert into sessions(id,user_id,source) values($1,$2,'fixture')",[session,uid]);
 const priority=n<2?'urgent':n<4?'hot':'warm';
 await db.query("insert into visitor_profiles(session_id,user_id,score,priority,city,next_action,event_count,top_property_id) values($1,$2,$3,$4,$5,$6,12,$7)",[session,uid,90-n*10,priority,cityNames[n%3],'Обсудить покупку и согласовать удобное время показа','fixture-project-'+n]);
 const lead=(await db.query("insert into leads(user_id,session_id,source,name,phone,status,city,score,priority,next_action,property_id,manager_id) values($1,$2,'home',$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id",[uid,session,names[n],'+7999000000'+n,['new','qualified','showing','booking','deal','lost'][n],cityNames[n%3],90-n*10,priority,'Связаться с клиентом и согласовать показ','fixture-project-'+n,n===0?null:owner])).rows[0].id;
 await db.query("insert into crm_tasks(lead_id,session_id,title,reason,priority,status,due_at) values($1,$2,$3,$4,$5,$6,$7)",[lead,session,['Договориться о показе','Подготовить подборку','Уточнить решение клиента','Проверить бронь','Завершить документы','Связаться повторно'][n],'Клиент сравнивает предложения и просит уточнить условия покупки',priority,['today','in_progress','waiting','today','done','waiting'][n],new Date(Date.now()+(n-2)*86400000).toISOString()]);
 for(let day=0;day<7;day++)await db.query("insert into user_events(idempotency_key,session_id,user_id,event_type,entity_type,entity_id,occurred_at) values($1,$2,$3,'property_view','property',$4,$5)",[randomUUID(),session,uid,'fixture-project-'+n,new Date(Date.now()-day*86400000).toISOString()]);
}
await db.query('insert into giveaway_campaign(id,settings) values(true,$1::jsonb)',[JSON.stringify({...DEFAULT_GIVEAWAY,rules:'Тестовые правила для проверки интерфейса. Акция в этой изолированной среде не проводится.'})]);
const server=createServer(async(req,res)=>{
 try{
  if(req.url?.startsWith('/api/v1/')){const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(chunk);const response=await app.inject({method:req.method as any,url:req.url,headers:req.headers as any,...(chunks.length?{payload:Buffer.concat(chunks)}:{})});res.writeHead(response.statusCode,response.headers);res.end(response.rawPayload);return;}
  const url=new URL(req.url||'/',origin);
  if(url.pathname==='/'){
   res.setHeader('set-cookie','pulse_control='+token+'; HttpOnly; SameSite=Strict; Path=/api/v1/control');
   const route=(url.searchParams.get('route')||'').replace(/[^a-z0-9/-]/g,'');
   const width=Number(url.searchParams.get('width'));
   if([320,390,768,1024].includes(width)){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end('<!doctype html><html lang="ru"><head><title>Control · изолированная проверка</title><style>body{margin:0;background:#101318}iframe{display:block;margin:14px auto;border:1px solid #ffffff20;border-radius:16px;width:'+width+'px;height:880px}</style></head><body><iframe title="Control '+width+'px" src="/pulsedv/control-center/#/'+route+'"></iframe></body></html>');return;}
   res.writeHead(302,{location:'/pulsedv/control-center/#/'+route});res.end();return;
  }
  let folder=web,path=url.pathname.replace(/^\/pulsedv\/control-center/,'');
  if(url.pathname.startsWith('/pulsedv/mini-app/_cdn/')){folder=resolve(repo,'apps/mini-app/public');path=url.pathname.replace('/pulsedv/mini-app','')}
  const file=resolve(folder,'.'+(path.endsWith('/')?path+'index.html':path));
  if(!file.startsWith(folder+sep)){res.writeHead(403);res.end();return;}
  const bytes=await readFile(file);res.writeHead(200,{'content-type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.webp':'image/webp'} as Record<string,string>)[extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(bytes);
 }catch(error){if(!res.headersSent)res.writeHead(404);res.end('Fixture resource unavailable');console.error(error instanceof Error?error.message:String(error))}
});
server.listen(port,'0.0.0.0',()=>console.log('PULSE Control QA ready on '+origin));
const stop=async()=>{server.closeAllConnections();server.close();await app.close();await db.close();await rm(media,{recursive:true,force:true});process.exit(0)};
process.on('SIGTERM',()=>void stop());process.on('SIGINT',()=>void stop());
