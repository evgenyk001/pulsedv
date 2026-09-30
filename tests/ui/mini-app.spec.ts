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


test('Privacy: policy and separate consent are public and linked from profile',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/pulsedv/mini-app/');const skip=page.getByRole('button',{name:'Пропустить онбординг'});if(await skip.count())await skip.click();
 await page.goto('/pulsedv/mini-app/#/profile');
 await page.getByRole('link',{name:/Персональные данные/}).click();
 await expect(page.getByRole('heading',{name:'Политика обработки персональных данных'})).toBeVisible();
 await expect(page.getByText(/имя и номер телефона/)).toBeVisible();
 await page.getByRole('link',{name:'Согласие на обработку персональных данных',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Согласие на обработку персональных данных'})).toBeVisible();
 await expect(page.getByText(/для обработки моего обращения, связи со мной и подбора недвижимости/)).toBeVisible();
});

test('Control content: banner campaigns can be created, enabled and linked',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('/pulsedv/control-center/#/content');
 await page.getByRole('button',{name:'Новый баннер',exact:true}).click();
 const card=page.locator('.bannerCampaignCard').last();
 await card.getByLabel('Тип кампании').selectOption('partner');
 await card.getByLabel('Метка над заголовком').fill('Партнёр PULSE.DV');
 await card.getByLabel('Заголовок').fill('Тестовая партнёрская кампания');
 await card.getByLabel('Описание').fill('Проверяем управляемый баннер без правки клиентского кода.');
 await card.getByLabel('Куда ведёт').selectOption('external');
 await card.getByLabel('HTTPS-ссылка').fill('https://example.com/promo');
 await card.getByLabel('Текст кнопки').fill('Открыть предложение');
 await card.getByLabel(/Показывать Тестовая партнёрская кампания/).check();
 const cards=page.locator('.bannerCampaignCard');
 for(let index=0;index<await cards.count()-1;index++){const toggle=cards.nth(index).getByRole('checkbox',{name:/Показывать/});if(await toggle.isChecked())await toggle.uncheck();}
 await page.goto('/pulsedv/mini-app/');
 const skip=page.getByRole('button',{name:'Пропустить онбординг'});if(await skip.count())await skip.click();
 const banner=page.getByRole('link',{name:'Тестовая партнёрская кампания'});
 await expect(banner).toBeVisible();await expect(banner).toHaveAttribute('href','https://example.com/promo');
 await expect(page.getByText('Открыть предложение',{exact:true})).toBeVisible();
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
 await expect(page.getByRole('heading',{name:'Командный центр'})).toBeVisible();
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
 await expect(page.getByRole('button',{name:'Отправить заявку',exact:true})).toBeDisabled();
 await page.getByRole('checkbox',{name:/Я даю согласие/}).check();
 await page.getByRole('button',{name:'Отправить заявку',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Обращение создано'})).toBeVisible();
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

test('CRM mobile: ипотечный контекст читаемый, заметка менеджера остаётся ручной',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/pulsedv/mini-app/');await page.getByRole('button',{name:'Пропустить онбординг'}).click();
 await page.goto('/pulsedv/mini-app/#/mortgage');await page.getByRole('button',{name:'Получить точный расчёт',exact:true}).click();
 await page.getByRole('textbox',{name:'Как к вам обращаться'}).fill('Ипотечный тест');await page.getByRole('textbox',{name:'Телефон',exact:true}).fill('+79990000077');await page.getByRole('checkbox',{name:/Я даю согласие/}).check();await page.getByRole('button',{name:'Отправить заявку',exact:true}).click();
 await page.goto('/pulsedv/control-center/#/leads');await page.locator('.leadRowButton').filter({hasText:'Ипотечный тест'}).click();
 const drawer=page.getByRole('dialog',{name:'Карточка клиента'});const context=drawer.getByRole('region',{name:'Контекст обращения'});
 await expect(context).toContainText('Ипотечный расчёт');await expect(context).toContainText('Семейная ипотека');await expect(context).toContainText('Первоначальный взнос');await expect(context).toContainText('Платёж ≈');
 await expect(drawer.getByLabel('Заметка менеджера')).toHaveValue('');await expect(drawer.getByRole('button',{name:'Сохранить карточку'})).toBeInViewport();
 await drawer.getByRole('button',{name:'Закрыть'}).click();await expect(drawer).not.toBeVisible();
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

for(const width of [390,1440])test(`Journey ${width}px: manager collection, client feedback, showing and next step`,async({page})=>{
 test.setTimeout(90000);await page.setViewportSize({width,height:1000});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/pulsedv/mini-app/?utm_source=test&utm_campaign=journey');await page.getByRole('button',{name:'Пропустить онбординг'}).click();
 await page.goto('/pulsedv/mini-app/#/property/solnechniy');await page.getByRole('button',{name:'Узнать наличие',exact:true}).click();await page.getByRole('textbox',{name:'Как к вам обращаться'}).fill('Тест сопровождения');await page.getByRole('textbox',{name:'Телефон',exact:true}).fill('+79990000001');await page.getByRole('checkbox',{name:/Я даю согласие/}).check();await page.getByRole('button',{name:'Отправить заявку',exact:true}).click();await expect(page.getByRole('heading',{name:'Обращение создано'})).toBeVisible();
 await page.goto('/pulsedv/control-center/#/leads');await page.locator('.leadRowButton').filter({hasText:'Тест сопровождения'}).click();
 const panel=page.getByRole('region',{name:'Подборки и показы',exact:true});
 await panel.getByRole('tab',{name:/Подборки/}).focus();await page.keyboard.press('Enter');
 await panel.getByText('Создать подборку',{exact:true}).click();await panel.getByRole('checkbox',{name:'ЖК Солнечный',exact:true}).check();await panel.getByRole('textbox',{name:'Почему подходит ЖК Солнечный'}).fill('Рядом с морем');await panel.getByRole('button',{name:'Сохранить черновик'}).click();await expect(panel.getByText('Черновик',{exact:true})).toBeVisible();await panel.getByRole('button',{name:'Опубликовать клиенту'}).click();await expect(panel.getByRole('button',{name:'Снять с публикации'})).toBeVisible();
 await panel.getByRole('tab',{name:/Показы/}).focus();await page.keyboard.press('Enter');await panel.getByText('Запросить время показа',{exact:true}).click();await panel.getByRole('combobox',{name:'ЖК',exact:true}).selectOption('solnechniy');await panel.getByLabel('Дата и время (Владивосток)',{exact:true}).fill('2026-09-01T12:00');await expect(panel.getByRole('button',{name:'Запросить показ',exact:true})).toBeDisabled();await expect(panel.getByText('Выберите будущее время по Владивостоку.')).toBeVisible();await panel.getByText('Запланировать действие',{exact:true}).click();await panel.getByRole('textbox',{name:'Что сделать',exact:true}).fill('Обсудить подборку');await panel.getByLabel('Срок (Владивосток)',{exact:true}).fill('2027-01-01T12:00');await panel.getByRole('button',{name:'Сохранить следующий шаг'}).click();await expect(panel.getByText('Обсудить подборку',{exact:true})).toBeVisible();
 await page.goto('/pulsedv/mini-app/#/journey');await page.getByRole('link').filter({hasText:'ЖК Солнечный'}).click();await page.getByRole('tab',{name:/Подборки/}).click();const client=page.getByRole('tabpanel');await expect(client.getByText('Рядом с морем',{exact:true})).toBeVisible();await expect(client.getByText('от 6,2 млн ₽',{exact:true})).toBeVisible();await client.getByRole('combobox',{name:'Ваше мнение'}).selectOption('liked');await expect(client.getByRole('combobox',{name:'Ваше мнение'})).toHaveValue('liked');await client.getByRole('link').filter({hasText:'ЖК Солнечный'}).click();await page.getByRole('link',{name:'Назад',exact:true}).click();await expect(page.getByRole('tab',{name:/Подборки/})).toHaveAttribute('aria-selected','true');
 await page.getByRole('tab',{name:/Показы/}).click();await client.getByText('Запросить время показа',{exact:true}).click();await client.getByRole('combobox',{name:'ЖК',exact:true}).selectOption('solnechniy');const showingInput=client.getByLabel('Дата и время (Владивосток)',{exact:true});await showingInput.fill('2026-09-01T12:00');await expect(client.getByRole('button',{name:'Запросить показ',exact:true})).toBeDisabled();await expect(client.getByText('Выберите будущее время по Владивостоку.')).toBeVisible();const date=new Date(Date.now()+2*86400000).toISOString().slice(0,10)+'T14:00';await showingInput.fill(date);const showingsLayout=await client.evaluate(panel=>{const input=panel.querySelector('input[type="datetime-local"]') as HTMLInputElement|null;const box=input?.getBoundingClientRect();const style=getComputedStyle(panel);return{overflowY:style.overflowY,panelScrollHeight:panel.scrollHeight,panelClientHeight:panel.clientHeight,inputLeft:box?.left??0,inputRight:box?.right??0,viewportWidth:innerWidth,documentWidth:document.documentElement.scrollWidth}});expect(showingsLayout.overflowY).toBe('visible');expect(showingsLayout.panelScrollHeight).toBeLessThanOrEqual(showingsLayout.panelClientHeight+1);expect(showingsLayout.inputLeft).toBeGreaterThanOrEqual(0);expect(showingsLayout.inputRight).toBeLessThanOrEqual(showingsLayout.viewportWidth+1);expect(showingsLayout.documentWidth).toBeLessThanOrEqual(showingsLayout.viewportWidth+1);await page.screenshot({path:`test-results/journey-showings-${width}.png`,fullPage:true,animations:'disabled'});await client.getByRole('button',{name:'Запросить показ',exact:true}).click();await expect(client.getByText(/Ожидает подтверждения/)).toBeVisible();
 await page.goto('/pulsedv/control-center/#/leads');await page.locator('.leadRowButton').filter({hasText:'Тест сопровождения'}).click();await panel.getByRole('tab',{name:/Подборки/}).focus();await page.keyboard.press('Enter');await expect(panel.getByText('Подходит',{exact:true})).toBeVisible();await panel.getByRole('tab',{name:/Показы/}).focus();await page.keyboard.press('Enter');await panel.getByRole('button',{name:'Подтверждён',exact:true}).click();await expect(panel.getByText('Подтверждён',{exact:true})).toBeVisible();await panel.getByLabel('Результат / причина',{exact:true}).fill('Понравился двор');await panel.getByRole('button',{name:'Состоялся',exact:true}).click();await expect(panel.getByText('Понравился двор',{exact:true})).toBeVisible();
 await page.goto('/pulsedv/control-center/#/journey');await expect(page.getByRole('heading',{name:'Календарь показов'})).toBeVisible();await expect(page.getByText('Понравился двор',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([]);await page.screenshot({path:`test-results/journey-${width}.png`,fullPage:true});
});

test('Клиент: поиск и избранное сохраняют контекст возврата, уведомления без заглушек',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/pulsedv/mini-app/');await page.getByRole('button',{name:'Пропустить онбординг'}).click();
 await page.getByRole('button',{name:'Уведомления',exact:true}).click();
 await expect(page.getByRole('dialog').getByText('Старт продаж',{exact:true})).toHaveCount(0);
 await expect(page.getByText(/Новых обновлений пока нет/)).toBeVisible();
 await page.keyboard.press('Escape');
 await page.getByRole('navigation').getByRole('button',{name:'Каталог',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Новостройки',exact:true})).toBeVisible();
 await page.getByRole('textbox',{name:'Поиск'}).fill('Солнечный');
 await page.getByRole('link',{name:'Открыть ЖК Солнечный'}).click();
 await page.getByRole('link',{name:'Назад',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Поиск'})).toHaveValue('Солнечный');
 await expect(page.getByRole('link',{name:/Открыть ЖК/})).toHaveCount(1);
 await page.getByRole('button',{name:'Добавить в избранное'}).click();
 await page.getByRole('navigation').getByRole('button',{name:'Избранное',exact:true}).click();
 await page.getByRole('link',{name:'Открыть ЖК Солнечный'}).click();await page.getByRole('link',{name:'Назад',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Избранное',exact:true})).toBeVisible();
 await page.getByRole('navigation').getByRole('button',{name:'Главная',exact:true}).click();await expect(page.getByRole('region',{name:'Продолжить выбор'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('Клиент: конкретная планировка, переход после заявки, сообщение и отмена показа',async({page})=>{
 test.setTimeout(90000);
 await page.setViewportSize({width:390,height:844});
 await page.goto('/pulsedv/mini-app/');await page.getByRole('button',{name:'Пропустить онбординг'}).click();
 await page.getByRole('link',{name:'Открыть ЖК Приморский'}).click();
 await page.getByRole('button',{name:'Открыть планировку 1',exact:true}).click();
 await expect(page.getByRole('heading',{name:'ЖК Приморский · 1 комн.'})).toBeVisible();
 await page.getByRole('button',{name:'Интересует эта планировка',exact:true}).click();
 await page.getByRole('textbox',{name:'Как к вам обращаться'}).fill('Тест планировки');
 await page.getByRole('textbox',{name:'Телефон'}).fill('+79990000005');
 await page.getByRole('checkbox',{name:/Я даю согласие/}).check();
 await page.getByRole('button',{name:'Отправить заявку'}).click();
 await page.getByRole('link',{name:'Открыть моё обращение'}).click();
 await expect(page.getByRole('log',{name:'Переписка по обращению'})).toBeVisible();
 await page.getByLabel('Сообщение',{exact:true}).fill('Хочу уточнить этаж');await page.getByRole('button',{name:'Отправить сообщение'}).click();
 await expect(page.getByText('Хочу уточнить этаж',{exact:true})).toBeVisible();
 await page.getByRole('tab',{name:/Показы/}).click();await page.getByText('Запросить время показа',{exact:true}).click();await page.getByLabel('ЖК',{exact:true}).selectOption('primorskiy');
 const future=new Date(Date.now()+3*86400000).toISOString().slice(0,16);
 await page.getByLabel('Дата и время (Владивосток)',{exact:true}).fill(future);await page.getByRole('button',{name:'Запросить показ',exact:true}).click();
 await page.getByText('Изменить или отменить показ',{exact:true}).click();await page.getByRole('button',{name:'Отменить показ',exact:true}).click();await expect(page.getByText('Отменён',{exact:true})).toBeVisible();
 await page.goto('/pulsedv/control-center/#/leads');await page.locator('.leadRowButton').filter({hasText:'Тест планировки'}).click();
 await expect(page.getByLabel('Заметка менеджера')).toHaveValue('');await expect(page.getByRole('region',{name:'Контекст обращения'})).toContainText('Интерес к планировке');await expect(page.getByRole('region',{name:'Контекст обращения'})).toContainText('1 комн.');
 await expect(page.getByText(/Переписка по обращению/)).toBeVisible();await expect(page.getByText('Хочу уточнить этаж',{exact:true})).toBeVisible();
 await page.getByLabel('Сообщение',{exact:true}).fill('Уточняю наличие');await page.getByRole('button',{name:'Отправить сообщение'}).click();
 await page.goto('/pulsedv/mini-app/');await page.getByRole('button',{name:/Уведомления, новых/}).click();await expect(page.getByRole('link',{name:/Сообщение от менеджера/})).toBeVisible();
});

test('Клиент: понятные уведомления, пустые обращения и скрываемое продолжение',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/pulsedv/mini-app/');await page.getByRole('button',{name:'Пропустить онбординг'}).click();
 await page.getByRole('button',{name:'Уведомления',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Вы ничего не пропустили'})).toBeVisible();
 await page.getByRole('button',{name:'Закрыть уведомления',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:'Уведомления',exact:true}).click();
 await page.screenshot({path:'test-results/client-notifications.png',animations:'disabled'});
 await page.getByRole('link',{name:'Помощь с покупкой',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Найдём квартиру вместе'})).toBeVisible();
 await page.screenshot({path:'test-results/client-journey-empty.png',fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:'Обсудить покупку'}).click();
 await expect(page.getByRole('textbox',{name:'Телефон'})).toBeVisible();
 await page.keyboard.press('Escape');
 await page.getByRole('link',{name:'Пока посмотрю каталог'}).click();
 await expect(page.getByRole('textbox',{name:'Поиск'})).toBeVisible();
 await page.getByRole('navigation').getByRole('button',{name:'Подбор',exact:true}).click();
 await page.getByRole('navigation').getByRole('button',{name:'Главная',exact:true}).click();
 await expect(page.getByRole('region',{name:'Продолжить выбор'})).toHaveCount(0);
 await page.getByRole('link',{name:'Открыть ЖК Приморский'}).click();
 await page.getByRole('link',{name:'Назад',exact:true}).click();
 await page.getByRole('navigation').getByRole('button',{name:'Главная',exact:true}).click();
 await expect(page.getByRole('region',{name:'Продолжить выбор'})).toBeVisible();
 await page.screenshot({path:'test-results/client-resume.png',fullPage:true});
 await page.getByRole('button',{name:'Скрыть продолжение выбора'}).click();
 await page.reload();await expect(page.getByRole('region',{name:'Продолжить выбор'})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

for(const width of [320,390])test(`Переписка ${width}px: черновик, сообщения менеджера, вкладки и высота экрана`,async({page,context})=>{
 test.setTimeout(90000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width,height:844});
 await page.goto('/pulsedv/mini-app/');await page.getByRole('button',{name:'Пропустить онбординг'}).click();
 await page.goto('/pulsedv/mini-app/#/journey');await page.getByRole('button',{name:'Обсудить покупку'}).click();
 await page.getByLabel('Как к вам обращаться').fill('Тест мессенджера '+width);await page.getByLabel('Телефон',{exact:true}).fill('+79990000320');await page.getByRole('checkbox',{name:/Я даю согласие/}).check();await page.getByRole('button',{name:'Отправить заявку',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Обращение создано'})).toBeVisible();
 await page.screenshot({path:`test-results/chat-success-${width}.png`,animations:'disabled'});
 await page.getByRole('link',{name:'Открыть моё обращение'}).click();
 await expect(page.getByRole('log')).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Основная навигация'})).toHaveCount(0);
 await page.getByLabel('Сообщение',{exact:true}).fill('Черновик пожеланий');
 await page.getByRole('tab',{name:/Подборки/}).click();await expect(page.getByRole('heading',{name:'Здесь будет ваша подборка'})).toBeVisible();
 await page.getByRole('tab',{name:'Переписка',exact:true}).click();await expect(page.getByLabel('Сообщение',{exact:true})).toHaveValue('Черновик пожеланий');
 await page.reload();await expect(page.getByLabel('Сообщение',{exact:true})).toHaveValue('Черновик пожеланий');
 await page.getByLabel('Сообщение',{exact:true}).fill('Нужна квартира для семьи\nБюджет до 10 млн');
 if(width===390){
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='pulse.dv.journeys.v1'){Storage.prototype.setItem=original;throw new Error('Не удалось отправить тестовое сообщение')}return original.call(this,key,value)}});
  await page.getByRole('button',{name:'Отправить сообщение'}).click();await expect(page.getByRole('alert')).toContainText('Не удалось отправить');await expect(page.getByLabel('Сообщение',{exact:true})).toHaveValue('Нужна квартира для семьи\nБюджет до 10 млн');
 }
 await page.getByRole('button',{name:'Отправить сообщение'}).click();
 await expect(page.getByRole('article',{name:'Ваше сообщение'})).toHaveCount(1);await expect(page.getByLabel('Сообщение',{exact:true})).toHaveValue('');
 await page.getByRole('button',{name:'Добавить вложение'}).click();await page.getByLabel('Выбрать файл').setInputFiles({name:'plan.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n')});await expect(page.getByText('plan.pdf',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Отправить сообщение'}).click();await expect(page.getByRole('link',{name:/plan.pdf/})).toBeVisible();
 const manager=await context.newPage();await manager.goto('/pulsedv/control-center/#/leads');await manager.locator('.leadRowButton').filter({hasText:'Тест мессенджера '+width}).click();await expect(manager.getByText(/Переписка по обращению/)).toBeVisible();await expect(manager.getByText(/Нужна квартира для семьи/)).toBeVisible();await expect(manager.getByRole('button',{name:'Добавить вложение'})).toBeVisible();await expect(page.getByLabel('Прочитано')).toHaveCount(2,{timeout:20000});await manager.getByLabel('Сообщение',{exact:true}).fill('Подготовлю варианты под ваш бюджет. Какой район удобнее?');await manager.getByRole('button',{name:'Отправить сообщение'}).click();
 await expect(page.getByRole('article',{name:'Сообщение менеджера'})).toBeVisible({timeout:20000});
 await page.screenshot({path:`test-results/chat-conversation-${width}.png`,animations:'disabled'});
 await page.setViewportSize({width,height:470});
 await page.getByLabel('Сообщение',{exact:true}).fill('Рассматриваем центр');
 await expect(page.getByRole('button',{name:'Отправить сообщение'})).toBeInViewport();
 await expect(page.getByRole('article',{name:'Сообщение менеджера'})).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:`test-results/chat-short-${width}.png`,animations:'disabled'});
 await page.getByRole('link',{name:'Все мои обращения',exact:true}).click();
 await expect(page.getByRole('link').filter({hasText:'Какой район удобнее?'})).toBeVisible();
 await expect(page.getByRole('link',{name:'На главную',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Профиль',exact:true})).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Основная навигация'})).toBeVisible();
 await page.setViewportSize({width,height:844});await page.screenshot({path:`test-results/chat-inbox-${width}.png`,animations:'disabled'});
 expect(errors).toEqual([]);await manager.close();
});


const controlAuditRoutes=[
 ['overview','/','Командный центр'],
 ['leads','/leads','Лиды'],
 ['users','/users','Посетители и интерес'],
 ['journey','/journey','Сопровождение клиентов'],
 ['tasks','/tasks','Задачи под контролем'],
 ['objects','/objects','Объекты'],
 ['mortgage','/mortgage','Ипотека'],
 ['select','/select','PULSE Select'],
 ['content','/content','Контент'],
 ['analytics','/analytics','Аналитика'],
 ['settings','/settings','Настройки'],
] as const;

for(const width of [390,1440])test(`Control visual audit ${width}px: every workspace page`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 for(const [slug,route,title] of controlAuditRoutes){
  await page.goto('/pulsedv/control-center/#'+route);
  await expect(page.getByRole('heading',{name:title,level:1})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await page.screenshot({path:`test-results/control-audit-${slug}-${width}.png`,fullPage:true});
 }
 expect(errors).toEqual([]);
});
