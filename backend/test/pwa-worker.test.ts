import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
function worker(scope='/app/',tabs:unknown[]=[]){
 const handlers:Record<string,(e:any)=>void>={};const fetches:string[]=[],cached:string[]=[];const notifications:any[]=[],opened:string[]=[];let offline=false;
 const build='1234567890abcdef';
 const stores=new Map<string,Map<string,Response>>();
 const key=(input:string|Request)=>typeof input==='string'?input:input.url;
 const cacheFor=(name:string)=>{
  const entries=stores.get(name)??new Map<string,Response>();
  stores.set(name,entries);
  return {
   addAll:async(requests:Request[])=>{for(const request of requests){cached.push(request.url);entries.set(request.url,new Response('offline asset'))}},
   put:async(input:string|Request,response:Response)=>{cached.push(key(input));entries.set(key(input),response)},
   match:async(input:string|Request)=>entries.get(key(input))?.clone(),
   keys:async()=>[],
   delete:async()=>true,
  };
 };
 const context={URL,Request,Response,self:{location:{href:'https://pulse.test'+scope+'sw.js'},addEventListener:(type:string,fn:any)=>{handlers[type]=fn},registration:{showNotification:async(title:string,options:any)=>notifications.push({title,...options})},clients:{claim:async()=>{},matchAll:async()=>tabs,openWindow:async(url:string)=>opened.push(url)},skipWaiting:async()=>{}},caches:{open:async(name:string)=>cacheFor(name),keys:async()=>[],delete:async()=>true,match:async(input:string|Request)=>{for(const entries of stores.values()){const hit=entries.get(key(input));if(hit)return hit.clone()}}},fetch:async(input:string|Request)=>{fetches.push(key(input));if(offline)throw Error('offline');return new Response('<meta name="pulse-build" content="'+build+'"/>')}};
 const source=readFileSync(new URL('../../apps/mini-app/public/sw.js',import.meta.url),'utf8');
 runInNewContext(source.replace('__BUILD__',build).replace('__SHELL_ASSETS__','[]'),context);
 const request=(path:string,method='GET',mode='cors')=>{let response:Promise<any>|undefined;handlers.fetch({request:{url:new URL(path,'https://pulse.test').href,method,mode},respondWith:(p:Promise<any>)=>{response=p}});return response};
 const event=async(type:string,data:any={})=>{let pending:Promise<any>|undefined;handlers[type]({...data,waitUntil:(p:Promise<any>)=>{pending=p}});await pending};
 return {build,request,event,fetches,cached,notifications,opened,offline:()=>{offline=true}};
}
test('PWA worker never intercepts API, media, cross-origin or writes; offline navigation is honest',async()=>{
 const w=worker();await w.event('install');assert.equal(w.cached.length,4);assert.ok(w.cached.some(url=>url.endsWith('index.html')));
 for(const path of ['/api/v1/me/account','/api/v1/public/state','/media/plan.jpg','https://other.test/app/assets/a.js'])assert.equal(w.request(path),undefined);
 assert.equal(w.request('/app/assets/a.js','POST'),undefined);
 w.offline();const page=await w.request('/app/','GET','navigate');assert.equal(await page.text(),'offline asset');
 assert.equal(await (await w.request('/app/offline.js')).text(),'offline asset');
 assert.equal(w.request('/app/private.json'),undefined);
});
test('PWA rejects activation of the wrong build and keeps legacy clients compatible',async()=>{
 const w=worker();
 await w.event('install');
 const replies:unknown[]=[];
 const activate=(build?:string)=>w.event('message',{data:{type:'PULSE_ACTIVATE',build},ports:[{postMessage:(value:unknown)=>replies.push(value)}]});
 await activate('fedcba0987654321');
 w.offline();
 assert.equal(await (await w.request('/app/','GET','navigate')).text(),'offline asset');
 await activate(w.build);
 assert.match(await (await w.request('/app/','GET','navigate')).text(),new RegExp(w.build));
 await activate();
 assert.deepEqual(replies,[false,w.build,true]);
});
test('PWA push click stays in app scope even for an external or malformed destination',async()=>{
 const w=worker();await w.event('push',{data:{json:()=>({title:'Update',url:'https://attacker.test/login'})}});
 assert.equal(w.notifications[0].data.url,'https://pulse.test/app/#/profile');
 await w.event('notificationclick',{notification:{close(){},data:{url:'javascript:alert(1)'}}});
 assert.deepEqual(w.opened,['https://pulse.test/app/?pushRoute=%23%2Fprofile#/profile']);
 await w.event('push',{data:{json:()=>({url:'/app/#/journey?lead=test'})}});
 assert.equal(w.notifications[1].data.url,'https://pulse.test/app/#/journey?lead=test');
});

test('notification opens the preview chat with a launch route that survives a lost hash',async()=>{
 const scope='/landing-cinematic/pwa-preview/';
 const target='https://pulse.test'+scope+'#/journey?lead=test';
 const navigated:string[]=[];
 let focused=false;
 const w=worker(scope,[{url:'https://pulse.test'+scope,navigate:async(url:string)=>{
  navigated.push(url);return {focus:async()=>{focused=true}};
 }}]);
 await w.event('notificationclick',{notification:{close(){},data:{url:target}}});
 assert.equal(w.opened.length,0);
 assert.equal(focused,true);
 assert.equal(new URL(navigated[0]).searchParams.get('pushRoute'),'#/journey?lead=test');
 const cold=worker(scope);
 await cold.event('notificationclick',{notification:{close(){},data:{url:target}}});
 assert.deepEqual(cold.opened,navigated);
});
