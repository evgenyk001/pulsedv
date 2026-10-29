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

const leadId='e8e5eefa-5f5d-4596-88bc-9646ac6aee28';
function setupAccount(active=false){
 let starts=0,messages=0,deletes=0;let lastStart:any;
 let items:any[]=active?[{leadId,leadName:'Анна',status:'new',propertyId:null,createdAt:new Date().toISOString(),managerName:'Мария',managerHasReplied:false,journey:{leadId,revision:1,collections:[],showings:[],nextStep:null,messages:[]}}]:[];
 apiHandler=(req,payload)=>{
  const path=new URL(req.url!,origin).pathname.replace('/api/v1','');
  if(path==='/public/state')return {state:DEFAULT_STATE,version:1,consentVersion:'test',requiresPhone:true};
  if(path==='/auth/session')return {sessionId:'session',accessToken:'token',expiresAt:new Date(Date.now()+86400000).toISOString()};
  if(path==='/me/account')return {registered:true,authenticated:true,requiresPhone:true};
  if(path==='/me/favorites')return {ids:[],authenticated:true};
  if(path==='/me/journeys')return {items,limited:false};
  if(path==='/me/conversations/start'){
   starts++;lastStart=payload;expect(payload.name).toBeUndefined();expect(payload.phone).toBeUndefined();
   const id=payload.newPurchase?'12d4cae1-797d-44e2-a2f3-3735d0d83b31':leadId;
   items=[{leadId:id,leadName:'Анна',status:'new',propertyId:payload.propertyId,createdAt:new Date().toISOString(),managerName:'Мария',managerHasReplied:false,journey:{leadId:id,revision:1,collections:[],showings:[],nextStep:null,messages:[{id:'first-message',author:'client',at:new Date().toISOString(),text:payload.text,requestContext:payload.context}]}}];return {id,duplicate:false};
  }
  if(path.endsWith('/read'))return {journey:items[0].journey};
  if(path.includes('/attachments/')&&req.method==='DELETE'){deletes++;return {ok:true};}
  if(path==='/me/journeys/'+leadId&&req.method==='POST'){messages++;items[0].journey={...items[0].journey,revision:items[0].journey.revision+1,messages:[...items[0].journey.messages,{...payload.command,author:'client',at:new Date().toISOString()}]};return {journey:items[0].journey};}
  if(path==='/public/catalog/meta')return {rooms:['1','2'],deliveries:['2027'],cities:[],minPriceRub:4000000,maxPriceRub:25000000,stepRub:100000,total:DEFAULT_STATE.properties.length};
  if(path==='/public/catalog'||path==='/public/catalog/featured')return {items:DEFAULT_STATE.properties,page:1,limit:1000,total:DEFAULT_STATE.properties.length,hasMore:false};
  if(path.startsWith('/public/catalog/'))return {property:DEFAULT_STATE.properties.find(p=>p.id===path.split('/').at(-1))};
  return {ok:true,items:[]};
 };
 return {starts:()=>starts,messages:()=>messages,lastStart:()=>lastStart,deletes:()=>deletes,reply:()=>{items[0].managerName=null;items[0].managerHasReplied=true;items[0].journey.messages.push({id:'manager-reply',author:'manager',authorName:'Мария',text:'Добрый день! Помогу с подбором.',at:new Date().toISOString()})}};
}
async function prepare(page:any){
 await page.addInitScript(state=>localStorage.setItem('pulse_onboarding_version',state.content.onboardingVersion),DEFAULT_STATE);
 await page.route('https://telegram.org/js/telegram-web-app.js',route=>route.fulfill({body:''}));
}
for(const width of [320,390])test(`Registered chat ${width}: free first message, no repeated contacts or empty lead, stable reply name`,async({page})=>{
 const backend=setupAccount();await page.setViewportSize({width,height:844});await prepare(page);
 await page.goto(origin+'/pulsedv/mini-app/#/journey');await page.getByRole('button',{name:'Обсудить покупку',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Сообщение',exact:true})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Телефон',exact:true})).toHaveCount(0);await expect(page.getByText('Как к вам обращаться',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('navigation',{name:'Основная навигация'})).toHaveCount(0);expect(backend.starts()).toBe(0);
 await expect(page.getByRole('button',{name:'Хочу обсудить бюджет',exact:true})).toHaveCount(0);
 await page.getByRole('textbox',{name:'Сообщение',exact:true}).fill('Здравствуйте! Можно задать вопрос?');
 await page.getByRole('checkbox',{name:/Согласен на обработку/}).check();
 await page.screenshot({path:`test-results/account-chat-draft-${width}.png`,animations:'disabled'});
 await page.getByRole('button',{name:'Отправить сообщение',exact:true}).click();
 await expect(page).toHaveURL(new RegExp('lead='+leadId));await expect(page.getByRole('article',{name:'Ваше сообщение'})).toHaveCount(1);expect(backend.starts()).toBe(1);
 await expect(page.getByText('Сообщение получено. Свободный специалист команды ответит здесь.',{exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Команда PULSEDV.RU',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Обновить переписку',exact:true})).toHaveCount(0);
 backend.reply();await page.reload();await expect(page.getByRole('heading',{name:'Мария',exact:true})).toBeVisible();await expect(page.getByText('Владелец',{exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('An active conversation opens directly; attachment uploads on selection, with an inline spinner and guarded Send',async({page})=>{
 const backend=setupAccount(true);await prepare(page);let release!:()=>void;let uploads=0;const gate=new Promise<void>(r=>release=r);
 await page.route('**/api/v1/me/journeys/*/attachments?*',async route=>{uploads++;await gate;await route.fulfill({json:{attachment:{kind:'image',name:'photo.png',url:'/api/v1/journey-media/'+leadId+'/a7fbe933-0697-4398-bbb7-c53ee896b260.png',mimeType:'image/png',size:68}}})});
 await page.goto(origin+'/pulsedv/mini-app/#/property/primorskiy');await page.getByRole('button',{name:'Узнать наличие',exact:true}).click();
 await expect(page).toHaveURL(new RegExp('lead='+leadId));expect(backend.starts()).toBe(0);
 await page.getByRole('button',{name:'Добавить вложение'}).click();
 await page.getByLabel('Выбрать фото').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZcgAAAABJRU5ErkJggg==','base64')});
 await expect(page.getByRole('status',{name:'Загрузка вложения'})).toBeVisible();await expect(page.getByText('Загружаем вложение…',{exact:true})).toHaveCount(0);
 await page.getByRole('textbox',{name:'Сообщение',exact:true}).fill('Посмотрите, пожалуйста, эту планировку');await expect(page.getByRole('button',{name:'Отправить сообщение'})).toBeDisabled();expect(uploads).toBe(1);
 await page.screenshot({path:'test-results/account-chat-upload.png',animations:'disabled'});release();
 await expect(page.getByRole('status',{name:'Загрузка вложения'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Отправить сообщение'})).toBeEnabled();
 await page.getByRole('button',{name:'Отправить сообщение'}).click();await expect(page.getByRole('article',{name:'Ваше сообщение'})).toHaveCount(1);expect(backend.messages()).toBe(1);expect(uploads).toBe(1);
});
