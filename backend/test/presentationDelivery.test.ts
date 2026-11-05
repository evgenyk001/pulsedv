import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {PDFDocument} from 'pdf-lib';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
import {readConfig} from '../src/config';
import {createApp} from '../src/app';
import {issueToken} from '../src/security';
import {upsertCatalogProperty} from '../src/catalogRepository';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';
import {outboxRepository} from '../src/outboxRepository';
import {processNotificationOutbox} from '../src/notificationWorker';
import {telegramSender} from '../src/telegramSender';
import {readPresentation} from '../src/presentationFiles';
test('Presentation delivery queues only owned requests for published PDFs, deduplicates clicks and marks sent only after Telegram succeeds',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pulse-pdf-')),db=await testDatabase();await migrate(db);
 const config=readConfig({NODE_ENV:'test',DATABASE_URL:'unused',PUBLIC_ORIGIN:'https://pulsedv.ru',BOT_TOKEN:'test',MEDIA_ROOT:root,REQUIRE_TELEGRAM_PHONE:'true'}),app=await createApp(db,config);
 try{
  await mkdir(join(root,'documents'));const file=randomUUID(),doc=randomUUID(),url='/media/documents/'+file+'.pdf';const pdf=await PDFDocument.create();pdf.addPage();await writeFile(join(root,'documents',file+'.pdf'),await pdf.save());
  const p={...structuredClone(DEFAULT_STATE.properties[0]),id:'presentation-project',status:'published' as const,documents:[{id:doc,kind:'presentation' as const,name:'Презентация',url,mimeType:'application/pdf',sizeBytes:1000,sortOrder:0}]};await upsertCatalogProperty(db,p);
  const origin={origin:config.PUBLIC_ORIGIN};
  async function account(id:number){const u=(await db.query("insert into app_users(telegram_user_id,first_name,phone) values($1,'Клиент',$2) returning id",[id,'+7999000'+id])).rows[0].id;const session=randomUUID();await db.query('insert into sessions(id,user_id) values($1,$2)',[session,u]);return {id:u,headers:{...origin,authorization:'Bearer '+(await issueToken(db,'visitor',session)).token}};}
  const user=await account(1234),other=await account(5678);
  const post=(payload:any={propertyId:p.id,documentId:doc})=>app.inject({url:'/api/v1/me/presentations',method:'POST',headers:user.headers,payload});
  assert.equal((await app.inject({url:'/api/v1/me/presentations',method:'POST',payload:{propertyId:p.id,documentId:doc}})).statusCode,401);
  assert.equal((await post()).statusCode,403);
  await db.query('insert into telegram_contact_consent(user_id,consent_version,accepted_at) values($1,$2,now()),($3,$2,now())',[user.id,config.CONSENT_VERSION,other.id]);
  assert.equal((await post({propertyId:p.id,documentId:doc,userId:other.id})).statusCode,400);
  assert.equal((await post({propertyId:p.id,documentId:randomUUID()})).statusCode,404);assert.equal((await post({propertyId:'another-project',documentId:doc})).statusCode,404);
  const first=await post();assert.equal(first.statusCode,200,first.body);const delivery=first.json();assert.equal(delivery.status,'queued');assert.equal((await post()).json().id,delivery.id);
  const status=()=>app.inject({url:'/api/v1/me/presentations/'+delivery.id,headers:user.headers});
  assert.equal((await status()).json().status,'queued');assert.equal((await app.inject({url:'/api/v1/me/presentations/'+delivery.id,headers:other.headers})).statusCode,404);
  let calls=0;
  const sender=telegramSender(config,async(endpoint,options)=>{calls++;assert.ok(String(endpoint).endsWith('/sendDocument'));const form=options?.body as FormData;assert.equal(form.get('chat_id'),'1234');assert.equal(form.get('protect_content'),null);const blob=form.get('document') as File;assert.equal(blob.type,'application/pdf');assert.ok(blob.name.endsWith('.pdf'));assert.ok((await blob.text()).startsWith('%PDF-'));assert.ok(String(form.get('caption')).includes(p.name));const markup=JSON.parse(String(form.get('reply_markup')));assert.equal(markup.inline_keyboard[0][0].web_app.url,'https://pulsedv.ru/pulsedv/mini-app/#/property/'+p.id);return new Response(JSON.stringify({ok:true,result:{message_id:1}}))});
  const sent=await processNotificationOutbox(outboxRepository(db),sender);assert.equal(sent.processed,1);assert.equal(calls,1);assert.equal((await status()).json().status,'sent');assert.equal((await post()).json().id,delivery.id);
  // New request after the repeat-click window; blocked bot must not become a false success.
  await db.query("update outbox_events set created_at=now()-interval '3 minutes' where id=$1",[delivery.id]);const blocked=await post();const blockedId=blocked.json().id;assert.notEqual(blockedId,delivery.id);
  await processNotificationOutbox(outboxRepository(db),telegramSender(config,async()=>new Response(JSON.stringify({ok:false,error_code:403}),{status:403})));
  assert.equal((await app.inject({url:'/api/v1/me/presentations/'+blockedId,headers:user.headers})).json().status,'failed');
  const revoked=(await post()).json();await upsertCatalogProperty(db,{...p,status:'draft'});await processNotificationOutbox(outboxRepository(db),sender);assert.equal(calls,1);assert.equal((await app.inject({url:'/api/v1/me/presentations/'+revoked.id,headers:user.headers})).json().status,'unavailable');assert.equal((await post()).statusCode,429);assert.equal((await app.inject({url:'/api/v1/me/presentations',method:'POST',remoteAddress:'127.0.0.2',headers:user.headers,payload:{propertyId:p.id,documentId:doc}})).statusCode,404);
  await assert.rejects(()=>readPresentation(root,'https://evil.test/file.pdf'));await assert.rejects(()=>readPresentation(root,'/media/documents/../../etc/passwd'));
  const alias=randomUUID()+'.pdf';await symlink(join(root,'documents',file+'.pdf'),join(root,'documents',alias));await assert.rejects(()=>readPresentation(root,'/media/documents/'+alias));
 }finally{await app.close();await db.close();await rm(root,{recursive:true,force:true})}
});
