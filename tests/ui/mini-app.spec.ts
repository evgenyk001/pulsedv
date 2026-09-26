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
 const catalogCard=page.locator('article').first();
 const detailsButton=catalogCard.getByRole('button',{name:'Все характеристики'});
 await expect(detailsButton).toBeVisible();
 await expect(catalogCard.getByRole('tablist',{name:/Планировки/})).toBeVisible();
 await detailsButton.click();
 await expect(catalogCard.getByText('Застройщик',{exact:true})).toBeVisible();
 await catalogCard.getByRole('button',{name:'Скрыть характеристики'}).click();
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
 await page.getByRole('link',{name:'Объекты',exact:true}).click();await page.getByRole('button',{name:'Добавить ЖК',exact:true}).click();
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
 await expect(page.getByText('PULSE MATCH').last()).toBeVisible();
});
