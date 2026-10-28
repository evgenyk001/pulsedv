import {test,expect,type Page} from '@playwright/test';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';
async function seed(page:Page){
 const state=structuredClone(DEFAULT_STATE);
 const p=state.properties[0];p.priceFrom=6.05706;p.className='Бизнес';p.projectDetails={commissioningDate:null,totalApartments:null,availableApartments:null};
 await page.route('https://telegram.org/js/telegram-web-app.js',route=>route.fulfill({body:''}));
 await page.addInitScript(state=>{
  if(!localStorage.getItem('pulse.dv.control.state.v1'))localStorage.setItem('pulse.dv.control.state.v1',JSON.stringify(state));
  localStorage.setItem('pulse_onboarding_version',state.content.onboardingVersion);
  if(!localStorage.getItem('pulse_selection_current_v2'))localStorage.setItem('pulse_selection_current_v2',JSON.stringify({version:5,started:true,city:'Владивосток',rooms:'Все',purchaseMode:'cash',budget:[0,30000000]}));
 },state);
}
test('Control calculates in both directions, saves reference area and displays the paired unit price',async({page})=>{
 await seed(page);await page.goto('/pulsedv/control-center/#/objects');
 await page.locator('.catalogObjectCard').filter({hasText:'ЖК Приморский'}).click();
 const editor=page.getByRole('dialog',{name:'Редактор объекта'});
 await editor.getByLabel('Площадь квартиры по стартовой цене',{exact:true}).fill('38.6');
 await editor.getByLabel('Стартовая цена за квадратный метр',{exact:true}).fill('185000');
 await expect(editor.getByLabel('Стартовая стоимость квартиры',{exact:true})).toHaveValue('7141000');
 await editor.getByLabel('Стартовая стоимость квартиры',{exact:true}).fill('6057060');
 await editor.getByLabel('Площадь квартиры по стартовой цене',{exact:true}).fill('40');
 await expect(editor.getByLabel('Стартовая цена за квадратный метр',{exact:true})).toHaveValue('151426.5');
 await editor.getByRole('button',{name:'Добавить',exact:true}).first().click();
 const plan=editor.locator('.floorplanEditor').last();
 await plan.getByLabel('Площадь, м²',{exact:true}).fill('38.6');
 const unit=plan.getByLabel('Цена планировки за квадратный метр',{exact:true});
 await unit.fill('');await unit.pressSequentially('185000');
 await expect(unit).toHaveValue('185000');await unit.blur();
 await expect(plan.getByLabel('Цена, ₽',{exact:true})).toHaveValue('7141000');
 await plan.getByLabel('Цена, ₽',{exact:true}).fill('7720000');
 await expect(unit).toHaveValue('200000');
 await editor.getByRole('button',{name:'Готово',exact:true}).click();
 await page.goto('/pulsedv/mini-app/#/property/primorskiy');
 await expect(page.locator('body')).toContainText(/151\s*426[,.]5?\s*₽\/м²|151\s*427\s*₽\/м²/);
});
for(const width of [320,390])test(`Select ${width}px: class, area and finish persist without overflow`,async({page})=>{
 await page.setViewportSize({width,height:844});await seed(page);await page.goto('/pulsedv/mini-app/#/selection');
 await page.getByRole('button',{name:'Бизнес',exact:true}).click();
 await page.getByRole('textbox',{name:'Площадь от',exact:true}).or(page.getByRole('spinbutton',{name:'Площадь от',exact:true})).fill('30');
 await page.getByRole('spinbutton',{name:'Площадь до',exact:true}).fill('80');
 await page.getByRole('combobox',{name:'Отделка',exact:true}).selectOption('rough');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/select-filters-${width}.png`,fullPage:true});
 await page.reload();await expect(page.getByRole('button',{name:'Бизнес',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('spinbutton',{name:'Площадь от',exact:true})).toHaveValue('30');
 await expect(page.getByRole('combobox',{name:'Отделка',exact:true})).toHaveValue('rough');
});
