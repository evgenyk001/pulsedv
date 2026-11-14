import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
function worker(scope='/app/',tabs:unknown[]=[]){
 const handlers:Record<string,(e:any)=>void>={};const fetches:string[]=[],cached:string[]=[];const notifications:any[]=[],opened:string[]=[];let offline=false;
 const cache={addAll:async(urls:string[])=>{cached.push(...urls)},put:async(r:any)=>{cached.push(r.url)},keys:async()=>[],delete:async()=>true};
 const context={URL,self:{location:{href:'https://pulse.test'+scope+'sw.js'},addEventListener:(type:string,fn:any)=>{handlers[type]=fn},registration:{showNotification:async(title:string,options:any)=>notifications.push({title,...options})},clients:{claim:async()=>{},matchAll:async()=>tabs,openWindow:async(url:string)=>opened.push(url)},skipWaiting:async()=>{}},caches:{open:async()=>cache,keys:async()=>[],delete:async()=>true,match:async(input:any)=>({offline:typeof input==='string'?input:input.url})},fetch:async(r:any)=>{fetches.push(r.url);if(offline)throw Error('offline');return {ok:true,type:'basic',clone(){return this}}}};
 runInNewContext(readFileSync(new URL('../../apps/mini-app/public/sw.js',import.meta.url),'utf8'),context);
 const request=(path:string,method='GET',mode='cors')=>{let response:Promise<any>|undefined;handlers.fetch({request:{url:new URL(path,'https://pulse.test').href,method,mode},respondWith:(p:Promise<any>)=>{response=p}});return response};
 const event=async(type:string,data:any={})=>{let pending:Promise<any>|undefined;handlers[type]({...data,waitUntil:(p:Promise<any>)=>{pending=p}});await pending};
 return {request,event,fetches,cached,notifications,opened,offline:()=>{offline=true}};
}
test('PWA worker never intercepts API, media, cross-origin or writes; offline navigation is honest',async()=>{
 const w=worker();await w.event('install');assert.equal(w.cached.length,3);assert.ok(!w.cached.some(url=>url.endsWith('index.html')));
 for(const path of ['/api/v1/me/account','/api/v1/public/state','/media/plan.jpg','https://other.test/app/assets/a.js'])assert.equal(w.request(path),undefined);
 assert.equal(w.request('/app/assets/a.js','POST'),undefined);
 w.offline();const page=await w.request('/app/','GET','navigate');assert.equal(page.offline,'https://pulse.test/app/offline.html');
 assert.equal((await w.request('/app/offline.js')).offline,'https://pulse.test/app/offline.js');
 assert.equal(w.request('/app/private.json'),undefined);
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
