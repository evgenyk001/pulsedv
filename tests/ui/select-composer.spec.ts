import {test,expect} from '@playwright/test';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';

for(const width of [320,390,430])test(`Select composer ${width}px: request, live result and scenario comparison`,async({page,browserName})=>{
 await page.setViewportSize({width,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(state=>{
  localStorage.setItem('pulse.dv.control.state.v1',JSON.stringify(state));
  localStorage.setItem('pulse_onboarding_version',state.content.onboardingVersion);
  localStorage.setItem('pulse_selection_current_v2',JSON.stringify({version:4,started:true,city:'Владивосток',rooms:'1',monthlyPayment:290000,downPayment:1500000}));
 },DEFAULT_STATE);
 await page.goto('/pulsedv/mini-app/#/selection');
 const composer=page.getByRole('region',{name:'Ваш подбор',exact:true});
 await expect(composer).toContainText('Можно своими словами');await expect(composer).toContainText('ВАШ ЗАПРОС');
 await expect(page.getByText('SMART INPUT',{exact:true})).toHaveCount(0);
 await composer.screenshot({path:`test-results/select-composer-idle-${browserName}-${width}.png`,animations:'disabled'});
 const input=composer.getByRole('textbox',{name:'Опишите квартиру своими словами'});
 await input.fill('Однушка во Владивостоке, до 290 тыс./мес');await input.press('Enter');
 await expect(composer).toContainText('PULSE понял');
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await composer.screenshot({path:`test-results/select-composer-${browserName}-${width}.png`,animations:'disabled'});
 // Keep the full screen as context for typography and spacing against the existing controls.
 await page.screenshot({path:`test-results/select-composer-screen-${browserName}-${width}.png`,fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:/Показать подходящие/}).click();
 const scenarios=page.locator('section').filter({has:page.getByText('Другие сценарии покупки',{exact:true})});
 await expect(scenarios).toBeVisible();
 await expect(scenarios.getByText('+0 вариантов',{exact:true})).toHaveCount(0);
 await expect(scenarios.getByText('Без новых вариантов',{exact:true}).first()).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await scenarios.screenshot({path:`test-results/select-composer-scenarios-${browserName}-${width}.png`,animations:'disabled'});
 await scenarios.getByRole('button',{name:/10 тыс/}).click();
 await page.getByRole('button',{name:'Изменить запрос',exact:true}).click();
 await page.getByRole('button',{name:/Как покупаем/}).click();
 await expect(page.getByRole('textbox',{name:'Комфортный платёж',exact:true})).toHaveValue(new Intl.NumberFormat('ru-RU').format(300000));
});
