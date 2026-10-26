import {test,expect} from '@playwright/test';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';
test.beforeEach(async({page})=>{
 await page.addInitScript(state=>{localStorage.setItem('pulse_onboarding_version',state.content.onboardingVersion);localStorage.setItem('pulse.dv.control.state.v1',JSON.stringify(state))},DEFAULT_STATE);
 await page.route('https://telegram.org/js/telegram-web-app.js**',r=>r.fulfill({contentType:'text/javascript',body:`window.Telegram={WebApp:{initData:'test',ready(){},expand(){},BackButton:{show(){window.nativeVisible=true},hide(){window.nativeVisible=false},onClick(fn){window.nativeClick=fn},offClick(){window.nativeClick=null}}}};`}));
});
test('Telegram owns back, direct links keep a safe fallback and dialog closes first',async({page})=>{
 await page.goto('/pulsedv/mini-app/#/my-search');
 await expect(page.locator('html')).toHaveAttribute('data-native-back','true');
 await expect(page.locator('[data-back-link]')).toBeHidden();
 await expect.poll(()=>page.evaluate(()=>(window as any).nativeVisible)).toBe(true);
 await page.evaluate(()=>{const d=document.createElement('dialog');d.textContent='test overlay';document.body.append(d);d.showModal()});
 await page.evaluate(()=>(window as any).nativeClick());
 await expect(page.locator('dialog[open]')).toHaveCount(0);await expect(page).toHaveURL(/my-search/);
 await page.evaluate(()=>(window as any).nativeClick());await expect(page).toHaveURL(/profile/);
});
test('Browser keeps the visible back control',async({page})=>{
 await page.unroute('https://telegram.org/js/telegram-web-app.js**');
 await page.route('https://telegram.org/js/telegram-web-app.js**',r=>r.fulfill({body:''}));
 await page.goto('/pulsedv/mini-app/#/my-search');await expect(page.locator('[data-back-link]')).toBeVisible();
});
