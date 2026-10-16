import {test,expect} from '@playwright/test';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';

for(const width of [320,390,430])test(`Outlined card icons remain consistent across screens at ${width}px`,async({page,browserName})=>{
 test.setTimeout(90000);
 await page.setViewportSize({width,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(state=>{
  localStorage.setItem('pulse.dv.control.state.v1',JSON.stringify(state));
  localStorage.setItem('pulse_onboarding_version',state.content.onboardingVersion);
  localStorage.setItem('pulse_mortgage_intro_version','mortgage_intro_v5');
  localStorage.setItem('pulse_selection_current_v2',JSON.stringify({version:4,started:true,city:'Владивосток'}));
 },DEFAULT_STATE);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const route of ['','profile','selection','catalog','favorites','my-search','journey','privacy','personal-data-consent','partner-offer','property/'+DEFAULT_STATE.properties[0].id]){
  await page.goto('/pulsedv/mini-app/#/'+route);await expect(page.locator('[data-icon-tile]').first()).toBeVisible();
  const sizes=await page.locator('[data-icon-tile]').evaluateAll(tiles=>tiles.filter(el=>el.getBoundingClientRect().width>0).map(el=>{
   const css=getComputedStyle(el),svg=el.querySelector('svg'),glyph=svg?getComputedStyle(svg):null;
   return {width:css.width,height:css.height,radius:css.borderRadius,border:css.borderTopWidth,stroke:glyph?.strokeWidth,glyphWidth:glyph?.width,glyphHeight:glyph?.height};
  }));
  for(const actual of sizes)expect(actual,route).toEqual({width:'36px',height:'36px',radius:'12px',border:'1px',stroke:'1.8px',glyphWidth:'20px',glyphHeight:'20px'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route).toBe(true);
  if(['','profile','selection'].includes(route))await page.screenshot({path:`test-results/icon-system-${route||'home'}-${browserName}-${width}.png`,fullPage:true,animations:'disabled'});
 }
 // The same geometry survives the theme switch, and a saved heart keeps its contour.
 await page.goto('/pulsedv/mini-app/#/profile');await page.evaluate(()=>document.documentElement.classList.add('dark'));
 const tile=page.locator('[data-icon-tile]').first();await expect(tile).toHaveCSS('width','36px');await expect(tile).toHaveCSS('border-top-width','1px');
 await page.goto('/pulsedv/mini-app/');const favorite=page.getByRole('button',{name:'В избранное',exact:true}).first();await favorite.click();await expect(page.getByRole('button',{name:'Убрать из избранного',exact:true}).first().locator('svg')).toHaveAttribute('fill','none');
 expect(errors).toEqual([]);
});
