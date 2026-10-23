import {test,expect} from '@playwright/test';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {createServer,type Server} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,extname,sep} from 'node:path';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';
import {OFFER_VERSION} from '../../packages/partners/offer';
let server:Server,origin:string,root:string;
test.beforeAll(async()=>{
 root=await mkdtemp(join(tmpdir(),'pulse-partner-api-'));
 // Build the real Mini App in API mode, without writing over the shared demo build.
 await build({configFile:false,root:resolve('apps/mini-app'),plugins:[react()],base:'/pulsedv/mini-app/',define:{'import.meta.env.VITE_PULSE_MODE':JSON.stringify('api')},build:{outDir:root,emptyOutDir:true},logLevel:'silent'});
 const types:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpeg':'image/jpeg','.ttf':'font/ttf','.woff2':'font/woff2'};
 server=createServer(async(req,res)=>{try{
  const path=new URL(req.url!,'http://localhost').pathname.replace(/^\/pulsedv\/mini-app/,'');
  const file=resolve(root,'.'+(path.endsWith('/')?path+'index.html':path));
  if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  const bytes=await readFile(file);res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(bytes);
 }catch{if(!res.headersSent)res.writeHead(404);res.end()}});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('No API-mode test origin');origin='http://127.0.0.1:'+address.port;
});
test.afterAll(async()=>{if(server){server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))}if(root)await rm(root,{recursive:true,force:true})});
for(const width of [320,390])test(`Partner security ${width}px: native cancellation, unlock, background relock and recovery`,async({page,browserName})=>{
 test.setTimeout(60000);await page.setViewportSize({width,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(version=>{localStorage.setItem('pulse_onboarding_version',version);localStorage.setItem('pulse.partner.guide.v1','seen')},DEFAULT_STATE.content.onboardingVersion);
 await page.route('https://telegram.org/js/telegram-web-app.js**',route=>route.fulfill({contentType:'text/javascript',body:`window.testBioAllow=false;window.testBioToken='device-secret';window.Telegram={WebApp:{initData:'signed-test-data',initDataUnsafe:{user:{allows_write_to_pm:true}},isVersionAtLeast:()=>true,ready(){},expand(){},onEvent(){},offEvent(){},BiometricManager:{isInited:true,isBiometricAvailable:true,isAccessGranted:true,isBiometricTokenSaved:true,deviceId:'phone-one',authenticate(p,cb){if(window.testBioHold){window.testBioCallback=cb;return}cb(window.testBioAllow,window.testBioAllow?window.testBioToken:undefined)},updateBiometricToken(t,cb){window.testBioToken=t;cb(true)}}}};`}));
 let enabled=true,unlocked=false,reads=0,checks=0,recovered=false;
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname.replace('/api/v1','');let data:any={ok:true};
  if(path==='/public/state')data={state:DEFAULT_STATE,version:1,consentVersion:'2026-09-25'};
  if(path==='/auth/session')data={sessionId:'test-session',accessToken:'test-token',expiresAt:new Date(Date.now()+86400000).toISOString()};
  if(path==='/me/journeys')data={items:[]};
  if(path==='/me/announcements')data={enabled:false,authenticated:true};
  if(path==='/me/partner-security')data={enabled,authenticated:true};
  if(path==='/me/partner-security/prepare')data={token:'device-secret'};
  if(path==='/me/partner-security/activate'){enabled=true;unlocked=true;data={grant:'verified-grant'};}
  if(path==='/me/partner-security/disable'){enabled=false;unlocked=false;}
  if(path==='/me/partner-security/unlock'){checks++;expect(route.request().postDataJSON()).toEqual({deviceId:'phone-one',token:'device-secret'});unlocked=true;data={grant:'verified-grant'};}
  if(path==='/me/partner-security/lock')unlocked=false;
  if(path==='/me/partner-security/recover'){expect(route.request().postDataJSON()).toEqual({code:'123456'});enabled=false;recovered=true;}
  if(path==='/public/partner-program')data={botUsername:'pulsedvbot',offerPublished:true};
  if(path==='/me/partner'){reads++;expect(!enabled||unlocked).toBe(true);if(enabled)expect(route.request().headers()['x-partner-unlock']).toBe('verified-grant');data={authenticated:true,partner:{id:'partner-1',userId:'user-1',name:'Анна',phone:'+79995550101',code:'p01234567890123456789',status:'active',termsVersion:OFFER_VERSION,createdAt:new Date().toISOString()},referrals:[],invitations:[],reservations:[],summary:{accruedMinor:0,paidMinor:0,pendingCount:0,acceptedCount:0},total:0,page:1,hasMore:false};}
  await route.fulfill({json:data});
 });
 await page.goto(origin+'/pulsedv/mini-app/#/partners');const gate=page.getByRole('region',{name:'Защита партнёрского кабинета'});
 await expect(gate).toBeVisible();expect(reads).toBe(0);
 await gate.getByRole('button',{name:'Войти по Face ID или отпечатку'}).click();await expect(gate.getByRole('alert')).toContainText('Проверка не завершена');expect(reads).toBe(0);expect(checks).toBe(0);
 await page.evaluate(()=>{(window as any).testBioAllow=true;(window as any).testBioHold=true});await gate.getByRole('button',{name:'Войти по Face ID или отпечатку'}).click();
 await expect.poll(()=>page.evaluate(()=>typeof (window as any).testBioCallback)).toBe('function');
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));(window as any).testBioCallback(true,'device-secret');Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));(window as any).testBioHold=false});await expect(gate.getByRole('alert')).toContainText('Вход отменён');expect(checks).toBe(0);
 await gate.getByRole('button',{name:'Войти по Face ID или отпечатку'}).click();await expect(page.getByRole('button',{name:'Добавить клиента',exact:true})).toBeVisible();expect(checks).toBe(1);
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'))});await expect(gate).toBeVisible();await expect(page.getByRole('button',{name:'Добавить клиента',exact:true})).toHaveCount(0);
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'))});await gate.getByRole('button',{name:'Войти по Face ID или отпечатку'}).click();await expect(page.getByRole('button',{name:'Добавить клиента',exact:true})).toBeVisible();expect(checks).toBe(2);
 await page.reload();await expect(gate).toBeVisible();await gate.getByRole('button',{name:'Восстановить доступ через Telegram'}).click();await gate.getByLabel('Код восстановления').fill('123456');await gate.getByRole('button',{name:'Подтвердить восстановление'}).click();await expect(page.getByRole('button',{name:'Добавить клиента',exact:true})).toBeVisible();expect(recovered).toBe(true);
 await page.goto(origin+'/pulsedv/mini-app/#/profile');await expect(page.getByRole('heading',{name:'Уведомления',exact:true})).toBeVisible();const toggle=page.getByRole('switch',{name:'Защитить партнёрский кабинет'});await expect(toggle).toBeEnabled();await expect(toggle).not.toBeChecked();
 await page.evaluate(()=>{(window as any).testBioAllow=true});await toggle.click();await expect(toggle).toBeChecked();await toggle.click();await expect(toggle).not.toBeChecked();expect(enabled).toBe(false);
 await page.screenshot({path:`test-results/partner-security-${browserName}-${width}.png`,fullPage:true});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);expect(errors).toEqual([]);
});
