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
