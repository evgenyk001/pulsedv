import {test,expect} from '@playwright/test';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {createServer,type Server,type IncomingMessage} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,extname,sep} from 'node:path';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';
let server:Server,origin:string,root:string;
let apiHandler:(request:IncomingMessage,payload:any)=>any=()=>({ok:true});
test.beforeAll(async()=>{
 root=await mkdtemp(join(tmpdir(),'pulse-partner-api-'));
 // Build the real Mini App in API mode, without writing over the shared demo build.
 await build({configFile:false,root:resolve('apps/mini-app'),plugins:[react()],base:'/pulsedv/mini-app/',define:{'import.meta.env.VITE_PULSE_MODE':JSON.stringify('api')},build:{outDir:root,emptyOutDir:true},logLevel:'silent'});
 const types:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpeg':'image/jpeg','.ttf':'font/ttf','.woff2':'font/woff2'};
 server=createServer(async(req,res)=>{try{
  if(req.url?.startsWith('/api/v1/')){let raw='';for await(const chunk of req)raw+=chunk;const data=apiHandler(req,raw?JSON.parse(raw):undefined);res.writeHead(data.__status||200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));return;}
  const path=new URL(req.url!,'http://localhost').pathname.replace(/^\/pulsedv\/mini-app/,'');
  const file=resolve(root,'.'+(path.endsWith('/')?path+'index.html':path));
  if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  const bytes=await readFile(file);res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(bytes);
 }catch{if(!res.headersSent)res.writeHead(404);res.end()}});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('No API-mode test origin');origin='http://127.0.0.1:'+address.port;
});
test.afterAll(async()=>{if(server){server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))}if(root)await rm(root,{recursive:true,force:true})});

function setupApi(){
 let favorites=['primorskiy'];let announcements=true;let failCatalog=false,failActions=false,failBoot=false;let favoriteRequests=0;
 apiHandler=(req,payload)=>{
  const url=new URL(req.url!,origin),path=url.pathname.replace('/api/v1','');
  const failure={__status:503,error:'SQLSTATE connection reset; stack trace internal server detail'};
  if(path==='/public/state')return failBoot?failure:{state:DEFAULT_STATE,version:1,consentVersion:'test',requiresPhone:false};
  if(path==='/auth/session')return {sessionId:'session',accessToken:'token',expiresAt:new Date(Date.now()+86400000).toISOString()};
  if(path==='/me/favorites'){
   favoriteRequests++;if(failActions)return failure;
   if(payload?.changes)for(const c of payload.changes)favorites=c.saved?[...new Set([...favorites,c.id])]:favorites.filter(id=>id!==c.id);
   return {ids:favorites,authenticated:true};
  }
  if(path==='/me/announcements'){if(req.method==='PUT')announcements=payload.enabled;return {enabled:announcements,authenticated:true};}
  if(path==='/me/journeys')return {items:[]};
  if(path==='/public/catalog/meta')return {rooms:['1','2'],deliveries:['2027'],cities:[],minPriceRub:4000000,maxPriceRub:25000000,stepRub:100000,total:DEFAULT_STATE.properties.length};
  if(path==='/public/catalog'){
   if(failCatalog)return failure;
   const ids=url.searchParams.get('ids')?.split(',');const items=DEFAULT_STATE.properties.filter(p=>p.status==='published'&&(!ids||ids.includes(p.id)));
   return {items,page:1,limit:1000,total:items.length,hasMore:false};
  }
  if(path.startsWith('/public/catalog/'))return {property:DEFAULT_STATE.properties.find(p=>p.id===path.split('/').at(-1))};
  if(path==='/leads'&&failActions)return failure;
  return {ok:true,items:[]};
 };
 return {failCatalog:(v:boolean)=>{failCatalog=v},failActions:(v:boolean)=>{failActions=v},failBoot:(v:boolean)=>{failBoot=v},favoriteRequests:()=>favoriteRequests,favorites:()=>favorites};
}
test.beforeEach(async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(version=>{localStorage.setItem('pulse_onboarding_version',version);if(!localStorage.getItem('pulse.dv.favorites.v1'))localStorage.setItem('pulse.dv.favorites.v1','["primorskiy"]')},DEFAULT_STATE.content.onboardingVersion);
 await page.route('https://telegram.org/js/telegram-web-app.js**',r=>r.fulfill({body:''}));
});
test('Favorites stay readable through lost connection, queued changes sync after reconnection without banners',async({page,context})=>{
 const control=setupApi();const issues:string[]=[];page.on('pageerror',e=>issues.push(e.message));
 await page.goto(origin+'/pulsedv/mini-app/#/favorites');
 const name=DEFAULT_STATE.properties.find(p=>p.id==='primorskiy')!.name;
 await expect(page.getByText(name,{exact:true}).first()).toBeVisible();await expect.poll(control.favoriteRequests).toBeGreaterThan(0);await expect.poll(()=>page.evaluate(()=>localStorage.getItem('pulse.favorites-imported.v2'))).toBe('session');
 await context.setOffline(true);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.getByText(name,{exact:true}).first()).toBeVisible();
 await expect(page.getByText(/Нет связи|Повторить синхронизацию|Не удалось загрузить сохранённые|SQLSTATE/)).toHaveCount(0);
 await page.screenshot({path:'test-results/network-favorites-clean.png',fullPage:true});
 await page.getByRole('button',{name:'Убрать из избранного'}).click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('pulse.favorite-changes.v2')||'[]').length)).toBe(1);
 const before=control.favoriteRequests();await context.setOffline(false);await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await expect.poll(control.favoriteRequests).toBeGreaterThan(before);
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('pulse.favorite-changes.v2')||'[]').length)).toBe(0);
 expect(control.favorites()).toEqual([]);expect(issues).toEqual([]);
});
test('Initial catalog failure offers a styled retry without technical details or false empty state',async({page})=>{
 const control=setupApi();control.failCatalog(true);
 await page.goto(origin+'/pulsedv/mini-app/#/catalog');
 const retry=page.getByRole('button',{name:'Обновить каталог'});await expect(retry).toBeVisible();
 await expect(page.getByText(/SQLSTATE|stack trace|Проверьте соединение|Ничего не нашли/)).toHaveCount(0);
 control.failCatalog(false);await retry.click();
 await expect(page.getByText(DEFAULT_STATE.properties[0].name,{exact:true}).first()).toBeVisible();
});
test('Startup recovers after a failed read without exposing server diagnostics',async({page})=>{
 const control=setupApi();control.failBoot(true);await page.goto(origin+'/pulsedv/mini-app/');
 await expect(page.getByRole('button',{name:'Попробовать снова'})).toBeVisible();
 await expect(page.getByText(/SQLSTATE|stack trace|Нет связи/)).toHaveCount(0);
 control.failBoot(false);await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await expect(page.getByRole('button',{name:'Каталог',exact:true})).toBeVisible();
});
test('Failed lead submission keeps the form and never reports success or exposes raw errors',async({page})=>{
 const control=setupApi();control.failActions(true);
 await page.goto(origin+'/pulsedv/mini-app/#/property/primorskiy');
 await page.getByRole('button',{name:'Узнать наличие',exact:true}).click();
 await page.getByRole('textbox',{name:'Как к вам обращаться'}).fill('Анна');
 await page.getByRole('textbox',{name:'Телефон',exact:true}).fill('+79991234567');
 await page.getByRole('checkbox',{name:/Я даю согласие/}).check();await page.getByRole('button',{name:'Отправить заявку',exact:true}).click();
 await expect(page.getByText('Не получилось выполнить действие. Попробуйте ещё раз.',{exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Обращение создано'})).toHaveCount(0);
 await expect(page.getByRole('textbox',{name:'Как к вам обращаться'})).toHaveValue('Анна');
 await expect(page.getByText(/SQLSTATE|stack trace/)).toHaveCount(0);
});
