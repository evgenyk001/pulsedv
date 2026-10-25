import {test,expect,type Page} from '@playwright/test';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';
const projects=DEFAULT_STATE.properties;
async function seed(page:Page,count=3,legacy:string[]=[]){
 await page.route('https://telegram.org/js/telegram-web-app.js',route=>route.fulfill({body:''}));
 await page.addInitScript(({state,count,legacy})=>{
  localStorage.setItem('pulse.dv.control.state.v1',JSON.stringify(state));localStorage.setItem('pulse_onboarding_version',state.content.onboardingVersion);
  localStorage.setItem('pulse_mortgage_intro_version','mortgage_intro_v5');localStorage.setItem('pulse.dv.favorites.v1',JSON.stringify(state.properties.slice(0,count).map(p=>p.id)));localStorage.setItem('pulse.compare.v1',JSON.stringify(legacy));
 },{state:DEFAULT_STATE,count,legacy});
}
const noOverflow=async(page:Page)=>expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
for(const width of [320,390,430])test(`Comparison ${width}px: explicit two slots, replacement and detail return`,async({page})=>{
 test.setTimeout(60000);await page.setViewportSize({width,height:844});await seed(page);await page.goto('/pulsedv/mini-app/#/favorites');
 await page.getByRole('link',{name:/Сравнить ЖК/}).click();await expect(page.getByRole('heading',{name:'Какие ЖК сравним?'})).toBeVisible();
 await page.getByRole('button',{name:'Выбрать первый ЖК',exact:true}).click();
 await page.getByRole('button',{name:'Выбрать '+projects[0].name,exact:true}).click();await expect(page.locator('[role="dialog"]')).toHaveCount(0);
 await page.getByRole('button',{name:'Выбрать второй ЖК',exact:true}).click();
 await expect(page.getByRole('button',{name:'Выбрать '+projects[0].name,exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Выбрать '+projects[1].name,exact:true}).click();await expect(page.locator('[role="dialog"]')).toHaveCount(0);
 const comparison=page.getByRole('region',{name:'Сравнение ЖК'});await expect(comparison).toBeVisible();
 const headers=comparison.locator('article');await expect(headers).toHaveCount(2);
 const first=(await headers.nth(0).boundingBox())!,second=(await headers.nth(1).boundingBox())!;expect(first.x+first.width).toBeLessThanOrEqual(second.x);await noOverflow(page);
 await page.getByRole('button',{name:'Заменить '+projects[0].name,exact:true}).click();
 await expect(page.getByRole('button',{name:'Выбрать '+projects[1].name,exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Выбрать '+projects[2].name,exact:true}).click();await expect(page.locator('[role="dialog"]')).toHaveCount(0);
 await expect(headers.nth(0)).toContainText(projects[2].name);await expect(headers).toHaveCount(2);
 await page.getByRole('checkbox',{name:'Только различия',exact:true}).check();await page.getByRole('textbox',{name:'Взнос, %',exact:true}).fill('40');
 const compareUrl=page.url();await page.getByRole('link',{name:'Открыть '+projects[2].name,exact:true}).click();await expect(page.getByRole('heading',{name:projects[2].name,exact:true})).toBeVisible();
 await page.getByRole('link',{name:'Назад',exact:true}).click();await expect(page).toHaveURL(compareUrl);
 await expect(page.getByRole('checkbox',{name:'Только различия',exact:true})).toBeChecked();await expect(page.getByRole('textbox',{name:'Взнос, %',exact:true})).toHaveValue('40');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('pulse.compare.v1')!).length)).toBe(2);await noOverflow(page);
 await page.screenshot({path:`test-results/comparison-two-${width}.png`,fullPage:true});
});
test('Two saved projects open directly; old three-item selection becomes two',async({page})=>{
 await seed(page,2,projects.slice(0,3).map(p=>p.id));await page.goto('/pulsedv/mini-app/#/favorites');await page.getByRole('link',{name:/Сравнить ЖК/}).click();
 await expect(page.getByRole('region',{name:'Сравнение ЖК'}).locator('article')).toHaveCount(2);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('pulse.compare.v1')!))).toEqual(projects.slice(0,2).map(p=>p.id));
});
test('One saved project explains how to complete a pair',async({page})=>{
 await seed(page,1);await page.goto('/pulsedv/mini-app/#/compare');await expect(page.getByText('Нужен ещё один ЖК.',{exact:false})).toBeVisible();
 await expect(page.getByRole('link',{name:'Выбрать ЖК в каталоге',exact:true})).toBeVisible();await expect(page.getByRole('region',{name:'Сравнение ЖК'})).toHaveCount(0);
});
test('Catalog → property → map → back restores property position and catalog query',async({page})=>{
 test.setTimeout(60000);await seed(page);await page.route('**/api-maps.yandex.ru/**',route=>route.abort());await page.goto('/pulsedv/mini-app/#/catalog?sort=priceAsc');
 await page.getByRole('textbox',{name:'Поиск',exact:true}).fill('Приморский');
 const catalogUrl=page.url();await page.getByRole('link',{name:'Открыть ЖК Приморский',exact:true}).click();
 const map=page.getByRole('link',{name:/Посмотреть ЖК на карте/});await map.scrollIntoViewIfNeeded();const position=await page.evaluate(()=>window.scrollY);expect(position).toBeGreaterThan(200);
 await map.click();await expect(page).toHaveURL(/view=map/);await page.getByRole('link',{name:'Назад к предыдущему экрану',exact:true}).click();
 await expect(page.getByRole('heading',{name:'ЖК Приморский',exact:true})).toBeVisible();await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(position-30);
 await page.getByRole('link',{name:'Назад',exact:true}).click();await expect(page).toHaveURL(catalogUrl);await expect(page.getByRole('textbox',{name:'Поиск',exact:true})).toHaveValue('Приморский');
});
test('Direct property link uses safe fallback; mortgage return does not create a loop',async({page})=>{
 test.setTimeout(60000);await seed(page);await page.goto('/pulsedv/mini-app/#/property/primorskiy');
 await page.getByRole('link',{name:'Назад',exact:true}).click();await expect(page).toHaveURL(/#\/catalog$/);
 await page.getByRole('link',{name:'Открыть ЖК Приморский',exact:true}).click();
 await page.getByRole('link',{name:/Рассчитать ипотеку/}).first().click();
 await page.getByRole('button',{name:'Вернуться к ЖК',exact:true}).click();await expect(page).toHaveURL(/#\/property\/primorskiy$/);
 await page.getByRole('link',{name:'Назад',exact:true}).click();await expect(page).toHaveURL(/#\/catalog$/);
});
for(const reducedMotion of ['no-preference','reduce'] as const)test(`Launch mark is painted before the bundle and disappears when ready (${reducedMotion})`,async({page,browserName})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion});await seed(page);
 let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);
 await page.route('**/assets/index-*.js',async route=>{await gate;await route.continue()});
 const launch=page.locator('#pulse-launch');
 try{
  await page.goto('/pulsedv/mini-app/',{waitUntil:'commit'});await expect(launch).toBeVisible();
  await expect(launch.locator('svg')).toBeVisible();
  expect(await launch.evaluate(el=>{const r=el.getBoundingClientRect();return r.width>=innerWidth&&r.height>=innerHeight})).toBe(true);
  const animation=await launch.locator('svg').evaluate(el=>getComputedStyle(el).animationName);expect(animation==='none').toBe(reducedMotion==='reduce');
  // WebKit waits for document.fonts.ready during screenshots, which waits for
  // the deliberately held module. DOM and animation assertions run in both.
  if(browserName!=='webkit')await page.screenshot({path:`test-results/pulsedv-launch-${browserName}-${reducedMotion}.png`});
 }finally{release()}
 await expect(page.getByRole('heading',{name:'Стоит посмотреть',exact:true})).toBeVisible();await expect(launch).toHaveCount(0);
});
test('Failed bundle keeps branded screen and offers a working reload',async({page})=>{
 await seed(page);await page.route('**/assets/index-*.js',route=>route.abort());await page.goto('/pulsedv/mini-app/',{waitUntil:'commit'});
 await expect(page.getByRole('button',{name:'Повторить загрузку',exact:true})).toBeVisible({timeout:20000});
 await page.unroute('**/assets/index-*.js');await page.getByRole('button',{name:'Повторить загрузку',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Стоит посмотреть',exact:true})).toBeVisible();await expect(page.locator('#pulse-launch')).toHaveCount(0);
});

test('Comparison numeric drafts clear fully, accept decimal commas and commit limits on blur',async({page})=>{
 await seed(page,2);await page.goto('/pulsedv/mini-app/#/compare');
 await expect(page.getByRole('region',{name:'Сравнение ЖК'})).toBeVisible();
 for(const label of ['Взнос, %','Ставка, %','Срок, лет']){
  const field=page.getByRole('textbox',{name:label,exact:true});
  await field.fill('');await expect(field).toHaveValue('');
  await field.pressSequentially('2');await expect(field).toHaveValue('2');
  await field.fill('');await field.blur();await expect(field).toHaveValue('2');
 }
 const rate=page.getByRole('textbox',{name:'Ставка, %',exact:true});
 await rate.fill('0');await rate.blur();await expect(rate).toHaveValue('0');
 await rate.fill('');await rate.pressSequentially('2,5');await expect(rate).toHaveValue('2,5');
 await expect(page.getByText(/Расчёт ориентировочный:/)).toContainText('ставка 2.5%');
 await rate.fill('2.75');await rate.blur();await expect(rate).toHaveValue('2,75');
 await rate.fill('75');await expect(rate).toHaveValue('75');await rate.blur();await expect(rate).toHaveValue('50');
 const term=page.getByRole('textbox',{name:'Срок, лет',exact:true});
 await term.fill('0');await expect(term).toHaveValue('0');await term.blur();await expect(term).toHaveValue('1');
 await term.fill('40');await term.press('Enter');await expect(term).toHaveValue('30');
 await rate.fill('');await rate.pressSequentially('2');await rate.blur();await expect(rate).toHaveValue('2');
 await page.reload();await expect(page.getByRole('textbox',{name:'Ставка, %',exact:true})).toHaveValue('2');
 await expect(page.getByRole('textbox',{name:'Срок, лет',exact:true})).toHaveValue('30');
});
