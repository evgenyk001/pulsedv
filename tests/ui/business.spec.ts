import {test,expect} from '@playwright/test';
import {businessDay} from '../../packages/pulse-data/business';

test('Catalog review queue: mark verified, persist, then return to queue on due date',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('/pulsedv/control-center/#/objects');
 const card=page.locator('.catalogObjectCard').first(),name=await card.locator('h3').innerText();
 await card.click();const editor=page.getByRole('dialog',{name:'Редактор объекта'});
 const verify=editor.getByRole('button',{name:'Данные проверены сегодня'});await expect(verify).toBeDisabled();
 await editor.getByLabel('Источник цены и условий').fill('Прайс застройщика от сегодня');
 await editor.getByLabel('Ответственный за актуальность').fill('Евгений');
 await verify.click();await editor.getByRole('button',{name:'Готово',exact:true}).click();
 await page.reload();await expect(page.locator('.catalogObjectCard').filter({hasText:name}).getByText(/^Проверен ·/)).toBeVisible();
 await page.getByRole('button',{name:'Требуют проверки',exact:true}).click();
 await expect(page.locator('.catalogObjectCard').filter({hasText:name})).toHaveCount(0);
 await page.getByRole('button',{name:'Показать весь каталог',exact:true}).click();
 await page.locator('.catalogObjectCard').filter({hasText:name}).click();
 await editor.getByLabel('Следующая проверка').fill(businessDay());
 await editor.getByRole('button',{name:'Готово',exact:true}).click();
 await page.getByRole('button',{name:'Требуют проверки',exact:true}).click();
 await expect(page.locator('.catalogObjectCard').filter({hasText:name}).getByText(/^Пора обновить ·/)).toBeVisible();
 await page.screenshot({path:'test-results/catalog-freshness.png',fullPage:true});
});

test('Finance: save commission and actual payment, reload, check period totals',async({page})=>{
 await page.goto('/pulsedv/mini-app/#/property/primorskiy');
 const skip=page.getByRole('button',{name:'Пропустить онбординг'});if(await skip.count())await skip.click();
 await page.getByRole('button',{name:'Узнать наличие',exact:true}).click();
 await page.getByRole('textbox',{name:'Как к вам обращаться'}).fill('Финансовый тест');
 await page.getByRole('textbox',{name:'Телефон',exact:true}).fill('+79990000475');
 await page.getByRole('checkbox',{name:/Я даю согласие/}).check();
 await page.getByRole('button',{name:'Отправить заявку',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Обращение создано'})).toBeVisible();
 await page.goto('/pulsedv/control-center/#/leads');
 await page.locator('.leadRowButton').filter({hasText:'Финансовый тест'}).click();
 const editor=page.getByRole('dialog',{name:'Карточка клиента'});
 await editor.getByLabel('Комиссия агентству, ₽').fill('250000');
 await editor.getByLabel('Выплата агенту, ₽').fill('100000');
 await editor.getByLabel('Ожидаемая дата поступления').fill(businessDay());
 await editor.getByLabel('Комиссия поступила',{exact:true}).fill(businessDay());
 await editor.getByRole('button',{name:'Сохранить карточку'}).click();
 await page.reload();await page.locator('.leadRowButton').filter({hasText:'Финансовый тест'}).click();
 await expect(editor.getByLabel('Комиссия агентству, ₽')).toHaveValue('250000');
 await editor.getByRole('button',{name:'Закрыть',exact:true}).click();
 await page.goto('/pulsedv/control-center/#/analytics');
 const summary=page.getByRole('region',{name:'Финансовый результат'});
 await expect(summary.locator('article').filter({hasText:'Комиссии поступили'}).locator('strong')).toHaveText(/250\s?000/);
 await expect(summary.locator('article').filter({hasText:'Ожидаем поступления'}).locator('strong')).toHaveText(/0/);
 await expect(summary.locator('article').filter({hasText:'Выплачено агентам'}).locator('strong')).toHaveText(/0/);
 await summary.getByLabel('С',{exact:true}).fill('2020-01-01');
 await expect(summary.getByRole('alert')).toContainText('Выберите корректный период');
 await summary.getByLabel('С',{exact:true}).fill(businessDay());
 await expect(summary.locator('article')).toHaveCount(4);
 await page.screenshot({path:'test-results/deal-finance.png',fullPage:true});
});

test('Initial load does not request mortgage and journey bundles before navigation',async({page})=>{
 const chunks:string[]=[];page.on('request',r=>{if(r.url().includes('/assets/'))chunks.push(r.url())});
 await page.goto('/pulsedv/mini-app/');
 await expect(page.getByRole('button',{name:'Пропустить онбординг'})).toBeVisible();
 expect(chunks.filter(url=>/\/(mortgage|journey)-.*\.js/.test(url))).toEqual([]);
 await page.getByRole('button',{name:'Пропустить онбординг'}).click();
 await page.goto('/pulsedv/mini-app/#/mortgage');
 await expect(page.getByRole('dialog',{name:'Знакомство с ипотекой',exact:true})).toBeVisible();
 expect(chunks.some(url=>/\/mortgage-.*\.js/.test(url))).toBe(true);
});
