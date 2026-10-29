import {test} from 'node:test';
import assert from 'node:assert/strict';
import {telegramSender} from '../src/telegramSender';
import {processNotificationOutbox,type NotificationOutboxRepository} from '../src/notificationWorker';

test('Every private client Mini App button uses web_app and preserves the exact destination; Control and external links stay URLs',async()=>{
 const requests:any[]=[];
 const sender=telegramSender({PUBLIC_ORIGIN:'https://pulsedv.ru',BOT_TOKEN:'test'},async(_url,options)=>{requests.push(JSON.parse(String(options?.body)));return new Response(JSON.stringify({ok:true}))});
 const targets=['/journey?lead=550e8400-e29b-41d4-a716-446655440000','/my-search','/partners?referral=abc','/profile','/catalog','/property/atrium','/favorites','/selection','/mortgage','/partner-offer','/'];
 for(const target of targets){const url='https://pulsedv.ru/pulsedv/mini-app/#'+target;await sender.sendMessage({chatId:'123456',text:'Обновление',deepLink:url});assert.deepEqual(requests.at(-1).reply_markup.inline_keyboard[0][0].web_app,{url});assert.equal(requests.at(-1).reply_markup.inline_keyboard[0][0].url,undefined);}
 for(const path of ['/pulsedv/mini-app','/mini-app/','/mini-app']){const url='https://pulsedv.ru'+path+'?source=notification#/favorites';await sender.sendMessage({chatId:'123456',text:'Обновление',deepLink:url});assert.equal(requests.at(-1).reply_markup.inline_keyboard[0][0].web_app.url,url);}
 for(const url of ['https://pulsedv.ru/pulsedv/control-center/#/leads?lead=abc','https://example.com/pulsedv/mini-app/#/catalog','https://pulsedv.ru.evil.test/pulsedv/mini-app/','https://pulsedv.ru/other/#/mini-app/','http://pulsedv.ru/pulsedv/mini-app/']){await sender.sendMessage({chatId:'123456',text:'Update',buttonLabel:'Открыть',deepLink:url});assert.equal(requests.at(-1).reply_markup.inline_keyboard[0][0].url,url);assert.equal(requests.at(-1).reply_markup.inline_keyboard[0][0].web_app,undefined);}
 await sender.sendMessage({chatId:'-100123456',text:'Update',deepLink:'https://pulsedv.ru/pulsedv/mini-app/#/catalog',preferencesLink:'https://pulsedv.ru/pulsedv/mini-app/#/profile'});assert.ok(requests.at(-1).reply_markup.inline_keyboard.every((row:any[])=>row[0].url&&!row[0].web_app));
 await sender.sendMessage({chatId:'123456',text:'Update',deepLink:'https://untrusted.test/path'});assert.equal(requests.at(-1).reply_markup,undefined);
});
test('Previously queued generic journey alerts open the exact conversation without changing other notification routes',async()=>{
 const lead='550e8400-e29b-41d4-a716-446655440000',sent:any[]=[],processed:string[]=[];
 const events=['user.journey','user.journey','user.search_updates','user.showing_reminder','user.broadcast','user.partner_payout'].map((topic,index)=>({id:String(index),topic,aggregateType:'lead',aggregateId:lead,attempts:0,payload:{userId:'user',deepLink:'https://pulsedv.ru/pulsedv/mini-app/#/journey'+(index===1?'?lead=old&tab=collections':'')}}));
 const repo:NotificationOutboxRepository={async claimBatch(){return events},async canDeliver(){return true},async userTelegramUserId(){return '123456'},async managerTelegramUserId(){return null},async ownerTelegramUserId(){return null},async markProcessed(id){processed.push(id)},async markSkipped(){assert.fail('unexpected skip')},async markFailed(_id,error){assert.fail(error)}};
 await processNotificationOutbox(repo,{async sendMessage(input){sent.push(input)}});
 assert.equal(processed.length,6);assert.equal(sent[0].deepLink,'https://pulsedv.ru/pulsedv/mini-app/#/journey?lead='+lead);assert.equal(sent[1].deepLink,'https://pulsedv.ru/pulsedv/mini-app/#/journey?lead='+lead+'&tab=collections');for(const delivery of sent.slice(2))assert.equal(delivery.deepLink,events[0].payload.deepLink);
});
