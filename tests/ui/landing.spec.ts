import {test,expect} from '@playwright/test';

// The landing page must fit the actual viewport, including short laptop screens.
for(const [width,height] of [[320,568],[390,664],[430,740],[768,1024],[1024,600],[1366,650],[1440,900]]){
 test(`Landing fits one screen at ${width}x${height}`,async({page,browserName})=>{
  await page.setViewportSize({width,height});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/pulsedv/');await page.evaluate(()=>document.fonts.ready);
  await expect(page.locator('.headline-accent')).toHaveText('в одном приложении');
  await expect(page.getByRole('link',{name:'Открыть PULSE',exact:true})).toHaveAttribute('href','https://t.me/pulsedvbot');
  await expect(page.getByRole('link',{name:'PULSE в Instagram',exact:true})).toHaveAttribute('href',/^https:\/\/www\.instagram\.com\/pulse\.dv\?/);
  await expect(page.locator('.brand-logo')).toHaveJSProperty('complete',true);
  await expect(page.locator('.phones-image')).toHaveJSProperty('naturalWidth',1254);
  await expect.poll(()=>page.evaluate(()=>{
   const root=document.documentElement;
   const selectors=['.header','.hero-copy','.hero-actions','.benefits','.hero-visual','.footer'];
   return root.scrollWidth<=innerWidth+1&&root.scrollHeight<=innerHeight+1&&selectors.every(s=>{
    const r=document.querySelector(s)!.getBoundingClientRect();
    return r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1;
   });
  })).toBe(true);
  const copy=await page.locator('.hero-copy').boundingBox();const art=await page.locator('.hero-visual').boundingBox();
  if(width<960)expect(art!.y).toBeGreaterThanOrEqual(copy!.y+copy!.height);
  else expect(art!.x).toBeGreaterThanOrEqual(copy!.x+copy!.width);
  expect(errors).toEqual([]);
  await page.waitForTimeout(1500);
  await page.screenshot({path:`test-results/landing-${browserName}-${width}x${height}.png`,fullPage:true});
 });
}

test('Landing stays readable without JavaScript and reduced motion stops the highlight',async({browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false,reducedMotion:'reduce',viewport:{width:390,height:664}});
 const page=await context.newPage();await page.goto('/pulsedv/');
 await expect(page.getByRole('heading',{level:1})).toBeVisible();
 await expect(page.getByRole('link',{name:'Открыть PULSE',exact:true})).toBeVisible();
 await expect(page.locator('.headline-accent')).toHaveCSS('color','rgb(255, 255, 255)');
 expect(await page.locator('.headline-accent').evaluate(e=>getComputedStyle(e,'::before').animationName)).toBe('none');
 await page.screenshot({path:'test-results/landing-reduced-motion.png',fullPage:true});
 await context.close();
});
