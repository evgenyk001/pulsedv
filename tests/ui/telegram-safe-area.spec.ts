import {test,expect} from '@playwright/test';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';

for(const width of [320,390])test(`Telegram safe areas update page, navigation and sheets at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});
 await page.addInitScript(state=>{
  localStorage.setItem('pulse_onboarding_version',state.content.onboardingVersion);
  localStorage.setItem('pulse.dv.control.state.v1',JSON.stringify(state));
 },DEFAULT_STATE);
 await page.goto('/pulsedv/mini-app/#/profile');
 const main=page.locator('main');
 const baseline=await main.evaluate(el=>parseFloat(getComputedStyle(el).paddingTop));
 // Telegram SDK owns these CSS variables and updates them after fullscreen/rotation.
 await page.evaluate(()=>{
  const css=document.documentElement.style;
  css.setProperty('--tg-safe-area-inset-top','47px');
  css.setProperty('--tg-content-safe-area-inset-top','56px');
  css.setProperty('--tg-safe-area-inset-bottom','34px');
 });
 await expect.poll(()=>main.evaluate(el=>parseFloat(getComputedStyle(el).paddingTop))).toBe(baseline+103);
 const nav=page.getByRole('navigation');
 const navBox=await nav.boundingBox();expect(navBox).not.toBeNull();expect(navBox!.y+navBox!.height).toBeLessThanOrEqual(810);
 await page.getByRole('button',{name:'Связаться с PULSE.DV',exact:true}).click();
 const sheet=page.getByRole('dialog');await expect(sheet).toBeVisible();
 await expect.poll(async()=>{const box=await sheet.boundingBox();return !!box&&box.y>=103&&box.y+box.height<=810.5}).toBe(true);
 await sheet.getByRole('button',{name:'Закрыть заявку',exact:true}).click();
 await page.evaluate(()=>{
  const css=document.documentElement.style;
  css.setProperty('--tg-safe-area-inset-top','0px');
  css.setProperty('--tg-content-safe-area-inset-top','0px');
 });
 await expect.poll(()=>main.evaluate(el=>parseFloat(getComputedStyle(el).paddingTop))).toBe(baseline);
});
