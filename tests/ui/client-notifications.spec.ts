import {test,expect} from '@playwright/test';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';
import {searchSnapshot} from '../../packages/my-search';
const leadId='58f80f88-bd0f-45e1-b385-73549757791a';
async function seed(page:any,notices=false){
 const settings={criteria:null,watchFavorites:true,telegram:false};
 const baseline=searchSnapshot(DEFAULT_STATE.properties,settings,['primorskiy']);
 await page.addInitScript(({state,leadId,notices,baseline}:any)=>{
  if(localStorage.getItem('test.inbox-seeded'))return;
  localStorage.setItem('test.inbox-seeded','1');
  localStorage.setItem('pulse.dv.control.state.v1',JSON.stringify(state));localStorage.setItem('pulse_onboarding_version',state.content.onboardingVersion);
  localStorage.setItem('pulse.dv.favorites.v1',JSON.stringify(['primorskiy']));
  if(!notices)return;
  sessionStorage.setItem('pulse.dv.session.v1','inbox-test');
  localStorage.setItem('pulse.dv.control.leads.v1',JSON.stringify([{id:leadId,name:'Тест уведомлений',phone:'+79990000000',source:'test',propertyId:'primorskiy',status:'new',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),sessionId:'inbox-test',userId:null,score:0,priority:'cold',scoreReasons:[]} ]));
  const at=new Date().toISOString();
  localStorage.setItem('pulse.dv.journeys.v1',JSON.stringify({[leadId]:{leadId,revision:1,showings:[],nextStep:null,collections:[{id:'collection-test',title:'Варианты у моря',published:true,createdAt:at,items:[]}],messages:[{id:'new-message',text:'Подготовил варианты для вас',author:'manager',at},{id:'read-message',text:'Вы уже читали этот ответ',author:'manager',at,readAt:at},{id:'own-message',text:'Мой вопрос',author:'client',at}]}}));
  localStorage.setItem('pulse.my-search.v1',JSON.stringify({settings:{criteria:null,watchFavorites:true,telegram:false},authenticated:false,baseline,feed:[{id:'search-price',propertyId:'primorskiy',kind:'price',title:'Цена обновилась',name:'ЖК Приморский',at}]}));
 },{state:DEFAULT_STATE,leadId,notices,baseline});
}

test('Saved hearts are fully filled in home, catalog, favorites and property details',async({page})=>{
 test.setTimeout(60000);await page.setViewportSize({width:390,height:844});await seed(page);
 for(const route of ['','catalog','favorites','property/primorskiy']){
  await page.goto('/pulsedv/mini-app/#/'+route);
  const button=page.getByRole('button',{name:'Убрать из избранного',exact:true}).first();
  await expect(button).toHaveAttribute('aria-pressed','true');await expect(button.locator('svg')).toHaveAttribute('fill','currentColor');
 }
});

test('Notification badge counts real updates, preserves reads and accepts a new manager reply',async({page})=>{
 await page.setViewportSize({width:390,height:844});await seed(page,true);
 await page.goto('/pulsedv/mini-app/');
 // One unread reply and one collection; the already-read reply is excluded.
 // A saved-search update is also exposed in this unified inbox.
 const bell=page.getByRole('button',{name:/Уведомления, новых:/});await expect(bell).toBeVisible();
 const initial=await bell.getAttribute('aria-label');const count=Number(initial!.split(': ')[1]);expect(count).toBe(3);
 await expect(bell.locator('.pulseNotificationBadge')).toHaveText(String(count));await bell.click();
 await expect(page.getByRole('link',{name:/Подборка: Варианты у моря/})).toBeVisible();
 await expect(page.getByRole('link',{name:/Подготовил варианты для вас/})).toBeVisible();
 await expect(page.getByRole('link',{name:/Цена обновилась/})).toHaveAttribute('href',/#\/property\/primorskiy/);
 await page.getByRole('button',{name:'Прочитать все',exact:true}).click();await expect(page.getByText('Всё прочитано',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Закрыть уведомления',exact:true}).click();
 await expect(page.getByRole('button',{name:'Уведомления',exact:true}).locator('.pulseNotificationBadge')).toHaveCount(0);
 await page.reload();await expect(page.getByRole('button',{name:'Уведомления',exact:true})).toBeVisible();
 await page.evaluate(id=>{const data=JSON.parse(localStorage.getItem('pulse.dv.journeys.v1')!);data[id].messages.push({id:'arrived-later',text:'Новое сообщение',author:'manager',at:new Date().toISOString()});localStorage.setItem('pulse.dv.journeys.v1',JSON.stringify(data));window.dispatchEvent(new Event('pulse:journey'));},leadId);
 await expect(page.getByRole('button',{name:'Уведомления, новых: 1',exact:true})).toBeVisible();
});

test('Fresh visitor sees an empty real inbox and no invented notification count',async({page})=>{
 await seed(page);await page.goto('/pulsedv/mini-app/');
 const bell=page.getByRole('button',{name:'Уведомления',exact:true});await expect(bell).toBeVisible();await expect(bell.locator('.pulseNotificationBadge')).toHaveCount(0);await bell.click();
 await expect(page.getByText('Вы ничего не пропустили',{exact:true})).toBeVisible();
});

async function swipeLeft(page:any,row:any,fraction=.75){
 // Wait for the sheet's entrance animation and bring this row into its scroll viewport.
 await row.locator('a').click({trial:true});
 const box=await row.boundingBox();if(!box)throw new Error('No swipe row');
 await page.mouse.move(box.x+box.width-25,box.y+box.height/2);await page.mouse.down();
 await page.mouse.move(box.x+box.width*(1-fraction)-25,box.y+box.height/2,{steps:12});await page.mouse.up();
}
for(const width of [320,390])test(`Swipe notifications ${width}: dismiss without opening chat, persist after reload, bounded list`,async({page})=>{
 await page.setViewportSize({width,height:844});await seed(page,true);await page.goto('/pulsedv/mini-app/');await page.getByRole('button',{name:/Уведомления, новых:/}).click();
 const row=page.locator('[data-swipe-row="notice:message:new-message"]');await expect(row).toBeVisible();await swipeLeft(page,row);
 await expect(row).toHaveCount(0);await expect(page).not.toHaveURL(/journey/);
 await page.getByRole('button',{name:'Закрыть уведомления'}).click();await page.reload();await page.getByRole('button',{name:/Уведомления/}).first().click();await expect(row).toHaveCount(0);await expect(page.getByRole('link',{name:/Вы уже читали этот ответ/})).toBeVisible();
 await page.screenshot({path:`test-results/swipe-notifications-${width}.png`,animations:'disabled'});
});
test('Swipe journeys pin, unpin, delete and undo without changing messages; new replies restore the row',async({page})=>{
 await page.setViewportSize({width:390,height:844});await seed(page,true);await page.goto('/pulsedv/mini-app/#/journey');
 await page.evaluate(()=>{const leads=JSON.parse(localStorage.getItem('pulse.dv.control.leads.v1')!);leads.push({...leads[0],id:'2c977bb2-6f41-4e3e-9dbc-639fbda3bba8',createdAt:new Date(Date.now()+1000).toISOString()});localStorage.setItem('pulse.dv.control.leads.v1',JSON.stringify(leads));window.dispatchEvent(new Event('pulse:control-leads'));});
 const row=page.locator('[data-swipe-row="journey:'+leadId+'"]');await expect(row).toBeVisible();await swipeLeft(page,row,.45);
 await row.getByRole('button',{name:/^Закрепить —/}).click();await expect(row.getByLabel('Закреплено')).toBeVisible();await expect(page.locator('[data-swipe-row]').first()).toHaveAttribute('data-swipe-row','journey:'+leadId);await page.reload();await expect(row.getByLabel('Закреплено')).toBeVisible();
 await swipeLeft(page,row,.45);await row.getByRole('button',{name:/^Открепить —/}).click();await expect(row.getByLabel('Закреплено')).toHaveCount(0);
 await swipeLeft(page,row,.45);await row.getByRole('button',{name:/^Удалить —/}).click();await expect(row).toHaveCount(0);await page.getByRole('button',{name:'Отменить',exact:true}).click();await expect(row).toBeVisible();
 await swipeLeft(page,row,.45);await row.getByRole('button',{name:/^Удалить —/}).click();await expect(row).toHaveCount(0);await page.reload();await expect(row).toHaveCount(0);
 await page.evaluate(id=>{const all=JSON.parse(localStorage.getItem('pulse.dv.journeys.v1')!);all[id].messages.push({id:'later',text:'Продолжим подбор?',author:'manager',at:new Date(Date.now()+1000).toISOString()});localStorage.setItem('pulse.dv.journeys.v1',JSON.stringify(all));window.dispatchEvent(new Event('pulse:journey'));},leadId);
 await expect(row).toBeVisible();await expect(row).toContainText('Продолжим подбор?');await expect(page.getByRole('link',{name:/Продолжим подбор/})).toHaveAttribute('href',/#\/journey\?lead=/);
 await page.screenshot({path:'test-results/swipe-journeys.png',animations:'disabled'});
});
test('Large notification inbox stays scrollable while its footer remains reachable',async({page})=>{
 await page.setViewportSize({width:320,height:700});await seed(page,true);await page.goto('/pulsedv/mini-app/');
 await page.evaluate(id=>{const all=JSON.parse(localStorage.getItem('pulse.dv.journeys.v1')!);all[id].messages=Array.from({length:90},(_,i)=>({id:'bulk-'+i,text:'Сообщение '+i,author:'manager',at:new Date(Date.now()+i).toISOString()}));localStorage.setItem('pulse.dv.journeys.v1',JSON.stringify(all));window.dispatchEvent(new Event('pulse:journey'));},leadId);
 await page.getByRole('button',{name:/Уведомления, новых:/}).click();const list=page.locator('.pulseUpdatesList');await expect(list.locator('[data-swipe-row]')).toHaveCount(80);
 expect(await list.evaluate((e:any)=>e.scrollHeight>e.clientHeight)).toBe(true);await list.evaluate((e:any)=>e.scrollTop=e.scrollHeight);await expect(page.getByRole('link',{name:'Мои обращения',exact:true})).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test.describe('Native touch inbox gestures',()=>{
 test.use({hasTouch:true});
 test('Touch starting on a nested icon dismisses its card without opening chat',async({page,browserName})=>{
  test.skip(browserName!=='chromium','Native touch injection uses Chromium CDP');
  await page.setViewportSize({width:390,height:844});await seed(page,true);await page.goto('/pulsedv/mini-app/');await page.getByRole('button',{name:/Уведомления, новых:/}).click();
  const row=page.locator('[data-swipe-row="notice:message:new-message"]');await row.locator('a').click({trial:true});
  const cdp=await page.context().newCDPSession(page);
  const touch=async(type:string,x:number,y:number)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x,y}]});
  const box=(await row.boundingBox())!;
  const start=box.x+box.width-25,cy=box.y+box.height/2;
  await touch('touchStart',start,cy);for(let i=1;i<=12;i++)await touch('touchMove',start-box.width*.75*i/12,cy);await touch('touchEnd',start-box.width*.75,cy);
  await expect(row).toHaveCount(0);await expect(page).not.toHaveURL(/journey/);
  const remaining=page.locator('[data-swipe-row="notice:message:read-message"]');
  await remaining.locator('a').click({trial:true});const next=(await remaining.boundingBox())!,nx=next.x+next.width*.7,ny=next.y+next.height/2;
  // A cancelled drag must return home, and native vertical scrolling must not dismiss a row.
  await touch('touchStart',nx,ny);await touch('touchMove',nx-40,ny);await touch('touchCancel',nx-40,ny);
  await expect(remaining.locator(':scope > div').nth(1)).toHaveCSS('transform','matrix(1, 0, 0, 1, 0, 0)');
  await touch('touchStart',nx,ny);await touch('touchMove',nx+1,ny-25);await touch('touchMove',nx+2,ny-55);await touch('touchEnd',nx+2,ny-55);
  await expect(remaining).toHaveCount(1);await expect(page).not.toHaveURL(/journey/);await cdp.detach();
 });
});
