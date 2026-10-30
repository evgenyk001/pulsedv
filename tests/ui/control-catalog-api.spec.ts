import {complexProject} from '../fixtures/project-buildings';
import {test,expect} from '@playwright/test';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {createServer,type Server} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,extname,sep} from 'node:path';
import {testDatabase} from '../../backend/test/database';
import {migrate} from '../../backend/src/migrate';
import {createApp} from '../../backend/src/app';
import {readConfig} from '../../backend/src/config';
import {hashPassword} from '../../backend/src/security';
import {upsertCatalogProperty} from '../../backend/src/catalogRepository';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';
let server:Server,origin:string,root:string,app:Awaited<ReturnType<typeof createApp>>,db:Awaited<ReturnType<typeof testDatabase>>;
const password='control-polish-long-password';
test.beforeAll(async()=>{
 test.setTimeout(90000);
 root=await mkdtemp(join(tmpdir(),'pulse-control-api-'));
 await build({configFile:false,root:resolve('apps/control-center'),plugins:[react()],base:'/pulsedv/control-center/',define:{'import.meta.env.VITE_PULSE_MODE':JSON.stringify('api')},build:{outDir:join(root,'web'),emptyOutDir:true},logLevel:'silent'});
 server=createServer(async(req,res)=>{try{
  if(req.url?.startsWith('/api/v1/')){
   const chunks:Buffer[]=[];for await(const c of req)chunks.push(c);
   const response=await app.inject({method:req.method as any,url:req.url,headers:req.headers as any,...(chunks.length?{payload:Buffer.concat(chunks)}:{})});
   res.writeHead(response.statusCode,response.headers);res.end(response.rawPayload);return;
  }
  const path=new URL(req.url!,'http://localhost').pathname.replace(/^\/pulsedv\/control-center/,'');
  const folder=join(root,'web'),file=resolve(folder,'.'+(path.endsWith('/')?path+'index.html':path));
  if(!file.startsWith(folder+sep)){res.writeHead(403);res.end();return;}
  const bytes=await readFile(file);res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'} as any)[extname(file)]||'application/octet-stream'});res.end(bytes);
 }catch{if(!res.headersSent)res.writeHead(500);res.end()}});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('No origin');origin='http://127.0.0.1:'+address.port;
 db=await testDatabase();await migrate(db);
 app=await createApp(db,readConfig({NODE_ENV:'test',DATABASE_URL:'unused',PUBLIC_ORIGIN:origin,MEDIA_ROOT:join(root,'media')}));await app.ready();
 await db.query("insert into team_members(name,email,password_hash,role) values('Евгений · длинное имя администратора','owner@polish.test',$1,'owner')",[await hashPassword(password)]);
 await db.query('delete from catalog_properties');
 for(let i=0;i<27;i++)await upsertCatalogProperty(db,{...structuredClone(DEFAULT_STATE.properties[0]),id:'uss-'+i,name:'ЖК Уссурийск '+String(i).padStart(2,'0'),city:'Уссурийск',status:'published',sortOrder:i,coverImageUrl:null});
 await upsertCatalogProperty(db,{...structuredClone(DEFAULT_STATE.properties[0]),id:'draft-only',name:'ЖК Находка',city:'Находка',status:'draft',coverImageUrl:null});
});
test.afterAll(async()=>{if(server){server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))}if(app)await app.close();if(db)await db.close();if(root)await rm(root,{recursive:true,force:true})});
test('Real Control API: complete city choices, pagination, search, create/save and safe failure retry',async({page})=>{
 test.setTimeout(90000);const issues:string[]=[];page.on('pageerror',e=>issues.push(e.message));await page.setViewportSize({width:390,height:844});
 await page.goto(origin+'/pulsedv/control-center/#/objects');await page.getByLabel('Электронная почта').fill('owner@polish.test');await page.getByLabel('Пароль',{exact:true}).fill(password);await page.getByRole('button',{name:'Войти',exact:true}).click();
 const city=page.getByLabel('Город объектов');await expect(city).toBeVisible();await expect(city.locator('option')).toHaveCount(3);
 const chromeOverflow=await page.locator('.runtimeBar').evaluate(e=>{const r=e.getBoundingClientRect();return [...e.querySelectorAll('button')].filter(b=>{const rect=b.getBoundingClientRect();return rect.bottom>r.bottom+1||rect.top<r.top-1||rect.right>r.right+1}).map(b=>b.textContent||b.getAttribute('aria-label'))});expect(chromeOverflow).toEqual([]);

 await city.selectOption('Уссурийск');await expect(page.locator('.catalogObjectCard')).toHaveCount(24);await expect(page.locator('.catalogOverview article').first()).toContainText('27');
 await page.getByRole('button',{name:'Дальше',exact:true}).click();await expect(page.locator('.catalogObjectCard')).toHaveCount(3);
 await city.selectOption('Находка');await expect(page.locator('.catalogObjectCard')).toHaveCount(1);await expect(page.locator('.catalogPager')).toContainText('1 / 1');
 await page.getByRole('button',{name:'Опубликованы',exact:true}).click();await expect(page.getByText('Объекты не найдены',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Все',exact:true}).click();await page.getByRole('button',{name:'Добавить ЖК',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Редактор объекта'});await expect(dialog.getByLabel('Город',{exact:true})).toHaveValue('Находка');
 await dialog.getByLabel('Название',{exact:true}).fill('ЖК Новый берег');await dialog.getByRole('button',{name:'Сохранить',exact:true}).click();await expect(dialog.getByText('Все изменения сохранены',{exact:true})).toBeVisible();await dialog.getByRole('button',{name:'Закрыть редактор',exact:true}).click();
 await expect(page.locator('.catalogObjectCard')).toHaveCount(2);await page.reload();await expect(city).toHaveValue('Находка');await expect(page.locator('.catalogObjectCard')).toHaveCount(2);
 await page.getByLabel('Поиск объектов').fill('Новый берег');await expect(page.locator('.catalogObjectCard')).toHaveCount(1);
 await page.route('**/api/v1/control/catalog?**',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Temporary failure'})}));
 await city.selectOption('Уссурийск');await expect(page.getByRole('button',{name:'Повторить загрузку'})).toBeVisible();await page.unroute('**/api/v1/control/catalog?**');
 await page.getByRole('button',{name:'Повторить загрузку'}).click();await expect(page.getByText('Объекты не найдены',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Сбросить фильтры'}).click();await expect(page.locator('.catalogObjectCard')).toHaveCount(24);
 await page.getByRole('button',{name:'Открыть меню'}).click();await page.keyboard.press('Escape');await expect(page.locator('main')).not.toHaveAttribute('inert');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await page.screenshot({path:'test-results/control-real-api-mobile.png'});
 await page.goto(origin+'/pulsedv/control-center/#/settings');await expect(page.getByRole('heading',{name:'Доступ и уведомления'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await page.getByRole('button',{name:'Защита',exact:true}).click();const security=page.getByRole('dialog',{name:'Защита аккаунта'});await expect(security).toBeVisible();expect(await security.evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);await page.keyboard.press('Escape');await expect(security).toHaveCount(0);
 await page.goto(origin+'/pulsedv/control-center/#/content');await page.getByLabel('Версия',{exact:true}).fill('polish-version');await expect(page.locator('.saveBar')).toBeVisible();
 await page.goto(origin+'/pulsedv/control-center/#/objects');await page.locator('.catalogObjectCard').first().click();
 const pendingDialog=page.getByRole('dialog',{name:'Редактор объекта'});await expect(pendingDialog).toBeVisible();
 await expect.poll(async()=>{const d=await pendingDialog.boundingBox(),w=await page.locator('.workspaceBar').boundingBox();return d!.y-(w!.y+w!.height)}).toBeGreaterThanOrEqual(-1);
 await pendingDialog.getByRole('button',{name:'Закрыть редактор'}).click();page.once('dialog',d=>d.accept());await page.locator('.saveBar').getByRole('button',{name:'Отменить',exact:true}).click();await expect(page.locator('.saveBar')).toHaveCount(0);
 await page.clock.install();let stalled=false;await page.route('**/api/v1/control/catalog?**',()=>{stalled=true});await city.selectOption('Уссурийск');await expect.poll(()=>stalled).toBe(true);await page.clock.fastForward(12010);await expect(page.getByRole('button',{name:'Повторить загрузку'})).toBeVisible();await page.unroute('**/api/v1/control/catalog?**');
 expect(issues).toEqual([]);
});

test('Real Control CSV imports corps and plan bindings, preserves totals and saves edits',async({page})=>{
 test.setTimeout(90000);await page.setViewportSize({width:390,height:900});
 await upsertCatalogProperty(db,complexProject());
 await page.goto(origin+'/pulsedv/control-center/#/objects');await page.getByLabel('Электронная почта').fill('owner@polish.test');await page.getByLabel('Пароль',{exact:true}).fill(password);await page.getByRole('button',{name:'Войти',exact:true}).click();
 await expect(page.getByLabel('Город объектов')).toBeVisible();await page.locator('.catalogImportHub>summary').click();
 const files=[
  {name:'pulse-objects.csv',mimeType:'text/csv',buffer:Buffer.from('id;name;city;priceFrom;delivery;developerName;status;coverImageUrl\nmulti-project;ЖК CSV;Владивосток;6;2031;Застройщик;published;https://images.test/cover.svg')},
  {name:'pulse-buildings.csv',mimeType:'text/csv',buffer:Buffer.from('propertyId;id;name;phase;status;deliveryYear;deliveryQuarter;floorsFrom;floorsTo;totalApartments;availableApartments\nmulti-project;csv-b1;Корпус Импорт;Вторая очередь;building;2031;3;12;24;300;0')},
  {name:'pulse-floorplans.csv',mimeType:'text/csv',buffer:Buffer.from('propertyId;id;roomLabel;areaFrom;areaTo;priceFrom;priceTo;isExact;buildingId;sectionLabel\nmulti-project;csv-plan;1;40;40;6;6;true;csv-b1;А')}
 ];
 page.once('dialog',d=>d.accept());await page.locator('input[type=file][accept=".csv,text/csv"]').setInputFiles(files);await expect(page.getByRole('status')).toContainText('Импортировано 1');
 await page.getByLabel('Поиск объектов').fill('ЖК CSV');await expect(page.locator('.catalogObjectCard')).toHaveCount(1);await page.locator('.catalogObjectCard').click();const editor=page.getByRole('dialog',{name:'Редактор объекта'});
 await expect(editor.getByLabel('Корпус планировки',{exact:true})).toHaveValue('csv-b1');await expect(editor.getByLabel('Секция планировки',{exact:true})).toHaveValue('А');await expect(editor.getByLabel('Всего квартир в ЖК',{exact:true})).toHaveValue('900');
 await editor.getByLabel('Название корпуса',{exact:true}).fill('Корпус после правки');await editor.getByLabel('Всего квартир в ЖК',{exact:true}).fill('901');await editor.getByLabel('Всего квартир в ЖК',{exact:true}).blur();await editor.getByRole('button',{name:'Сохранить',exact:true}).click();await expect(editor.getByText('Все изменения сохранены',{exact:true})).toBeVisible();
 const response=await app.inject('/api/v1/public/catalog/multi-project');expect(response.statusCode).toBe(200);const saved=response.json().property;expect(saved.projectDetails.totalApartments).toBe(901);expect(saved.projectDetails.buildings[0].name).toBe('Корпус после правки');expect(saved.projectDetails.buildings[0].availableApartments).toBe(0);expect(saved.floorplans[0].buildingId).toBe('csv-b1');
 await editor.getByRole('button',{name:'Закрыть редактор'}).click();await page.reload();await page.getByLabel('Поиск объектов').fill('ЖК CSV');await expect(page.locator('.catalogObjectCard')).toHaveCount(1);await page.locator('.catalogObjectCard').click();await expect(editor.getByLabel('Корпус планировки',{exact:true})).toHaveValue('csv-b1');
});
