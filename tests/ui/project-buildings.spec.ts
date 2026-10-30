import {test,expect,type Page} from '@playwright/test';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';
import {complexProject,building} from '../fixtures/project-buildings';
async function seed(page:Page){
 const property=complexProject();property.projectDetails!.masterplanUrl='https://images.test/masterplan.svg';property.projectDetails!.buildings!.push({...building('empty','Будущий корпус',2032),commissioningDate:null,handoverDate:null,totalApartments:null,availableApartments:null});
 await page.route('https://images.test/**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="#ced8cf"/><rect x="100" y="100" width="400" height="200" fill="#81958d"/></svg>'}));
 await page.route('https://telegram.org/js/telegram-web-app.js**',r=>r.fulfill({body:''}));
 await page.addInitScript(state=>{if(!localStorage.getItem('pulse.dv.control.state.v1'))localStorage.setItem('pulse.dv.control.state.v1',JSON.stringify(state));localStorage.setItem('pulse_onboarding_version',state.content.onboardingVersion)}, {...DEFAULT_STATE,properties:[property]});
}
for(const width of [320,390,768])test(`Buildings ${width}px: scoped prices/plans, unknown corpus, masterplan and return`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});await seed(page);await page.goto('/pulsedv/mini-app/#/property/multi-project');
 const selector=page.getByLabel('Выбрать корпус',{exact:true}),price=page.getByRole('region',{name:'Стоимость выбранного варианта'}),plans=page.getByRole('region',{name:'Квартиры и планировки ЖК'});
 await selector.selectOption('early');await expect(price).toContainText('8');await expect(price).toContainText('Корпус Восток');await expect(price).not.toContainText('5 000');
 await expect(plans.getByRole('button',{name:'Выбрать планировки: 2',exact:true})).toHaveCount(0);
 await plans.getByRole('button',{name:'Выбрать планировки: 1',exact:true}).click();await expect(plans.getByRole('link',{name:'Рассчитать ипотеку',exact:true})).toHaveAttribute('href',/price=8000000.*floorplan=early-plan/);
 await plans.getByRole('button',{name:'Открыть планировку 1',exact:true}).click();const viewer=page.getByRole('dialog').last();await expect(viewer).toContainText('Корпус Восток');await expect(viewer).toContainText('секция 1');await page.keyboard.press('Escape');await expect(page.locator('.pulsePlanViewer')).toHaveCount(0);
 await plans.getByRole('link',{name:'Рассчитать ипотеку',exact:true}).click();await expect(page).toHaveURL(/floorplan=early-plan/);await page.goBack();await expect(selector).toHaveValue('early');
 await selector.selectOption('late');await expect(price).toContainText('5');await expect(price).toContainText('Башня Запад');
 await selector.selectOption('empty');await expect(price).toContainText('Цена уточняется');await expect(plans.getByRole('link',{name:'Рассчитать ипотеку',exact:true})).toHaveCount(0);await expect(plans).toContainText('Планировки пока не загружены');
 await page.getByRole('button',{name:'Посмотреть генплан'}).click();await expect(page.getByRole('dialog').last().getByRole('img',{name:'Генплан ЖК Многокорпусный'})).toBeVisible();await page.getByRole('button',{name:'Увеличить генплан'}).click();await expect(page.locator('.pulseMasterplanTools')).toContainText('150%');await page.keyboard.press('Escape');await expect(page.locator('.pulseMasterplanSheet')).toHaveCount(0);
 await selector.selectOption('ready');await expect(page.getByRole('region',{name:'Характеристики выбранного корпуса'})).toContainText('Сдан');await expect(plans.getByRole('button',{name:'Выбрать планировки: 2',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await page.getByRole('region',{name:'Корпуса и очереди ЖК'}).screenshot({path:`test-results/buildings-client-${width}.png`});
});
for(const width of [390,1440])test(`Control building editing ${width}px preserves global facts and detaches deleted corpus`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});await seed(page);await page.goto('/pulsedv/control-center/#/objects');await page.locator('.catalogObjectCard').first().click();const editor=page.getByRole('dialog',{name:'Редактор объекта'});
 const first=editor.locator('.buildingEditor').first();await first.locator('summary').click();await first.getByLabel('Название корпуса',{exact:true}).fill('Восточный корпус');
 await editor.getByLabel('Всего квартир в ЖК',{exact:true}).fill('950');await editor.getByLabel('Всего квартир в ЖК',{exact:true}).blur();
 await editor.getByRole('button',{name:'Добавить корпус',exact:true}).click();const added=editor.locator('.buildingEditor').last();await added.locator('summary').click();await added.getByLabel('Название корпуса',{exact:true}).fill('Новый корпус');await added.getByLabel('Год сдачи',{exact:true}).fill('2031');
 const plan=editor.locator('.editorRow.floorplanEditor').last();await plan.getByLabel('Корпус планировки',{exact:true}).selectOption({label:'Новый корпус'});
 await editor.getByRole('button',{name:'Готово',exact:true}).click();await page.goto('/pulsedv/mini-app/#/property/multi-project');await page.getByLabel('Выбрать корпус',{exact:true}).selectOption({label:'Новый корпус'});await expect(page.getByRole('region',{name:'Стоимость выбранного варианта'})).toContainText('4');
 await page.getByText('Все характеристики ЖК',{exact:true}).click();await expect(page.locator('details').filter({hasText:'Все характеристики ЖК'})).toContainText('950');
 await page.goto('/pulsedv/control-center/#/objects');await page.locator('.catalogObjectCard').first().click();const remove=editor.locator('.buildingEditor').filter({hasText:'Новый корпус'});await remove.locator('summary').click();page.once('dialog',d=>d.accept());await remove.getByRole('button',{name:'Удалить корпус'}).click();
 await expect(editor.locator('.editorRow.floorplanEditor').last().getByLabel('Корпус планировки',{exact:true})).toHaveValue('');await expect(editor.locator('.editorRow.floorplanEditor')).toHaveCount(4);
 const buildingEditor=editor.locator('.buildingEditor').first();await buildingEditor.locator('summary').click();await buildingEditor.getByLabel('Передача ключей по договору',{exact:true}).fill('2020-01-01');await expect(editor.getByRole('button',{name:'Готово',exact:true})).toBeDisabled();await buildingEditor.getByLabel('Передача ключей по договору',{exact:true}).fill('2028-06-30');await expect(editor.getByRole('button',{name:'Готово',exact:true})).toBeEnabled();
 expect(await editor.evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);await editor.screenshot({path:`test-results/buildings-control-${width}.png`});
});
