import { test,expect } from '@playwright/test';
for(const width of [320,390,430])test(`Mini App ${width}px: icons, pill geometry, drag, switch`,async({page})=>{
 await page.setViewportSize({width,height:844});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/pulsedv/mini-app/');
 await page.getByRole('button',{name:'Пропустить онбординг'}).click();
 const nav=page.getByRole('navigation',{name:'Основная навигация'});
 await expect(nav.getByRole('button')).toHaveCount(4);
 await expect(nav.locator('svg')).toHaveCount(4);
 await nav.getByRole('button',{name:'Каталог',exact:true}).click();
 const tabs=page.getByRole('tablist',{name:'Режим каталога'});await expect(tabs).toBeVisible();
 await expect(page.getByRole('heading',{name:'Новостройки',exact:true})).toBeVisible();
 const pill=tabs.locator('span[aria-hidden="true"]');const first=tabs.getByRole('tab',{name:'Список',exact:true});
 await expect.poll(async()=>{const a=await pill.boundingBox(),b=await first.boundingBox();return !!a&&!!b&&Math.abs(a.x-b.x)<1&&Math.abs(a.width-b.width)<1;}).toBe(true);
 const from=await first.boundingBox();const to=await tabs.getByRole('tab',{name:'Карта',exact:true}).boundingBox();
 await page.mouse.move(from!.x+from!.width/2,from!.y+from!.height/2);await page.mouse.down();await page.mouse.move(to!.x+to!.width/2,to!.y+to!.height/2,{steps:15});await page.mouse.up();
 await expect(tabs.getByRole('tab',{name:'Карта',exact:true})).toHaveAttribute('aria-selected','true');
 await tabs.getByRole('tab',{name:'Список',exact:true}).click();
 await expect(first).toHaveAttribute('aria-selected','true');

 const firstProperty=page.getByRole('link',{name:/Открыть /}).first();
 await expect(firstProperty).toBeVisible();
 await firstProperty.click();
 await expect(page.getByLabel(/Фотографии /)).toBeVisible();
 await expect(page.getByLabel('Ключевые характеристики')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Выберите квартиру',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Детали проекта',exact:true})).toBeVisible();
 await page.getByRole('link',{name:'Назад',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Новостройки',exact:true})).toBeVisible();

 await nav.getByRole('button',{name:'Подбор',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Где и что ищем?',exact:true})).toBeVisible();
 await expect(page.getByLabel('Живой профиль PULSE Select')).toBeVisible();
 await page.getByRole('textbox',{name:'Опишите квартиру своими словами'}).fill('Двушка во Владивостоке, ипотека до 70 тыс. в месяц, первоначальный взнос 2 млн, у моря');
 await page.getByRole('button',{name:'Понять запрос',exact:true}).click();
 await expect(page.getByText(/PULSE понял/)).toBeVisible();
 await page.getByRole('button',{name:/Продолжить/}).click();
 await expect(page.getByRole('heading',{name:'Как удобнее считать?',exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Продолжить/}).click();
 await expect(page.getByRole('heading',{name:'Когда нужны ключи?',exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Продолжить/}).click();
 await expect(page.getByRole('heading',{name:'Что делает квартиру «вашей»?',exact:true})).toBeVisible();
 const sea=page.getByRole('button',{name:/Вид на море/});await sea.click();await expect(sea).toHaveAttribute('aria-pressed','true');
 const parking=page.getByRole('button',{name:/Парковка/});await parking.click();await expect(parking).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Собрать мой подбор',exact:true}).click();
 await expect(page.getByLabel('Результат PULSE Select')).toBeVisible();
 await page.goto('/pulsedv/mini-app/#/mortgage');
 await page.getByRole('button',{name:/Дальневосточная/}).click();
 const switches=page.getByRole('switch');await expect(switches.first()).toBeVisible();
 for(const item of await switches.all()){
  const thumb=item.locator('[data-state]').first();
  for(let i=0;i<2;i++){await item.click();await expect.poll(async()=>{const a=await item.boundingBox(),b=await thumb.boundingBox();return !!a&&!!b&&b.x>=a.x+2&&b.x+b.width<=a.x+a.width-2&&Math.abs((b.y+b.height/2)-(a.y+a.height/2))<1;}).toBe(true);}
 }
 expect(errors).toEqual([]);
 await page.screenshot({path:`test-results/mini-app-${width}.png`,fullPage:true});
});

test('Control preview: object editor and real state changes',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await page.goto('/pulsedv/control-center/');
 await expect(page.getByText('Демонстрация · данные только в этом браузере')).toBeVisible();
 await page.getByRole('link',{name:'Объекты',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Добавляйте десятки и сотни ЖК за один проход',exact:true})).toBeVisible();
 await expect(page.getByText('БАЗА ОБЪЕКТОВ',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Добавить ЖК',exact:true}).click();
 await page.getByRole('textbox',{name:'Название',exact:true}).fill('Тестовый ЖК');await page.getByRole('button',{name:'Готово',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Тестовый ЖК',exact:true})).toBeVisible();
 await page.screenshot({path:'test-results/control-objects.png',fullPage:true});
});


test('Control preview: PULSE Select settings and activity stay connected',async({page})=>{
 await page.setViewportSize({width:1280,height:900});
 await page.goto('/pulsedv/control-center/');
 await page.getByRole('link',{name:'PULSE Select',exact:true}).click();
 await expect(page.getByRole('heading',{name:'PULSE Select',exact:true})).toBeVisible();

 const smart=page.getByRole('checkbox',{name:'Умная строка запроса'});
 if(await smart.isChecked())await smart.click();
 const sea=page.getByRole('checkbox',{name:'Вид на море'});
 if(await sea.isChecked())await sea.click();
 const max=page.getByRole('spinbutton',{name:'Максимум личных приоритетов'});
 await max.fill('2');
 await max.blur();

 await page.goto('/pulsedv/mini-app/');
 const skip=page.getByRole('button',{name:'Пропустить онбординг'});
 if(await skip.isVisible().catch(()=>false))await skip.click();
 const nav=page.getByRole('navigation',{name:'Основная навигация'});
 await nav.getByRole('button',{name:'Подбор',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Опишите квартиру своими словами'})).toHaveCount(0);

 await page.getByRole('button',{name:/Продолжить/}).click();
 await page.getByRole('button',{name:/Продолжить/}).click();
 await page.getByRole('button',{name:/Продолжить/}).click();
 await expect(page.getByRole('heading',{name:'Что делает квартиру «вашей»?',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:/Вид на море/})).toHaveCount(0);
 await expect(page.getByText(/0\/2 выбрано/)).toBeVisible();
 await page.getByRole('button',{name:/Для семьи/}).click();
 await page.getByRole('button',{name:/Парковка/}).click();
 await expect(page.getByText(/2\/2 выбрано/)).toBeVisible();
 await page.getByRole('button',{name:'Собрать мой подбор',exact:true}).click();
 await expect(page.getByLabel('Результат PULSE Select')).toBeVisible();

 await page.goto('/pulsedv/control-center/#/select');
 await expect(page.getByText(/Посетитель .*…/).first()).toBeVisible();
 await expect(page.getByText('СОВПАДЕНИЕ').last()).toBeVisible();
});

for(const width of [390,1440])test(`Control workspace ${width}px: navigation, clients, activity and tasks`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/pulsedv/control-center/');
 await expect(page.getByRole('heading',{name:'Всё важное — в фокусе'})).toBeVisible();
 await page.getByRole('link',{name:'Открыть клиентов'}).click();
 await page.getByRole('button',{name:'Доска',exact:true}).click();
 await expect(page.locator('.leadBoard')).toBeVisible();
 await page.getByRole('button',{name:'Таблица',exact:true}).click();
 if(width<761)await page.getByRole('button',{name:'Открыть меню'}).click();
 await page.getByRole('navigation',{name:'Разделы CRM'}).getByRole('link',{name:'Задачи',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Задачи под контролем'})).toBeVisible();
 await page.getByRole('button',{name:/Просроченные/}).click();
 await expect(page).toHaveURL(/filter=overdue/);
 if(width<761)await page.getByRole('button',{name:'Открыть меню'}).click();
 await page.getByRole('navigation',{name:'Разделы CRM'}).getByRole('link',{name:'Аналитика',exact:true}).click();
 await page.getByRole('textbox',{name:'Поиск действий'}).fill('несуществующее действие');
 await expect(page.getByText('По этим условиям действий нет')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 expect(errors).toEqual([]);
 await page.screenshot({path:`test-results/control-workspace-${width}.png`,fullPage:true});
});

test('CRM: real preview lead, editable stage, readable history and keyboard drawer',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('/pulsedv/mini-app/');
 await page.getByRole('button',{name:'Пропустить онбординг'}).click();
 await page.goto('/pulsedv/mini-app/#/property/solnechniy');
 await page.getByRole('button',{name:'Узнать наличие',exact:true}).click();
 await page.getByRole('textbox',{name:'Как к вам обращаться'}).fill('Проверка CRM');
 await page.getByRole('textbox',{name:'Телефон',exact:true}).fill('+79991234567');
 await page.getByRole('button',{name:'Отправить заявку',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Демонстрация завершена'})).toBeVisible();
 await page.goto('/pulsedv/control-center/');
 await page.screenshot({path:'test-results/control-overview-with-lead.png',fullPage:true});
 await page.getByRole('link',{name:'Открыть клиентов'}).click();
 await page.locator('.leadRowButton').filter({hasText:'Проверка CRM'}).click();
 const drawer=page.getByRole('dialog',{name:'Карточка клиента'});
 await expect(drawer.getByText('Оставил заявку',{exact:true})).toBeVisible();
 await expect(drawer.getByRole('heading',{name:'Interest DNA',exact:true})).toBeVisible();
 await drawer.getByRole('button',{name:'Вставить в план контакта'}).click();
 await expect(drawer.getByRole('textbox',{name:'Следующее действие',exact:true})).toHaveValue(/город/);
 await drawer.getByRole('combobox',{name:'Статус',exact:true}).selectOption('contacted');
 await drawer.getByRole('textbox',{name:'Следующее действие',exact:true}).fill('Позвонить и согласовать показ');
 await drawer.getByRole('button',{name:'Сохранить карточку'}).click();
 await expect(drawer).not.toBeVisible();
 await expect(page.locator('.leadRowButton').filter({hasText:'Проверка CRM'})).toContainText('Связались');
 await page.locator('.leadRowButton').filter({hasText:'Проверка CRM'}).click();
 await page.keyboard.press('Escape');
 await expect(drawer).not.toBeVisible();
 await page.getByRole('navigation',{name:'Разделы CRM'}).getByRole('link',{name:'Пользователи',exact:true}).click();
 await page.locator('.leadRowButton').first().click();
 await expect(page.getByRole('dialog',{name:'Профиль посетителя'})).toBeVisible();
 await expect(page.getByRole('link',{name:/ЗАЯВКА КЛИЕНТА/})).toBeVisible();
});

for(const width of [390,1440])test(`Interest DNA ${width}px: facts, evidence, changed request and next step`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/pulsedv/mini-app/');await page.getByRole('button',{name:'Пропустить онбординг'}).click();
 await page.getByRole('navigation',{name:'Основная навигация'}).getByRole('button',{name:'Подбор',exact:true}).click();
 await page.getByRole('button',{name:/Продолжить/}).click();
 await page.getByRole('tab',{name:'По стоимости',exact:true}).click();
 await page.getByRole('button',{name:/Продолжить/}).click();await page.getByRole('button',{name:/Продолжить/}).click();
 await page.getByRole('button',{name:'Собрать мой подбор',exact:true}).click();await expect(page.getByLabel('Результат PULSE Select')).toBeVisible();
 await page.getByRole('button',{name:'Изменить запрос',exact:true}).click();
 await page.getByRole('button',{name:'Артём',exact:true}).click();
 await page.getByRole('button',{name:/Продолжить/}).click();await page.getByRole('button',{name:/Продолжить/}).click();await page.getByRole('button',{name:/Продолжить/}).click();
 await page.getByRole('button',{name:'Собрать мой подбор',exact:true}).click();await expect(page.getByLabel('Результат PULSE Select')).toBeVisible();
 await page.goto('/pulsedv/control-center/#/users');await page.locator('.leadRowButton').first().click();
 const dna=page.getByRole('region',{name:'Interest DNA'});
 await expect(dna.getByRole('heading',{name:'Interest DNA',exact:true})).toBeVisible();
 await dna.getByRole('tab',{name:'Указал сам',exact:true}).click();await expect(dna.getByText('По стоимости',{exact:true})).toBeVisible();
 await dna.getByRole('tab',{name:'Интересы',exact:true}).click();
 const signal=dna.locator('.dnaSignal').first();await signal.locator('summary').click();await expect(signal.getByText('На чём основан вывод')).toBeVisible();
 await dna.getByRole('tab',{name:'Что изменилось',exact:false}).click();await expect(dna.getByText('Изменил запрос: город',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 await page.screenshot({path:`test-results/interest-dna-${width}.png`,fullPage:true});expect(errors).toEqual([]);
});
