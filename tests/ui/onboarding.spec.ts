import {test,expect} from '@playwright/test';

for(const [width,height] of [[320,568],[390,700],[390,844],[430,932]])test(`Onboarding controls stay aligned at ${width}x${height}`,async({page})=>{
 await page.setViewportSize({width,height});
 await page.goto('/pulsedv/mini-app/');
 const intro=page.getByRole('region',{name:'Онбординг PULSEDV'});
 await expect(intro).toBeVisible();
 const image=intro.locator('img');
 await expect.poll(()=>image.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
 const skip=intro.getByRole('button',{name:'Пропустить онбординг'});
 const next=intro.getByRole('button',{name:'Продолжить',exact:true});
 const skipBox=await skip.boundingBox(),nextBox=await next.boundingBox();
 await expect(intro.getByRole('button',{name:'Экран 1',exact:true})).toHaveAttribute('aria-current','step');
 await page.screenshot({path:`test-results/onboarding-${width}-${height}-1.png`});
 await next.click();
 const start=intro.getByRole('button',{name:'Начать',exact:true});
 await expect(start).toBeVisible();
 await expect.poll(()=>image.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
 const pill=intro.getByRole('group',{name:'Страницы онбординга'}).locator(':scope > span');
 await expect(pill).toHaveCSS('transform','matrix(1, 0, 0, 1, 32, 0)');
 const pillBox=await pill.boundingBox();expect(pillBox!.width).toBeGreaterThan(pillBox!.height*3);
 await page.screenshot({path:`test-results/onboarding-${width}-${height}-2.png`});
 expect(await start.boundingBox()).toEqual(nextBox);
 expect(await skip.boundingBox()).toEqual(skipBox);
 await expect(intro.getByRole('button',{name:'Экран 2',exact:true})).toHaveAttribute('aria-current','step');
 await expect(intro.getByRole('button',{name:'Экран 1',exact:true})).not.toHaveAttribute('aria-current');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 for(const box of [skipBox,nextBox]){
  expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x+box!.width).toBeLessThanOrEqual(width+1);expect(box!.y+box!.height).toBeLessThanOrEqual(height+1);
 }
 await intro.getByRole('button',{name:'Экран 1',exact:true}).click();
 await expect(next).toBeVisible();
 await expect(intro.getByRole('button',{name:'Экран 1',exact:true})).toHaveAttribute('aria-current','step');
 await next.click();await start.click();await expect(intro).toHaveCount(0);
 await page.reload();await expect(intro).toHaveCount(0);
});

test('Onboarding keeps controls inside Telegram safe areas and supports swiping',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/pulsedv/mini-app/');
 const intro=page.getByRole('region',{name:'Онбординг PULSEDV'});
 await expect(intro).toBeVisible();
 await page.evaluate(()=>{const css=document.documentElement.style;css.setProperty('--tg-safe-area-inset-top','47px');css.setProperty('--tg-content-safe-area-inset-top','56px');css.setProperty('--tg-safe-area-inset-bottom','34px')});
 const skip=await intro.getByRole('button',{name:'Пропустить онбординг'}).boundingBox();
 expect(skip!.y).toBeGreaterThanOrEqual(103);
 const first=intro.getByRole('button',{name:'Экран 1',exact:true});
 await intro.dispatchEvent('touchstart',{touches:[{identifier:0,clientX:300,clientY:200}]});
 await intro.dispatchEvent('touchend',{changedTouches:[{identifier:0,clientX:100,clientY:200}]});
 await expect(intro.getByRole('button',{name:'Начать',exact:true})).toBeVisible();
 await intro.dispatchEvent('touchstart',{touches:[{identifier:0,clientX:100,clientY:200}]});
 await intro.dispatchEvent('touchend',{changedTouches:[{identifier:0,clientX:300,clientY:200}]});
 await expect(first).toHaveAttribute('aria-current','step');
 await intro.getByRole('button',{name:'Пропустить онбординг'}).click();await expect(intro).toHaveCount(0);
});
