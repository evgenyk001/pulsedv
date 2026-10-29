import {test,expect,type Page} from '@playwright/test';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';
async function seed(page:Page,saved:Record<string,unknown>={}){
 const state=structuredClone(DEFAULT_STATE),template=state.properties[0];
 state.properties=['Центр','Центр','Водоканал','Семь Ветров','Междуречье','Ленинградская'].map((district,i)=>({...structuredClone(template),id:'uss-'+i,name:i===0?'ЖК Атриум':i===1?'ЖК Кленовый парк':'ЖК Другой '+i,city:'Уссурийск',district,description:'10 минут до центра',features:[],tags:[],delivery:'2 кв. 2027',sortOrder:6-i,priceFrom:6+i*.1,floorplans:[{roomLabel:'1',areaFrom:40,areaTo:40,isExact:true,priceFrom:6+i*.1,priceTo:6+i*.1,finishType:'rough',imageUrl:null,sortOrder:0}]}));
 state.properties.push({...structuredClone(template),id:'vlad-popular',name:'ЖК Во Владивостоке',city:'Владивосток'});
 const events=[...Array.from({length:3},(_,i)=>({entityId:'uss-0',sessionId:'person-'+i})),...Array.from({length:20},()=>({entityId:'uss-3',sessionId:'same-person'})),...Array.from({length:6},(_,i)=>({entityId:'vlad-popular',sessionId:'vlad-person-'+i}))].map((e,i)=>({...e,id:'event-'+i,userId:null,eventType:'property_view',entityType:'property',metadata:{},createdAt:new Date().toISOString()}));
 await page.route('https://images.unsplash.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#9aaebe"/><path d="M50 500V130h210v370m100 0V70h270v430" fill="#455c70"/></svg>'}));
 await page.route('https://telegram.org/js/telegram-web-app.js',route=>route.fulfill({body:''}));
 await page.addInitScript(({state,events,saved})=>{
  if(!localStorage.getItem('pulse.dv.control.state.v1'))localStorage.setItem('pulse.dv.control.state.v1',JSON.stringify(state));
  if(!localStorage.getItem('pulse.dv.control.events.v1'))localStorage.setItem('pulse.dv.control.events.v1',JSON.stringify(events));
  localStorage.setItem('pulse_onboarding_version',state.content.onboardingVersion);
  if(!localStorage.getItem('pulse_selection_current_v2'))localStorage.setItem('pulse_selection_current_v2',JSON.stringify({version:6,started:true,city:'Уссурийск',rooms:'Все',purchaseMode:'cash',budget:[0,20000000],...saved}));
 },{state,events,saved});
}
for(const width of [320,390])test(`Strict Select ${width}: only two central projects, native class picker and retained percentage`,async({page})=>{
 await page.setViewportSize({width,height:844});await seed(page);await page.goto('/pulsedv/mini-app/#/selection');
 await page.getByRole('combobox',{name:'Район',exact:true}).selectOption('Центр');
 await expect(page.getByRole('combobox',{name:'Класс жилья',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Бизнес',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:/Показать подходящие/}).click();
 await expect(page.getByRole('button',{name:'Посмотреть проект',exact:true})).toHaveCount(2);
 await expect(page.getByText('ЖК Атриум',{exact:true})).toBeVisible();await expect(page.getByText('ЖК Кленовый парк',{exact:true})).toBeVisible();
 await expect(page.getByText('100%',{exact:true})).toHaveCount(2);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/select-strict-center-${width}.png`,fullPage:true});
 await page.reload();await expect(page.getByRole('button',{name:'Посмотреть проект',exact:true})).toHaveCount(2);
 await page.getByRole('button',{name:/Рассмотреть другие районы/}).click();
 await expect(page.getByRole('button',{name:'Посмотреть проект',exact:true})).toHaveCount(6);
});
test('Unavailable deadline remains required on reload; no automatic alternatives appear',async({page})=>{
 await seed(page,{district:'Центр',delivery:'2035'});await page.goto('/pulsedv/mini-app/#/selection');
 await page.getByRole('button',{name:/Показать подходящие/}).click();
 await expect(page.getByRole('heading',{name:'Точного совпадения пока нет'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Посмотреть проект',exact:true})).toHaveCount(0);
 await page.reload();await expect(page.getByRole('button',{name:'Посмотреть проект',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:/Гибче по сроку сдачи/}).click();
 await expect(page.getByRole('button',{name:'Посмотреть проект',exact:true})).toHaveCount(2);
});
test('Smart query and migrated centre preference use the district; an unavailable budget is not raised',async({page})=>{
 await seed(page,{version:5,preferences:['center']});await page.goto('/pulsedv/mini-app/#/selection');
 await expect(page.getByRole('combobox',{name:'Район',exact:true})).toHaveValue('Центр');
 const input=page.getByRole('textbox',{name:'Опишите квартиру своими словами'});
 await input.fill('Только в центре Уссурийска до 8 млн наличными');await input.press('Enter');
 await page.getByRole('button',{name:/Показать подходящие/}).click();await expect(page.getByRole('button',{name:'Посмотреть проект',exact:true})).toHaveCount(2);
 await page.getByRole('button',{name:'Изменить запрос',exact:true}).click();await input.fill('До 2 млн наличными');await input.press('Enter');
 await page.getByRole('button',{name:/Показать подходящие/}).click();await expect(page.getByRole('button',{name:'Посмотреть проект',exact:true})).toHaveCount(0);
});
test('Home uses distinct-viewer popularity in the chosen city; city changes persist and never fill with another city',async({page})=>{
 await seed(page);await page.goto('/pulsedv/mini-app/');
 const section=page.locator('section').filter({has:page.getByRole('heading',{name:'Стоит посмотреть',exact:true})});
 await expect(section.getByRole('combobox',{name:'Город подборки на главной'})).toHaveValue('Уссурийск');
 const cards=section.locator('article');await expect(cards).toHaveCount(3);await expect(cards.nth(0)).toContainText('ЖК Атриум');await expect(cards.nth(1)).toContainText('ЖК Другой 3');
 await section.getByRole('combobox',{name:'Город подборки на главной'}).selectOption('Владивосток');await expect(cards).toHaveCount(1);await expect(cards.first()).toContainText('ЖК Во Владивостоке');
 await page.reload();await expect(cards).toHaveCount(1);await expect(section.getByRole('combobox',{name:'Город подборки на главной'})).toHaveValue('Владивосток');
 await page.goto('/pulsedv/mini-app/#/selection');await page.getByRole('combobox',{name:'Город',exact:true}).selectOption('Уссурийск');await page.goto('/pulsedv/mini-app/');
 await expect(section.getByRole('combobox',{name:'Город подборки на главной'})).toHaveValue('Уссурийск');
});

test('Without an explicit city, home uses the city of the last viewed project; All cities stays explicit',async({page})=>{
 await seed(page,{started:false});await page.goto('/pulsedv/mini-app/#/property/vlad-popular');await expect(page.getByRole('heading',{name:'ЖК Во Владивостоке',exact:true})).toBeVisible();
 await page.goto('/pulsedv/mini-app/');const picker=page.getByRole('combobox',{name:'Город подборки на главной'});await expect(picker).toHaveValue('Владивосток');
 await picker.selectOption('');await page.goto('/pulsedv/mini-app/#/property/uss-0');await expect(page.getByRole('heading',{name:'ЖК Атриум',exact:true})).toBeVisible();await page.goto('/pulsedv/mini-app/');await expect(picker).toHaveValue('');
});
