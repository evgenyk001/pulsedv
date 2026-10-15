import {test,expect} from '@playwright/test';

for(const width of [320,390,430])test(`Home collapse ${width}px: continuous native scroll and reversible controls`,async({page,browserName})=>{
  test.setTimeout(45000);
  await page.setViewportSize({width,height:740});
  await page.emulateMedia({reducedMotion:'no-preference'});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/pulsedv/mini-app/');
  const skip=page.getByRole('button',{name:'Пропустить онбординг'});
  if(await skip.count())await skip.click();
  const header=page.getByRole('banner',{name:'PULSE.DV'});
  const actions=page.getByRole('region',{name:'Быстрые действия'});
  const banner=page.locator('[class*="collapseBlock"]').nth(1).locator(':scope > div');
  await expect(actions.getByRole('link')).toHaveCount(4);
  await expect(banner).toBeVisible();
  await expect(page.getByRole('tab',{name:'Баннер 2 из 4',exact:true})).toBeEnabled();
  await page.getByRole('tab',{name:'Баннер 2 из 4',exact:true}).click();
  await expect(page.getByRole('tab',{name:'Баннер 2 из 4',exact:true})).toHaveAttribute('aria-selected','true');
  await expect.poll(()=>page.getByRole('heading',{name:'Квартира, которую хочется показывать друзьям'}).evaluate(el=>{
    const article=el.closest('article')!,wrap=article.closest('[role=group]')!.parentElement!.parentElement!;
    return Math.abs(article.getBoundingClientRect().left-wrap.getBoundingClientRect().left);
  })).toBeLessThan(1.1);
  const initial=await page.evaluate(()=>({height:document.documentElement.scrollHeight,y:scrollY}));
  expect(initial.y).toBe(0);
  const headerTop=(await header.boundingBox())!.y;
  const bannerTop=(await banner.boundingBox())!.y;
  const bannerHeight=(await banner.boundingBox())!.height;
  const middle=bannerTop-headerTop-52+bannerHeight*.45;
  await page.evaluate(y=>window.scrollTo(0,y),middle);
  await expect.poll(()=>banner.evaluate(el=>Number(getComputedStyle(el).opacity))).toBeLessThan(.8);
  const halfway=await banner.evaluate(el=>({opacity:Number(getComputedStyle(el).opacity),width:el.getBoundingClientRect().width}));
  expect(halfway.opacity).toBeGreaterThan(.2);
  expect(halfway.width).toBeLessThan(width-28);
  expect(Math.abs((await header.boundingBox())!.y-headerTop)).toBeLessThan(1);
  expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBe(initial.height);
  if(width===390)await page.screenshot({path:`test-results/home-collapse-${browserName}-middle.png`});

  const end=await actions.evaluate(el=>el.parentElement!.getBoundingClientRect().bottom+scrollY-60);
  await page.evaluate(y=>window.scrollTo(0,y),end);
  await expect.poll(()=>actions.evaluate(el=>el.parentElement!.inert)).toBe(true);
  const finalY=await page.evaluate(()=>scrollY);
  expect(finalY).toBeGreaterThan(middle+100);
  await page.waitForTimeout(180);
  expect(await page.evaluate(()=>scrollY)).toBe(finalY);
  expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBe(initial.height);
  expect(Math.abs((await header.boundingBox())!.y-headerTop)).toBeLessThan(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  if(width===390)await page.screenshot({path:`test-results/home-collapse-${browserName}-closed.png`});
  // Pinned controls remain usable, and closing their sheet preserves the scroll position.
  await header.getByRole('button',{name:/Уведомления/}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'Закрыть уведомления',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBeCloseTo(finalY,0);

  await page.setViewportSize({width:width+10,height:760});
  await page.evaluate(()=>window.scrollTo(0,0));
  await expect.poll(()=>banner.evaluate(el=>Number(getComputedStyle(el).opacity))).toBe(1);
  await expect.poll(()=>actions.evaluate(el=>el.parentElement!.inert)).toBe(false);
  await expect.poll(()=>page.locator('[data-home-collapse]').evaluateAll(blocks=>blocks.map(block=>{
    const child=block.firstElementChild as HTMLElement|null;
    if(!child)return {opacity:1,widthDelta:0};
    return {opacity:Number(getComputedStyle(child).opacity),widthDelta:Math.round(Math.abs(child.getBoundingClientRect().width-block.getBoundingClientRect().width))};
  }))).toEqual([{opacity:1,widthDelta:0},{opacity:1,widthDelta:0},{opacity:1,widthDelta:0}]);
  if(width===390)await page.screenshot({path:`test-results/home-collapse-${browserName}-open.png`});
  await actions.getByRole('link',{name:/Ипотека/}).click();
  await expect(page).toHaveURL(/#\/mortgage/);
  await page.goBack();
  await expect(header).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
  await expect(actions.getByRole('link',{name:/Ипотека/})).toBeVisible();
  expect(errors).toEqual([]);
});

test('Home collapse: reduced motion keeps native scrolling without scaling',async({page})=>{
  await page.setViewportSize({width:390,height:740});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/pulsedv/mini-app/');
  const skip=page.getByRole('button',{name:'Пропустить онбординг'});if(await skip.count())await skip.click();
  const header=page.getByRole('banner',{name:'PULSE.DV'});
  const actions=page.getByRole('region',{name:'Быстрые действия'});
  await page.evaluate(()=>scrollTo(0,200));
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(200);
  expect(await actions.evaluate(el=>getComputedStyle(el).transform)).toBe('none');
  expect(await actions.evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
  expect((await header.boundingBox())!.y).toBe(10);
  await page.evaluate(()=>scrollTo(0,0));
  await expect(actions.getByRole('link',{name:/Ипотека/})).toBeVisible();
});
