import {test,expect} from '@playwright/test';

test('Landing preserves the campaign, server redirect and cross-device QR; reload does not add a visit',async({page})=>{
 const visits:any[]=[];
 await page.route('**/api/v1/public/traffic',async route=>{
  const body=route.request().postDataJSON();visits.push(body);
  await route.fulfill({json:{id:body.id,url:'https://t.me/pulsedvbot?startapp=acq_'+body.id.replaceAll('-',''),go:'/api/v1/public/traffic/'+body.id+'/go',qr:'/api/v1/public/traffic/'+body.id+'/qr'}});
 });
 await page.route('**/api/v1/public/traffic/*/qr',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="182" height="182"><rect width="182" height="182" fill="white"/></svg>'}));
 await page.goto('/pulsedv/?utm_source=vk&utm_campaign=autumn&utm_content=ad1');
 const cta=page.getByRole('link',{name:'Открыть PULSE',exact:true});
 await expect(cta).toHaveAttribute('href',/\/api\/v1\/public\/traffic\/[a-f0-9-]+\/go\?placement=primary$/);
 await expect(page.getByRole('link',{name:'PULSE в Telegram'})).toHaveAttribute('href',/placement=social$/);
 await expect(page.locator('.qr-link img')).toHaveAttribute('src',/\/api\/v1\/public\/traffic\/.*\/qr$/);
 expect(visits[0].search).toContain('utm_content=ad1');
 await page.reload();await expect(cta).toHaveAttribute('href',/placement=primary$/);expect(visits[1].id).toBe(visits[0].id);
 await page.goto('/pulsedv/?utm_source=instagram&utm_campaign=return');await expect(cta).toHaveAttribute('href',/placement=primary$/);expect(visits[2].id).not.toBe(visits[0].id);
 await page.goto('/pulsedv/',{referer:'https://yandex.ru/'});await expect(cta).toHaveAttribute('href',/placement=primary$/);expect(visits[3].id).not.toBe(visits[2].id);
 await page.goto('/pulsedv/',{referer:'https://vk.com/'});await expect(cta).toHaveAttribute('href',/placement=primary$/);expect(visits[4].id).not.toBe(visits[3].id);
});

test('Analytics failure preserves native Telegram links and does not break the landing',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/v1/**',route=>route.abort());
 await page.goto('/pulsedv/');await expect(page.getByRole('link',{name:'Открыть PULSE',exact:true})).toHaveAttribute('href','https://t.me/pulsedvbot');
 await expect(page.getByRole('heading',{level:1})).toBeVisible();expect(errors).toEqual([]);
});

for(const width of [320,390,1366])test(`Control source links and honest preview at ${width}px`,async({page,browserName})=>{
 await page.setViewportSize({width,height:844});
 await page.goto('/pulsedv/control-center/#/analytics');
 const panel=page.locator('section').filter({has:page.getByRole('heading',{name:'Откуда приходят клиенты',exact:true})});
 await expect(panel.getByText('В превью сбор общей статистики выключен.',{exact:false})).toBeVisible();
 await panel.getByText('Создать ссылку для рекламы или публикации',{exact:true}).click();
 await panel.getByLabel('Источник',{exact:true}).fill('vk');await panel.getByLabel('Тип перехода',{exact:true}).fill('cpc');
 await panel.getByLabel('Название кампании',{exact:true}).fill('autumn 2026');await panel.getByLabel('Публикация / объявление',{exact:true}).fill('ad1');
 const value=await panel.getByLabel('Ссылка с метками',{exact:true}).inputValue(),url=new URL(value);
 expect(url.origin).toBe('https://pulsedv.ru');expect(url.searchParams.get('utm_source')).toBe('vk');expect(url.searchParams.get('utm_campaign')).toBe('autumn 2026');expect(url.searchParams.get('utm_content')).toBe('ad1');
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await panel.screenshot({path:`test-results/acquisition-${browserName}-${width}.png`});
});
