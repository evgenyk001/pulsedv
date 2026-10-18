import {test,expect} from '@playwright/test';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {createServer,type Server} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,extname,sep} from 'node:path';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';
import {OFFER_VERSION} from '../../packages/partners/offer';
import {businessDay} from '../../packages/pulse-data/business';
import {claimExpiresOn} from '../../packages/partners/policy';
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
for(const width of [320,390])test(`Partner API flow ${width}px: rejected number, correct personal link, pending hold and confirmed month`,async({page,browserName})=>{
 test.setTimeout(60000);await page.setViewportSize({width,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(version=>{localStorage.setItem('pulse_onboarding_version',version);localStorage.setItem('pulse.partner.guide.v1','seen')},DEFAULT_STATE.content.onboardingVersion);
 const stamp=new Date().toISOString(),hold={id:'reservation-1',code:'i01234567890123456789',label:'Иван',phoneHint:'••• 0202',createdAt:stamp,expiresAt:new Date(Date.now()+7*86400000).toISOString()};
 let phase:'empty'|'held'|'pending'|'confirmed'='empty',checks=0;
 const posted:any[]=[];let releasePayments:()=>void=()=>{};let paymentRequested=false;const paymentGate=new Promise<void>(resolve=>{releasePayments=resolve});
 await page.route('**/api/v1/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname.replace('/api/v1','');let data:any={ok:true};
  if(path==='/public/state')data={state:DEFAULT_STATE,version:1,consentVersion:'2026-09-25'};
  if(path==='/auth/session')data={sessionId:'test-session',accessToken:'test-token',expiresAt:new Date(Date.now()+86400000).toISOString()};
  if(path==='/public/partner-program')data={botUsername:'pulsedvbot',offerPublished:true};
  if(path==='/me/partner'&&url.searchParams.get('filter')==='payments'){paymentRequested=true;await paymentGate}
  if(path==='/me/partner')data={authenticated:true,partner:{id:'partner-1',userId:'user-1',name:'Анна',phone:'+79995550101',code:'p01234567890123456789',status:'active',termsVersion:OFFER_VERSION,createdAt:stamp},referrals:['pending','confirmed'].includes(phase)?[{id:'referral-1',partnerId:'partner-1',partnerName:'Анна',clientName:'Иван П.',status:phase==='confirmed'?'accepted':'pending',stage:'new',stageLabel:'Новое обращение',termsVersion:OFFER_VERSION,claimStartedOn:phase==='confirmed'?businessDay():null,claimExpiresOn:phase==='confirmed'?claimExpiresOn(businessDay()):null,conflict:false,revision:1,createdAt:stamp,acceptedAt:stamp,rejectionReason:null,events:[],reward:null}]:[],reservations:['held','pending'].includes(phase)?[{...hold,submitted:phase==='pending'}]:[],invitations:[],page:1,total:['pending','confirmed'].includes(phase)?1:0,hasMore:false,summary:{acceptedCount:phase==='confirmed'?1:0,pendingCount:phase==='pending'?1:0,accruedMinor:0,paidMinor:0}};
  if(path==='/me/partner/reservations'){
   posted.push(route.request().postDataJSON());checks++;
   if(checks===1)data={outcome:'not_unique',message:'Клиент уже обращался к нам или закреплён. Проверьте номер.'};
   else{phase='held';data={outcome:'reserved',message:'Номер подходит',reservation:hold};}
  }
  await route.fulfill({json:data});
 });
 await page.goto(origin+'/pulsedv/mini-app/#/partners');await page.getByRole('button',{name:'Добавить клиента',exact:true}).click();
 const form=page.getByRole('dialog',{name:'Добавить клиента',exact:true});await form.getByRole('textbox',{name:'Имя клиента',exact:true}).fill('Иван');await form.getByRole('textbox',{name:'Телефон клиента',exact:true}).fill('+79995550000');await form.getByRole('checkbox').check();await form.getByRole('button',{name:'Проверить номер',exact:true}).click();
 await expect(form).toContainText('Клиента нельзя добавить');await expect(form.getByRole('textbox',{name:'Ссылка для этого клиента'})).toHaveCount(0);
 await form.getByRole('textbox',{name:'Телефон клиента',exact:true}).fill('+79995550202');await form.getByRole('button',{name:'Проверить номер',exact:true}).click();
 await expect(form).toContainText('Номер защищён за вами');await expect(form).toContainText('Шаг 2 из 2');await expect(form.getByRole('textbox',{name:'Ссылка для этого клиента'})).toHaveValue('https://t.me/pulsedvbot?startapp=ref_'+hold.code);
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(value:string)=>{sessionStorage.setItem('test-copied-link',value)}}}));
 await form.getByRole('button',{name:'Скопировать ссылку',exact:true}).click();await expect(form.getByRole('button',{name:'Ссылка скопирована',exact:true})).toBeVisible();await expect(page.getByRole('status').filter({hasText:/^Ссылка скопирована$/})).toBeVisible();expect(await page.evaluate(()=>sessionStorage.getItem('test-copied-link'))).toBe('https://t.me/pulsedvbot?startapp=ref_'+hold.code);
 await expect(form.getByRole('button',{name:'Отправить ссылку клиенту',exact:true})).toBeEnabled();expect(posted[1]).toMatchObject({label:'Иван',phone:'+79995550202',contactConsent:true});expect(posted[1].idempotencyKey).not.toBe(posted[0].idempotencyKey);
 await page.screenshot({path:`test-results/partner-number-success-${browserName}-${width}.png`,animations:'disabled'});
 await form.getByRole('button',{name:'Готово, смотреть моих клиентов',exact:true}).click();await expect(page.getByRole('heading',{name:'Ждём подтверждения клиента'})).toBeVisible();
 phase='pending';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.getByRole('heading',{name:'Ждём подтверждения клиента'})).toHaveCount(0);await expect(page.getByRole('button',{name:/Иван П\./})).toContainText('На проверке');
 await page.waitForTimeout(350);phase='confirmed';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.getByRole('heading',{name:'Ждём подтверждения клиента'})).toHaveCount(0);const row=page.getByRole('button',{name:/Иван П\./});await expect(row).toContainText('Клиент закреплён');await expect(row).toContainText('Закреп до');await row.click();
 const details=page.getByRole('dialog',{name:'Иван П.',exact:true});await expect(details).toContainText(new Date(claimExpiresOn(businessDay())+'T00:00:00Z').toLocaleDateString('ru-RU',{timeZone:'UTC'}));
 await page.keyboard.press('Escape');await page.getByRole('tab',{name:'Выплаты',exact:true}).click();await expect.poll(()=>paymentRequested).toBe(true);
 await expect(page.getByRole('region',{name:'Сводка вознаграждения'})).toBeVisible();await expect(page.getByRole('button',{name:'Добавить клиента',exact:true})).toBeEnabled();await expect(page.getByText('Загружаем партнёрский кабинет…',{exact:true})).toHaveCount(0);
 releasePayments();await expect(page.getByText('Начислений пока нет',{exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
