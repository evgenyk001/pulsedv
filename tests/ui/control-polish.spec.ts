import {test,expect,type Page} from '@playwright/test';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';
const now=new Date().toISOString();
const lead={id:'58f80f88-bd0f-45e1-b385-73549757791a',name:'Анна Александровна · длинное имя клиента',phone:'+79990000479',source:'test',propertyId:null,comment:'Перезвонить после работы',status:'new',manager:null,createdAt:now,updatedAt:now,sessionId:'polish',userId:null,score:75,priority:'urgent',scoreReasons:[],topPropertyId:null,city:'Владивосток',mortgageProgram:null,nextAction:'Обсудить квартиру для большой семьи и согласовать показ'};
async function seed(page:Page){
 await page.addInitScript(({state,lead})=>{
  if(!localStorage.getItem('pulse.dv.control.state.v1'))localStorage.setItem('pulse.dv.control.state.v1',JSON.stringify(state));
  if(!localStorage.getItem('pulse.dv.control.leads.v1'))localStorage.setItem('pulse.dv.control.leads.v1',JSON.stringify([lead]));
  localStorage.setItem('pulse.dv.control.profiles.v1',JSON.stringify([{id:'profile',sessionId:'polish',userId:null,score:75,priority:'urgent',scoreReasons:[],topPropertyId:'primorskiy',city:'Владивосток',mortgageProgram:null,nextAction:lead.nextAction,eventCount:12,firstSeenAt:lead.createdAt,lastSeenAt:lead.createdAt,updatedAt:lead.updatedAt,client:{firstName:'Анна',lastName:'Александровна',phone:lead.phone,telegramId:null,username:null}}]));
  localStorage.setItem('pulse.dv.control.tasks.v1',JSON.stringify([{id:'task',leadId:lead.id,profileId:'profile',sessionId:'polish',title:'Договориться о показе квартиры для большой семьи',reason:'Клиент рассматривает несколько ЖК и просит сравнить условия покупки',priority:'urgent',status:'today',dueAt:lead.createdAt,createdAt:lead.createdAt,updatedAt:lead.updatedAt}]));
 },{state:{...DEFAULT_STATE,properties:[...DEFAULT_STATE.properties,{...DEFAULT_STATE.properties[0],id:'draft-city',name:'ЖК Будущий',city:'Находка',status:'draft' as const}]},lead});
 await page.route('**/assets/*.webp',r=>r.abort());
}
async function fits(page:Page){
 expect(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth)).toBeLessThanOrEqual(1);
}
for(const width of [320,390,768,1024,1280,1440])test(`Control ${width}px: all sections, filters, navigation and editors fit`,async({page})=>{
 test.setTimeout(120000);await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});await seed(page);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const route of ['','leads','partners','users','journey','tasks','objects','mortgage','select','content','broadcasts','analytics','settings']){
  await test.step(route||'overview',async()=>{
   await page.goto('/pulsedv/control-center/#/'+route);await expect(page.locator('.page h1')).toBeVisible();await fits(page);
   await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await fits(page);
  });
 }
 await page.goto('/pulsedv/control-center/#/objects');await page.getByLabel('Город объектов').selectOption('Находка');
 await expect(page.locator('.catalogObjectCard')).toHaveCount(1);await expect(page.locator('.catalogObjectCard')).toContainText('ЖК Будущий');
 await page.getByRole('button',{name:'Добавить ЖК',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Редактор объекта'});
 await expect(dialog.getByLabel('Город',{exact:true})).toHaveValue('Находка');
 await expect(dialog).toBeVisible();expect(await dialog.evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);
 const boundaries=await dialog.evaluate(e=>{const r=e.getBoundingClientRect();return [...e.querySelectorAll('input,select,textarea,button')].filter(n=>{const b=n.getBoundingClientRect();return b.width>0&&(b.left<r.left-1||b.right>r.right+1)}).map(n=>n.outerHTML.slice(0,120))});expect(boundaries).toEqual([]);
 await dialog.getByLabel('Название',{exact:true}).fill('ЖК Новый в Находке');
 await dialog.getByRole('button',{name:'Готово',exact:true}).click();await expect(dialog).toHaveCount(0);
 await page.reload();await expect(page.getByLabel('Город объектов')).toHaveValue('Находка');await expect(page.locator('.catalogObjectCard')).toHaveCount(2);
 await page.getByLabel('Город объектов').selectOption('Уссурийск');await expect(page.locator('.catalogObjectCard')).toHaveCount(1);
 await page.goBack();await expect(page.getByLabel('Город объектов')).toHaveValue('Находка');
 await page.locator('.catalogImportHub>summary').click();await expect(page.getByRole('button',{name:/Шаблоны каталога/})).toBeVisible();await fits(page);
 if(width<=1024){
  await page.evaluate(()=>scrollTo(0,0));await page.getByRole('button',{name:'Открыть меню'}).click();
  const nav=page.getByRole('dialog',{name:'Навигация PULSE Control'});await expect(nav).toBeVisible();
  expect(await page.locator('main').evaluate(e=>e.inert)).toBe(true);
  await page.keyboard.press('Tab');expect(await nav.evaluate(e=>e.contains(document.activeElement))).toBe(true);
  await nav.getByRole('link',{name:'Лиды',exact:false}).click();await expect(nav).toHaveCount(0);await expect(page.locator('.page h1')).toContainText('Лиды');
 }
 await page.goto('/pulsedv/control-center/#/leads');await page.locator('.leadRowButton').filter({hasText:lead.name}).click();const client=page.getByRole('dialog',{name:'Карточка клиента'});
 await expect(client).toBeVisible();await fits(page);expect(await client.evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);
 const header=await client.locator('.drawerHeader').boundingBox(),bar=await page.locator('.workspaceBar').boundingBox();expect(header!.y).toBeGreaterThanOrEqual(bar!.y+bar!.height-1);
 await page.screenshot({path:`test-results/control-client-${width}.png`});await page.keyboard.press('Escape');await expect(client).toHaveCount(0);
 await page.goto('/pulsedv/control-center/#/users');await page.locator('.profilesGrid.leadRowButton').first().click();
 const profile=page.getByRole('dialog',{name:'Профиль посетителя'});await expect(profile).toBeVisible();expect(await profile.evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);await page.keyboard.press('Escape');await expect(profile).toHaveCount(0);
 expect(errors).toEqual([]);
});
