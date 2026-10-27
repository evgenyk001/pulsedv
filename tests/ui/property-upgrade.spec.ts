import {test,expect,type Page} from '@playwright/test';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';
async function seed(page:Page,details=true){
 const state=structuredClone(DEFAULT_STATE),p=state.properties[0];
 p.projectDetails=details?{commissioningDate:'2027-12-31',totalApartments:420,availableApartments:77,finishes:['rough','white_box','finished']}:undefined;
 p.floorplans[0].finishOptions=[{finishType:'rough',priceFrom:7.8},{finishType:'white_box',priceFrom:8.25},{finishType:'finished',priceFrom:null}];
 p.coverImageUrl='https://images.test/photo-0.svg';p.images=[0,1,2].map(i=>({url:`https://images.test/photo-${i}.svg`,alt:'Фото проекта '+(i+1),sortOrder:i}));
 await page.route('https://images.test/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#aec3d4"/><path d="M100 800V160h280v640m100 0V280h350v520" fill="#637c91"/></svg>'}));
 await page.route('https://telegram.org/js/telegram-web-app.js',route=>route.fulfill({body:''}));
 await page.addInitScript(state=>{if(!localStorage.getItem('pulse.dv.control.state.v1'))localStorage.setItem('pulse.dv.control.state.v1',JSON.stringify(state));localStorage.setItem('pulse_onboarding_version',state.content.onboardingVersion)},state);
}
for(const width of [320,390,430])test(`Project overview ${width}px: facts, real inventory and room shortcuts`,async({page,browserName})=>{
 await page.setViewportSize({width,height:844});await seed(page);await page.goto('/pulsedv/mini-app/#/property/primorskiy');
 const facts=page.getByRole('region',{name:'Ключевые характеристики'});await expect(facts).toContainText('31 декабря 2027');await expect(page.getByRole('region',{name:'Квартиры и планировки ЖК'})).toContainText('77 квартир из 420');
 await expect(page.locator('#pulse-launch')).toHaveCount(0);
 await page.screenshot({path:`test-results/property-assembled-${browserName}-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Выбрать планировки: 2',exact:true}).click();
 const plans=page.getByRole('region',{name:'Квартиры и планировки ЖК'});await expect(plans).toContainText('2 комн.');
 await expect(page.getByRole('button',{name:'Выбрать планировки: 2',exact:true})).toHaveAttribute('aria-expanded','true');
 await expect(plans.getByRole('link',{name:'Рассчитать ипотеку',exact:true})).toHaveAttribute('href',/price=9400000.*floorplan=index-1/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('Control project details reach the client, including zero availability and unknown dates',async({page})=>{
 await seed(page,false);await page.goto('/pulsedv/control-center/#/objects');await page.locator('.catalogObjectCard').filter({hasText:'ЖК Приморский'}).click();
 const editor=page.getByRole('dialog',{name:'Редактор объекта'});
 await editor.getByLabel('Плановая дата ввода дома',{exact:true}).fill('2028-03-31');await editor.getByLabel('Плановая дата ввода дома',{exact:true}).blur();
 await editor.getByLabel('Всего квартир в ЖК',{exact:true}).fill('120');await editor.getByLabel('Всего квартир в ЖК',{exact:true}).blur();
 await editor.getByLabel('Квартир в продаже',{exact:true}).fill('0');await editor.getByLabel('Квартир в продаже',{exact:true}).blur();
 for(const [label,value] of [['Парковочных мест','0'],['Этажность от','9'],['Этажность до','25'],['Площадь квартир от, м²','23.4'],['Площадь квартир до, м²','106.8']]){await editor.getByLabel(label,{exact:true}).fill(value);await editor.getByLabel(label,{exact:true}).blur()}
 await editor.getByLabel('Этажность от',{exact:true}).fill('30');await editor.getByLabel('Этажность от',{exact:true}).blur();
 await expect(editor.getByRole('button',{name:'Готово',exact:true})).toBeDisabled();
 await editor.getByLabel('Этажность от',{exact:true}).fill('9');await editor.getByLabel('Этажность от',{exact:true}).blur();
 await editor.getByRole('button',{name:'Готово',exact:true}).click();
 await page.goto('/pulsedv/mini-app/#/property/primorskiy');const facts=page.getByRole('region',{name:'Ключевые характеристики'});await expect(facts).toContainText('31 марта 2028');await expect(facts).toContainText('23,4–106,8 м²');await page.getByText('Все характеристики ЖК',{exact:true}).click();await expect(page.locator('details').filter({hasText:'Все характеристики ЖК'})).toContainText('9–25');await expect(page.locator('details').filter({hasText:'Все характеристики ЖК'})).toContainText('Парковочных мест0');await expect(page.getByRole('region',{name:'Квартиры и планировки ЖК'})).toContainText('из 120');await expect(page.getByRole('region',{name:'Квартиры и планировки ЖК'})).toContainText('В продаже: 0 квартир');
});
test('Gallery: short drag returns, long drag flies to the selected cover, repeated closes restore focus',async({page})=>{
 await page.setViewportSize({width:390,height:844});await seed(page);await page.goto('/pulsedv/mini-app/#/property/primorskiy');
 const trigger=page.getByRole('button',{name:'Открыть все фотографии'});await trigger.click();const dialog=page.getByRole('dialog',{name:'ЖК Приморский',exact:true}),rail=page.getByLabel('Полноэкранные фотографии');
 await expect(dialog.locator('img').first()).toBeVisible();
 const drag=async(distance:number)=>{const box=(await rail.boundingBox())!;const x=box.x+box.width/2,y=box.y+box.height*.25;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+8,y+distance,{steps:10});await page.mouse.up()};
 await drag(45);await expect(dialog).toBeVisible();await expect.poll(()=>rail.evaluate(el=>getComputedStyle(el).transform)).toBe('matrix(1, 0, 0, 1, 0, 0)');
 await dialog.getByRole('button',{name:'Фото 3',exact:true}).click();await expect(dialog.getByText('3 из 3',{exact:true})).toBeVisible();
 await drag(240);await expect(page.locator('[data-gallery-return]')).toHaveCount(1);await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();await expect(trigger).toContainText('3 / 3');await expect(page.locator('[data-gallery-return]')).toHaveCount(0);
 await trigger.click();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
 await trigger.click();await dialog.getByRole('button',{name:'Закрыть фотографии'}).click();await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
});
test('Gallery preserves pinch intent and supports reduced motion',async({page})=>{
 await seed(page);await page.goto('/pulsedv/mini-app/#/property/primorskiy');await page.getByRole('button',{name:'Открыть все фотографии'}).click();const rail=page.getByLabel('Полноэкранные фотографии'),dialog=page.getByRole('dialog',{name:'ЖК Приморский',exact:true});
 expect(await rail.evaluate(el=>getComputedStyle(el).touchAction)).toContain('pinch-zoom');
 await rail.dispatchEvent('pointerdown',{pointerId:21,pointerType:'touch',button:0,clientX:120,clientY:200});await rail.dispatchEvent('pointerdown',{pointerId:22,pointerType:'touch',button:0,clientX:200,clientY:200});
 await rail.dispatchEvent('pointermove',{pointerId:21,pointerType:'touch',clientX:120,clientY:500});await rail.dispatchEvent('pointerup',{pointerId:21,pointerType:'touch'});await rail.dispatchEvent('pointerup',{pointerId:22,pointerType:'touch'});await expect(dialog).toBeVisible();
 await page.emulateMedia({reducedMotion:'reduce'});await dialog.getByRole('button',{name:'Закрыть фотографии'}).click();await expect(dialog).toHaveCount(0);await expect(page.locator('[data-gallery-return]')).toHaveCount(0);
});

test('Finish selection changes the offer and mortgage price, and survives Back without leaking to a new visit',async({page})=>{
 test.setTimeout(60000);
 await page.setViewportSize({width:390,height:844});await seed(page);
 await page.goto('/pulsedv/mini-app/#/property/primorskiy');
 const finishes=page.getByRole('group',{name:'Варианты отделки'});
 await expect(finishes).toContainText('Черновая');
 await expect(finishes).toContainText('White Box');
 await expect(finishes).toContainText('Готовый ремонт');
 await finishes.getByRole('button',{name:'White Box'}).click();
 await page.getByRole('button',{name:'Выбрать планировки: 1',exact:true}).click();
 const plans=page.getByRole('region',{name:'Квартиры и планировки ЖК'});
 await expect(plans).toContainText('8 250 000');
 await page.getByRole('button',{name:'Открыть планировку 1',exact:true}).click();
 const detail=page.getByRole('dialog',{name:'ЖК Приморский · 1 комн.',exact:true});
 await expect(detail).toContainText('White Box');
 await expect(detail).toContainText('8 250 000');
 await detail.getByRole('button',{name:/Готовый ремонт/}).click();
 await expect(detail).toContainText('Цена уточняется');
 await expect(detail.getByRole('link',{name:'Рассчитать эту планировку'})).toHaveCount(0);
 await detail.getByRole('button',{name:/White Box/}).click();
 await detail.getByRole('link',{name:'Рассчитать эту планировку'}).click();
 await expect(page.getByRole('textbox',{name:'Стоимость недвижимости',exact:true})).toHaveValue(/^8\s250\s000$/);
 await expect(page.getByRole('region',{name:'Расчёт выбранного ЖК'})).toContainText('White Box');
 await page.getByRole('button',{name:'Вернуться к ЖК',exact:true}).click();
 await expect(page.getByRole('group',{name:'Варианты отделки'}).getByRole('button',{name:'White Box',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('button',{name:'Выбрать планировки: 1',exact:true})).toHaveAttribute('aria-expanded','true');
 await page.getByRole('link',{name:'Назад',exact:true}).click();
 await page.getByRole('link',{name:'Открыть ЖК Приморский',exact:true}).click();
 await expect(page.getByRole('group',{name:'Варианты отделки'}).getByRole('button',{name:'Все варианты',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('button',{name:'Выбрать планировки: 1',exact:true})).toHaveAttribute('aria-expanded','false');
});

 test('Control map selection stores longitude and latitude and supports clearing the point',async({page})=>{
 await seed(page);
 await page.route('**/api/v1/public/map',route=>route.fulfill({json:{provider:'yandex',key:'test-key'}}));
 await page.addInitScript(()=>{
  class Entity{props:any;constructor(props:any){this.props=props;if(props?.onClick)(window as any).pick=props.onClick}addChild(){return this}removeChild(){}destroy(){}update(){}}
  class Map extends Entity{constructor(node:any,props:any){super(props)}setLocation(){}setMargin(){}setCamera(){}zoom=12}
  (window as any).ymaps3={ready:Promise.resolve(),import:async()=>({YMapOpenMapsButton:Entity}),YMap:Map,YMapDefaultSchemeLayer:Entity,YMapDefaultFeaturesLayer:Entity,YMapControls:Entity,YMapMarker:Entity,YMapListener:Entity};
 });
 await page.goto('/pulsedv/control-center/#/objects');await page.locator('.catalogObjectCard').filter({hasText:'ЖК Приморский'}).click();
 const editor=page.getByRole('dialog',{name:'Редактор объекта'});
 await editor.getByRole('button',{name:'Изменить точку на карте',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>typeof (window as any).pick)).toBe('function');
 await page.evaluate(()=>(window as any).pick(undefined,{coordinates:[132.12345678,43.98765432]}));
 await editor.getByText('Координаты вручную',{exact:true}).click();
 await expect(editor.getByLabel('Широта',{exact:true})).toHaveValue('43.987654');await expect(editor.getByLabel('Долгота',{exact:true})).toHaveValue('132.123457');
 await editor.getByRole('button',{name:'Скрыть карту',exact:true}).click();await editor.getByRole('button',{name:'Готово',exact:true}).click();
 await page.reload();await page.locator('.catalogObjectCard').filter({hasText:'ЖК Приморский'}).click();
 await editor.getByText('Координаты вручную',{exact:true}).click();await expect(editor.getByLabel('Широта',{exact:true})).toHaveValue('43.987654');
 await editor.getByRole('button',{name:'Убрать точку',exact:true}).click();await expect(editor.getByLabel('Широта',{exact:true})).toHaveValue('');await expect(editor.getByLabel('Долгота',{exact:true})).toHaveValue('');
 });
