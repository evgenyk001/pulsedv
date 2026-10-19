import {test,expect} from '@playwright/test';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {createServer,type Server} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,extname,sep} from 'node:path';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';
let server:Server,origin:string,root:string;
test.beforeAll(async()=>{
 root=await mkdtemp(join(tmpdir(),'pulse-antifraud-control-'));
 await build({configFile:false,root:resolve('apps/control-center'),plugins:[react()],base:'/pulsedv/control-center/',define:{'import.meta.env.VITE_PULSE_MODE':JSON.stringify('api')},build:{outDir:root,emptyOutDir:true},logLevel:'silent'});
 const types:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'};
 server=createServer(async(req,res)=>{try{const path=new URL(req.url!,'http://localhost').pathname.replace(/^\/pulsedv\/control-center/,'');const file=resolve(root,'.'+(path.endsWith('/')?path+'index.html':path));if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch{if(!res.headersSent)res.writeHead(404);res.end()}});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('Missing test origin');origin='http://127.0.0.1:'+address.port;
});
test.afterAll(async()=>{if(server){server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))}if(root)await rm(root,{recursive:true,force:true})});
for(const width of [320,390])test(`Antifraud Control ${width}px: signals, explicit owner acknowledgement and repeat financial review`,async({page,browserName})=>{
 test.setTimeout(60000);await page.setViewportSize({width,height:844});
 const stamp=new Date().toISOString(),fingerprint='a'.repeat(64);
 const referral:any={id:'ref-1',partnerId:'partner-1',partnerName:'Анна',leadId:'lead-1',clientName:'Иван Покупатель',clientPhone:'+79995550202',status:'pending',stage:'new',stageLabel:'Новое обращение',conflict:false,revision:1,createdAt:stamp,acceptedAt:null,rejectionReason:null,events:[],reward:null,antifraud:{version:1,level:'high',signals:[{code:'partner_device',label:'Метка приложения покупателя встречалась у пригласившего партнёра',severity:'high',evidence:[]},{code:'phone_manual',label:'Принадлежность номера проверяется при разговоре с покупателем',severity:'info',evidence:[]}],fingerprint,checkedAt:stamp,manualRequired:true,phoneVerification:'manual',reviewed:false,reviewedAt:null}};
 const posted:any[]=[];
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname.replace('/api/v1','');let data:any={};
  if(path==='/control/me')data={member:{id:'owner-1',name:'Владелец',email:'owner@test.local',role:'owner',active:true,cities:[],telegramUserId:null,mfaEnabled:true}};
  else if(path==='/control/bootstrap')data={state:DEFAULT_STATE,version:1,members:[],notifications:[],counts:{leadsTotal:1,activeLeads:1,newLeads:1,unassignedLeads:1,openTasks:0,overdueTasks:0,hotProfiles:0,leadStages:{new:1}}};
  else if(path==='/control/partners')data={partners:[],referrals:[referral],page:1,total:1,hasMore:false,counts:{total:1,pending:referral.status==='pending'?1:0,conflicts:0,requested:0},securityAttempts:[{id:'attempt-1',partnerName:'Анна',reason:'Собственная покупка не участвует в программе',createdAt:stamp}]};
  else if(path==='/control/partner-referrals/ref-1')data={referral};
  else if(path.endsWith('/review')||path.endsWith('/risk-review')){const input=route.request().postDataJSON();posted.push({path,...input});referral.status='accepted';referral.revision++;referral.antifraud.reviewed=true;referral.antifraud.reviewedAt=stamp;data={ok:true};}
  else data={items:[],total:0,hasMore:false,page:1,counts:{}};
  await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto(origin+'/pulsedv/control-center/#/partners');
 await page.locator('.partnerReferralRow').click();const dialog=page.getByRole('dialog',{name:'Партнёрская рекомендация',exact:true});
 await expect(dialog.getByRole('heading',{name:'Антифрод',exact:true})).toBeVisible();await expect(dialog.getByText('Повышенный риск',{exact:true})).toBeVisible();
 const accept=dialog.getByRole('button',{name:'Закрепить за партнёром',exact:true});await expect(accept).toBeDisabled();
 await dialog.getByRole('checkbox',{name:/Связались с покупателем/}).check();await dialog.getByRole('textbox',{name:'Внутренняя заметка проверки'}).fill('Созвонились, покупатель подтвердил рекомендацию. Совместное устройство объяснено.');await expect(accept).toBeDisabled();
 await dialog.getByRole('checkbox',{name:/Проверил сигналы/}).check();await expect(accept).toBeEnabled();
 const layout=await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return {width:el.clientWidth,scroll:el.scrollWidth,overflow:[...el.querySelectorAll('*')].map(node=>{const b=node.getBoundingClientRect();return {tag:node.tagName,className:node.className,left:b.left,right:b.right,width:b.width}}).filter(v=>v.right>r.right+1||v.left<r.left-1)}});
 await expect.poll(()=>dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),{message:JSON.stringify(layout)}).toBe(true);
 await dialog.screenshot({path:`test-results/partner-antifraud-${browserName}-${width}.png`});await accept.click();
 await expect(dialog.getByText('Актуальные результаты проверены владельцем.',{exact:true})).toBeVisible();expect(posted[0].riskAcknowledged).toBe(true);expect(posted[0].riskFingerprint).toBe(fingerprint);
 await dialog.getByRole('button',{name:'Закрыть рекомендацию',exact:true}).click();
 referral.antifraud.reviewed=false;referral.antifraud.fingerprint='b'.repeat(64);await page.getByRole('button',{name:'Обновить',exact:true}).click();await page.locator('.partnerReferralRow').click();
 await expect(dialog.getByRole('heading',{name:'Повторная проверка перед расчётами'})).toBeVisible();await expect(dialog.getByRole('button',{name:'Проверить комиссию и начислить'})).toBeDisabled();
 await dialog.getByRole('checkbox',{name:/Связались с покупателем/}).check();await dialog.getByRole('textbox',{name:'Результат проверки',exact:true}).fill('Новые сигналы разобраны, контакт и рекомендация повторно подтверждены.');await dialog.getByRole('checkbox',{name:/Проверил сигналы/}).check();await dialog.getByRole('button',{name:'Подтвердить актуальную проверку'}).click();
 await expect(dialog.getByRole('button',{name:'Проверить комиссию и начислить'})).toBeEnabled();expect(posted[1].riskFingerprint).toBe('b'.repeat(64));
});
