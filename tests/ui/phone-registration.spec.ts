import {test,expect} from '@playwright/test';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {createServer,type Server,type IncomingMessage} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,extname,sep} from 'node:path';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';
import {OFFER_VERSION} from '../../packages/partners/offer';
let server:Server,origin:string,root:string;
let apiHandler:(request:IncomingMessage,payload:any)=>any=()=>({ok:true});
test.beforeAll(async()=>{
 root=await mkdtemp(join(tmpdir(),'pulse-partner-api-'));
 // Build the real Mini App in API mode, without writing over the shared demo build.
 await build({configFile:false,root:resolve('apps/mini-app'),plugins:[react()],base:'/pulsedv/mini-app/',define:{'import.meta.env.VITE_PULSE_MODE':JSON.stringify('api')},build:{outDir:root,emptyOutDir:true},logLevel:'silent'});
 const types:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpeg':'image/jpeg','.ttf':'font/ttf','.woff2':'font/woff2'};
 server=createServer(async(req,res)=>{try{
  if(req.url?.startsWith('/api/v1/')){let raw='';for await(const chunk of req)raw+=chunk;const data=apiHandler(req,raw?JSON.parse(raw):undefined);res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));return;}
  const path=new URL(req.url!,'http://localhost').pathname.replace(/^\/pulsedv\/mini-app/,'');
  const file=resolve(root,'.'+(path.endsWith('/')?path+'index.html':path));
  if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  const bytes=await readFile(file);res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(bytes);
 }catch{if(!res.headersSent)res.writeHead(404);res.end()}});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('No API-mode test origin');origin='http://127.0.0.1:'+address.port;
});
test.afterAll(async()=>{if(server){server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))}if(root)await rm(root,{recursive:true,force:true})});
test('Mandatory phone blocks direct routes, cancellation and forged client success; consent documents stay accessible',async({page})=>{
 test.setTimeout(60000);await page.addInitScript(version=>localStorage.setItem('pulse_onboarding_version',version),DEFAULT_STATE.content.onboardingVersion);let verified=false,requests=0,privateReads=0;
 await page.route('https://telegram.org/js/telegram-web-app.js**',r=>r.fulfill({contentType:'text/javascript',body:`window.Telegram={WebApp:{initData:'signed-test-data',ready(){},expand(){},requestContact(cb){window.contactCallback=ok=>{delete window.contactCallback;cb(ok)}}}};`}));
 apiHandler=(request,payload)=>{
  const path=new URL(request.url!,origin).pathname.replace('/api/v1','');
  if(path==='/public/state')return {state:DEFAULT_STATE,version:1,requiresPhone:true,consentVersion:'test'};
  if(path==='/auth/session')return {sessionId:'s',accessToken:'token',expiresAt:new Date(Date.now()+86400000).toISOString()};
  if(path==='/me/account')return {registered:verified,authenticated:true,requiresPhone:true};
  if(path==='/me/account/contact-request'){expect(payload).toEqual({consent:true,consentVersion:'test'});requests++;return {ok:true};}
  if(path==='/public/legal')return {name:'Operator',email:'mail@test.ru',inn:'123456789012',address:'Address'};
  if(path==='/me/favorites'){privateReads++;return {ids:[],authenticated:true};}
  if(path==='/me/journeys')return {items:[]};
  if(path==='/public/catalog/meta')return {rooms:[],deliveries:[],cities:[],minPriceRub:0,maxPriceRub:25000000,stepRub:100000,total:0};
  if(path==='/public/catalog')return {items:[],page:1,limit:20,total:0,hasMore:false};
  return {ok:true};
 };
 await page.goto(origin+'/pulsedv/mini-app/#/favorites');
 const button=page.getByRole('button',{name:'Поделиться номером и войти'});
 await expect(button).toBeDisabled();await expect(page.getByRole('heading',{name:'Избранное',exact:true})).toHaveCount(0);expect(privateReads).toBe(0);
 await page.getByRole('link',{name:'Политика конфиденциальности'}).click();await expect(page.getByRole('heading',{name:'Политика обработки персональных данных',exact:true})).toBeVisible();
 await page.evaluate(()=>location.hash='/catalog');await expect(button).toBeVisible();
 await page.getByRole('checkbox').check();await button.click();await expect.poll(()=>requests).toBe(1);await expect.poll(()=>page.evaluate(()=>typeof (window as any).contactCallback)).toBe('function');
 await page.evaluate(()=>(window as any).contactCallback(false));await expect(page.getByRole('alert')).toContainText('Без передачи');
 await expect(page.getByRole('heading',{name:'Каталог',exact:true})).toHaveCount(0);
 await button.click();await expect.poll(()=>requests).toBe(2);await expect.poll(()=>page.evaluate(()=>typeof (window as any).contactCallback)).toBe('function');
 verified=true;await page.evaluate(()=>(window as any).contactCallback(true));
 await expect(button).toHaveCount(0);await expect(page.getByRole('heading',{name:'Новостройки',exact:true})).toBeVisible();
});
test('Favorites has no stray zero when synchronization queue is empty',async({page})=>{
 // This isolated API-mode server omits the flag to exercise existing non-gated installations.
 apiHandler=request=>{const path=new URL(request.url!,origin).pathname.replace('/api/v1','');if(path==='/public/state')return {state:DEFAULT_STATE,version:1};if(path==='/auth/session')return {sessionId:'s',accessToken:'t',expiresAt:new Date(Date.now()+86400000).toISOString()};if(path==='/me/favorites')return {ids:[],authenticated:true};if(path.includes('catalog'))return {items:[],total:0};return {items:[]}};
 await page.route('https://telegram.org/js/telegram-web-app.js**',r=>r.fulfill({body:''}));
 await page.goto(origin+'/pulsedv/mini-app/#/favorites');await expect(page.getByRole('heading',{name:'Избранное',exact:true})).toBeVisible();await expect(page.getByText('0',{exact:true})).toHaveCount(0);
});
