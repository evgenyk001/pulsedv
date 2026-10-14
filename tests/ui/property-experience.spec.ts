import {test,expect,type Page} from '@playwright/test';
import {DEFAULT_STATE,type PulseState} from '../../packages/pulse-data/model';

const rub=(n:number)=>n.toLocaleString('ru-RU');
const fixture=():PulseState=>{
 const state=structuredClone(DEFAULT_STATE),p=state.properties[0];
 p.priceFrom=7.543219;p.address='Владивосток, улица Светланская, 12';
 p.images=[...state.properties.map((item,i)=>({id:'photo-'+i,url:item.coverImageUrl!,alt:'Вид проекта '+(i+1),sortOrder:i}))];
 p.floorplans=[{id:'exact-plan',roomLabel:'2',areaFrom:62,areaTo:62,priceFrom:8.765432,imageUrl:null,sortOrder:0}];
 p.documents=[{id:'presentation',kind:'presentation',name:'Презентация проекта',url:'https://example.test/presentation.pdf',mimeType:'application/pdf',sizeBytes:1024,sortOrder:0}];
 return state;
};
async function seed(page:Page,state=fixture()){
 await page.addInitScript(state=>{
  if(!localStorage.getItem('pulse.dv.control.state.v1'))localStorage.setItem('pulse.dv.control.state.v1',JSON.stringify(state));
  localStorage.setItem('pulse_onboarding_version',state.content.onboardingVersion);
  localStorage.setItem('pulse_mortgage_intro_version','mortgage_intro_v5');
  if(!localStorage.getItem('pulse_mortgage_scenario_v1'))localStorage.setItem('pulse_mortgage_scenario_v1',JSON.stringify({programId:'family',propertyKind:'house',childrenCount:2,hasYoungChild:true,price:12000000,down:6000000,years:15,marketRate:17.6}));
 },state);
}

for(const width of [320,390,430])test(`Property experience ${width}px: fullscreen gallery, exact price, minimum and CRM context`,async({page,browserName})=>{
 await page.setViewportSize({width,height:844});await seed(page);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/pulsedv/mini-app/#/property/primorskiy');
 await expect(page.getByRole('heading',{name:'ЖК Приморский',exact:true})).toBeVisible();
 await expect(page.getByText('от '+rub(7543219)+' ₽',{exact:true}).first()).toBeVisible();
 await page.screenshot({path:`test-results/property-page-${browserName}-${width}.png`,fullPage:true});
 const photos=page.getByRole('button',{name:'Открыть все фотографии'});await photos.click();
 const viewer=page.getByRole('dialog',{name:'ЖК Приморский',exact:true});await expect(viewer).toBeVisible();
 await expect(viewer.getByText('1 из 4',{exact:true})).toBeVisible();await expect(viewer.getByRole('button',{name:'Предыдущее фото'})).toBeDisabled();
 await viewer.getByRole('button',{name:'Следующее фото'}).click();await expect(viewer.getByText('2 из 4',{exact:true})).toBeVisible();
 const rail=viewer.getByLabel('Полноэкранные фотографии');await rail.evaluate(node=>{node.scrollLeft=node.clientWidth*2});await expect(viewer.getByText('3 из 4',{exact:true})).toBeVisible();
 await viewer.getByRole('button',{name:'Фото 4',exact:true}).click();await expect(viewer.getByText('4 из 4',{exact:true})).toBeVisible();await expect(viewer.getByRole('button',{name:'Следующее фото'})).toBeDisabled();
 await rail.focus();await page.keyboard.press('ArrowLeft');await expect(viewer.getByText('3 из 4',{exact:true})).toBeVisible();
 await page.screenshot({path:`test-results/property-gallery-${browserName}-${width}.png`});
 await viewer.getByRole('button',{name:'Закрыть фотографии'}).click();await expect(viewer).toHaveCount(0);await expect(photos).toContainText('3 / 4');await expect(photos).toBeFocused();
 await photos.click();await expect(viewer.getByText('3 из 4',{exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(viewer).toHaveCount(0);
 await page.getByRole('link',{name:'Рассчитать ипотеку',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Стоимость недвижимости',exact:true})).toHaveValue(rub(7543219));
 await expect(page.getByRole('textbox',{name:'Первоначальный взнос',exact:true})).toHaveValue(rub(1516188));
 await expect(page.getByRole('combobox',{name:'Тип недвижимости'})).toHaveValue('newbuild');
 const context=page.getByRole('region',{name:'Расчёт выбранного ЖК'});await expect(context).toContainText('ЖК Приморский');
 await context.getByRole('button',{name:'Вернуться к ЖК'}).click();
 await page.getByRole('navigation',{name:'Разделы жилого комплекса'}).getByRole('button',{name:'Планировки',exact:true}).click();
 await page.getByRole('region',{name:'Планировки ЖК'}).getByRole('link',{name:'Рассчитать платёж'}).click();
 await expect(page.getByRole('textbox',{name:'Стоимость недвижимости',exact:true})).toHaveValue(rub(8765432));
 await expect(page.getByRole('textbox',{name:'Первоначальный взнос',exact:true})).toHaveValue(rub(1761852));
 await expect(context).toContainText('2 комн. · 62 м²');
 await page.screenshot({path:`test-results/property-mortgage-${browserName}-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Получить точный расчёт'}).click();
 await page.getByRole('textbox',{name:'Как к вам обращаться'}).fill('Клиент планировки');await page.getByRole('textbox',{name:'Телефон',exact:true}).fill('+79990000491');await page.getByRole('checkbox',{name:/Я даю согласие/}).check();await page.getByRole('button',{name:'Отправить заявку',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Обращение создано'})).toBeVisible();
 await page.goto('/pulsedv/control-center/#/leads');await page.locator('.leadRowButton').filter({hasText:'Клиент планировки'}).click();
 const client=page.getByRole('dialog',{name:'Карточка клиента'});await expect(client).toContainText('ЖК Приморский');await expect(client).toContainText('Стоимость '+rub(8765432)+' ₽');await expect(client).toContainText('Первоначальный взнос '+rub(1761852)+' ₽');await expect(client).toContainText('Площадь 62 м²');
 expect(errors).toEqual([]);
});

test('Control changes exact ruble prices, gallery order and captions used in Mini App',async({page})=>{
 await seed(page);await page.goto('/pulsedv/control-center/#/objects');await page.locator('.catalogObjectCard').filter({hasText:'ЖК Приморский'}).click();
 const editor=page.getByRole('dialog',{name:'Редактор объекта'});
 await editor.getByLabel('Цена от, ₽',{exact:true}).first().fill('8123456');
 await editor.getByLabel('Подпись фото 2').fill('Двор без машин');await editor.getByRole('button',{name:'Переместить фото 2 раньше',exact:true}).click();await expect(editor.getByLabel('Подпись фото 1')).toHaveValue('Двор без машин');
 await editor.getByRole('button',{name:'Готово',exact:true}).click();
 await page.goto('/pulsedv/mini-app/#/property/primorskiy');await expect(page.getByText('от '+rub(8123456)+' ₽',{exact:true}).first()).toBeVisible();
 await page.getByRole('button',{name:'Открыть все фотографии'}).click();const viewer=page.getByRole('dialog',{name:'ЖК Приморский'});await viewer.getByRole('button',{name:'Следующее фото'}).click();await expect(viewer.getByText('Двор без машин',{exact:true})).toBeVisible();
 await viewer.getByRole('button',{name:'Закрыть фотографии'}).click();await page.getByRole('link',{name:'Рассчитать ипотеку',exact:true}).click();await expect(page.getByRole('textbox',{name:'Стоимость недвижимости',exact:true})).toHaveValue(rub(8123456));await expect(page.getByRole('textbox',{name:'Первоначальный взнос',exact:true})).toHaveValue(rub(1632815));
});

test('Open floorplan shows whole-ruble price and opens its mortgage calculation',async({page})=>{
 await seed(page);await page.goto('/pulsedv/mini-app/#/property/primorskiy');
 await page.getByRole('button',{name:'Открыть планировку 2',exact:true}).click();
 const plan=page.getByRole('dialog',{name:'ЖК Приморский · 2 комн.',exact:true});
 await expect(plan).toContainText('от '+rub(8765432)+' ₽');
 await plan.getByRole('link',{name:'Рассчитать эту планировку',exact:true}).click();
 await expect(plan).toHaveCount(0);
 await expect(page.getByRole('textbox',{name:'Стоимость недвижимости',exact:true})).toHaveValue(rub(8765432));
 await expect(page.getByRole('textbox',{name:'Первоначальный взнос',exact:true})).toHaveValue(rub(1761852));
 await expect(page.getByRole('region',{name:'Расчёт выбранного ЖК'})).toContainText('2 комн. · 62 м²');
});

test('Property price outside previous slider bounds is exact; unavailable plan is explicit',async({page})=>{
 const state=fixture();state.properties[0].priceFrom=2.543219;await seed(page,state);
 await page.goto('/pulsedv/mini-app/#/mortgage?property=primorskiy&price=99000000&floorplan=removed&from=property&down=min');
 await expect(page.getByRole('textbox',{name:'Стоимость недвижимости',exact:true})).toHaveValue(rub(2543219));await expect(page.getByRole('textbox',{name:'Первоначальный взнос',exact:true})).toHaveValue(rub(511188));
 await expect(page.getByRole('region',{name:'Расчёт выбранного ЖК'})).toContainText('Планировка больше не доступна');
 const price=page.getByRole('textbox',{name:'Стоимость недвижимости',exact:true});await price.fill('3000011');await price.blur();await expect(price).toHaveValue(rub(3000011));await expect(page.getByRole('textbox',{name:'Первоначальный взнос',exact:true})).toHaveValue(rub(603003));
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
