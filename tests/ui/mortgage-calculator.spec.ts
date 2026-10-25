import {test,expect} from '@playwright/test';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';

const rub=(value:number)=>new Intl.NumberFormat('ru-RU').format(value);

for(const width of [320,390,430]){
 test(`Mortgage exact deposit, cash entry and restoration at ${width}px`,async({page,browserName})=>{
  await page.setViewportSize({width,height:844});
  await page.goto('/pulsedv/mini-app/#/mortgage?price=7500000');
  const story=page.getByRole('dialog',{name:'Знакомство с ипотекой',exact:true});
  await expect(story).toBeVisible();
  await story.getByRole('button',{name:'Закрыть знакомство с ипотекой'}).click();
  const price=page.getByRole('textbox',{name:'Стоимость недвижимости',exact:true});
  const down=page.getByRole('textbox',{name:'Первоначальный взнос',exact:true});
  const slider=page.getByRole('slider',{name:'Первоначальный взнос, %'});
  await page.getByRole('combobox',{name:'Количество детей',exact:true}).selectOption('2');
  await expect(down).toHaveValue(rub(1507500));
  await expect(page.getByText('Минимальный взнос: 20,1% · 1 507 500 ₽',{exact:true})).toBeVisible();
  await expect(page.getByText('20,1% · 1 507 500 ₽',{exact:true})).toBeVisible();
  await expect(page.getByText('Льготная часть — до 8 000 000 ₽ под 8%')).toBeVisible();
  await expect(page.getByText('5 992 500 ₽',{exact:true}).first()).toBeVisible();
  const rate=.08/12,months=180;
  const payment=Math.round(5_992_500*rate*Math.pow(1+rate,months)/(Math.pow(1+rate,months)-1));
  await expect(page.getByText(new Intl.NumberFormat('ru-RU').format(payment)+' ₽ / мес',{exact:true})).toBeVisible();
  await slider.focus();await page.keyboard.press('ArrowRight');
  await expect(down).toHaveValue(rub(1515000));
  await page.keyboard.press('Home');await expect(down).toHaveValue(rub(1507500));
  await price.fill('');await expect(price).toHaveValue('');
  await price.pressSequentially('7543219');await price.blur();
  await expect(price).toHaveValue(rub(7543219));
  await expect(down).toHaveValue(rub(1516188));
  await down.fill('');await expect(down).toHaveValue('');
  await down.pressSequentially('2123456');await down.blur();
  await expect(down).toHaveValue(rub(2123456));
  await price.fill('6500000');await price.blur();
  await expect(down).toHaveValue(rub(2123456));
  // Remove the incoming price override; returning should restore the last calculation.
  await page.goto('/pulsedv/mini-app/#/mortgage');
  await expect(price).toHaveValue(rub(6500000));
  await expect(down).toHaveValue(rub(2123456));
  await page.reload();await expect(down).toHaveValue(rub(2123456));
  await slider.focus();await page.keyboard.press('Home');
  await expect(down).toHaveValue(rub(1306500));
  await price.fill('7500000');await price.blur();
  await down.fill('1507499');await down.blur();
  await expect(down).toHaveValue(rub(1507500));
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const calc=price.locator('xpath=ancestor::section[1]');
  await calc.screenshot({path:`test-results/mortgage-calculator-${browserName}-${width}.png`});
 });
}

test('Mortgage configuration, exact credit ceiling and short term stay consistent',async({page})=>{
 await page.goto('/pulsedv/control-center/#/mortgage');
 const family=page.locator('.mortgageProgram').filter({hasText:'Семейная'}).first();
 await family.getByLabel('Семейная — первоначальный взнос, %').fill('25');
 await family.getByLabel('Семейная — подсказка клиенту').fill('Проверьте документы с менеджером.');
 await family.getByLabel('Семейная — подсказка клиенту').blur();
 await expect(family).toContainText('25%');
 await page.goto('/pulsedv/mini-app/#/mortgage?price=7543219');
 const story=page.getByRole('dialog',{name:'Знакомство с ипотекой',exact:true});
 await expect(story).toBeVisible();await story.getByRole('button',{name:'Закрыть знакомство с ипотекой'}).click();
 const down=page.getByRole('textbox',{name:'Первоначальный взнос',exact:true});
 await expect(down).toHaveValue(rub(1885805));
 await expect(page.getByText(/Проверьте документы с менеджером\./)).toBeVisible();
 await page.getByRole('combobox',{name:'Ипотечная программа'}).selectOption('farEast');
 await expect(down).toHaveValue(rub(1543219));
 await down.fill('1543218');await down.blur();await expect(down).toHaveValue(rub(1543219));
 const depositSlider=page.getByRole('slider',{name:'Первоначальный взнос, %'});
 await depositSlider.focus();await depositSlider.press('ArrowRight');await depositSlider.press('Home');await expect(down).toHaveValue(rub(1543219));
 await expect(page.getByText('6 000 000 ₽',{exact:true}).first()).toBeVisible();
 await expect(page.getByText('Сумма кредита выше доступного лимита',{exact:true})).toHaveCount(0);
 const term=page.getByRole('slider',{name:'Срок кредита, лет'});
 await term.focus();await page.keyboard.press('Home');
 await expect(page.getByText('1 год',{exact:true})).toBeVisible();
});

for(const width of [320,390,430])test(`Mortgage second-period scenario stays explicit and restores at ${width}px`,async({page,browserName})=>{
 await page.setViewportSize({width,height:844});
 await page.goto('/pulsedv/mini-app/#/mortgage?price=7500000');
 await page.getByRole('button',{name:'Закрыть знакомство с ипотекой'}).click();
 const term=page.getByRole('slider',{name:'Срок кредита, лет'});await term.focus();await page.keyboard.press('End');
 const panel=page.getByRole('region',{name:'Расчёт после льготного периода'}),rate=panel.getByRole('textbox',{name:'Ставка после льготного периода, %'});
 await expect(rate).toHaveValue('');await expect(panel.getByText('Следующий платёж, сценарий')).toHaveCount(0);
 const first=await page.getByText(/₽ \/ мес$/).first().innerText();
 await rate.fill('18,55');await expect(panel.getByText('Следующий платёж, сценарий')).toBeVisible();await expect(panel).toContainText('Расчёт при вашей ставке 18,55%.');await expect(panel).not.toContainText('%%');
 await expect(page.getByText('Первые 15 лет · платёж')).toBeVisible();await expect(page.getByText(first,{exact:true}).first()).toBeVisible();
 await page.reload();await expect(rate).toHaveValue('18,55');await expect(panel.getByText('Переплата по сценарию')).toBeVisible();
 await rate.fill('41');await expect(panel.getByRole('alert')).toHaveText('Введите ставку от 0 до 40%.');await expect(panel.getByText('Следующий платёж, сценарий')).toHaveCount(0);
 await rate.fill('0');await expect(panel.getByText('Следующий платёж, сценарий')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await panel.screenshot({path:`test-results/mortgage-periods-${browserName}-${width}.png`});
 await term.focus();await page.keyboard.press('Home');await expect(panel).toHaveCount(0);
});

for(const width of [320,390,430])test(`Far East deposit follows the credit ceiling at ${width}px`,async({page,browserName})=>{
 await page.setViewportSize({width,height:844});
 await page.route('https://telegram.org/js/telegram-web-app.js',route=>route.fulfill({body:''}));
 await page.addInitScript(()=>{
  localStorage.setItem('pulse_mortgage_intro_version','mortgage_intro_v5');
  if(!localStorage.getItem('mortgage-ceiling-test')){
   localStorage.setItem('mortgage-ceiling-test','1');
   localStorage.setItem('pulse_mortgage_scenario_v1',JSON.stringify({programId:'farEast',propertyKind:'newbuild',price:10_000_000,down:2_010_000,largeArea:false,years:20}));
  }
 });
 await page.goto('/pulsedv/mini-app/#/mortgage');
 const price=page.getByRole('textbox',{name:'Стоимость недвижимости',exact:true}),down=page.getByRole('textbox',{name:'Первоначальный взнос',exact:true});
 const area=page.getByRole('switch',{name:'Повышенный лимит по площади',exact:true}),slider=page.getByRole('slider',{name:'Первоначальный взнос, %',exact:true});
 await expect(down).toHaveValue(rub(4_000_000));await expect(slider).toHaveAttribute('aria-valuemin','40');
 await expect(page.getByText('Минимальный взнос: 40% · 4 000 000 ₽',{exact:true})).toBeVisible();
 await down.fill('2010000');await down.blur();await expect(down).toHaveValue(rub(4_000_000));
 await area.check();await expect(down).toHaveValue(rub(2_010_000));
 await down.fill('5000000');await down.blur();await area.uncheck();await expect(down).toHaveValue(rub(5_000_000));
 await slider.focus();await slider.press('Home');await expect(down).toHaveValue(rub(4_000_000));
 await price.fill('12000000');await price.blur();await expect(down).toHaveValue(rub(6_000_000));
 await area.check();await expect(down).toHaveValue(rub(3_000_000));
 await price.fill('7500000');await price.blur();await expect(down).toHaveValue(rub(1_507_500));
 await page.getByRole('combobox',{name:'Ипотечная программа'}).selectOption('standard');
 await price.fill('10000000');await price.blur();await expect(down).toHaveValue(rub(2_010_000));
 await page.getByRole('combobox',{name:'Ипотечная программа'}).selectOption('farEast');await expect(down).toHaveValue(rub(4_000_000));
 await page.reload();await expect(down).toHaveValue(rub(4_000_000));
 await expect(page.getByText('Сумма кредита выше доступного лимита',{exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/mortgage-ceiling-${browserName}-${width}.png`,fullPage:true});
});

test('Property entry and linked calculator show the same limit-aware deposit',async({page})=>{
 const state=structuredClone(DEFAULT_STATE);state.properties[0].priceFrom=10;
 await page.route('https://telegram.org/js/telegram-web-app.js',route=>route.fulfill({body:''}));
 await page.addInitScript(state=>{
  localStorage.setItem('pulse.dv.control.state.v1',JSON.stringify(state));localStorage.setItem('pulse_onboarding_version',state.content.onboardingVersion);
  localStorage.setItem('pulse_mortgage_intro_version','mortgage_intro_v5');
  localStorage.setItem('pulse_mortgage_scenario_v1',JSON.stringify({programId:'farEast',propertyKind:'newbuild',price:10_000_000,down:2_010_000,largeArea:false,years:20}));
 },state);
 await page.goto('/pulsedv/mini-app/#/property/primorskiy');
 await expect(page.getByText('Первоначальный взнос от 40%',{exact:true})).toBeVisible();
 await page.getByRole('link',{name:/Рассчитать ипотеку/}).first().click();
 await expect(page.getByRole('textbox',{name:'Первоначальный взнос',exact:true})).toHaveValue(rub(4_000_000));
});

for(const width of [320,390,430])test(`All program ceilings require enough cash and preserve explicit combo choice at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});
 await page.route('https://telegram.org/js/telegram-web-app.js',route=>route.fulfill({body:''}));
 await page.addInitScript(()=>localStorage.setItem('pulse_mortgage_intro_version','mortgage_intro_v5'));
 await page.goto('/pulsedv/mini-app/#/mortgage?price=12800000');
 const down=page.getByRole('textbox',{name:'Первоначальный взнос',exact:true});
 const program=page.getByRole('combobox',{name:'Ипотечная программа'});
 const children=page.getByRole('combobox',{name:'Количество детей'});
 const combo=page.getByRole('switch',{name:'Комбинированная ипотека',exact:true});
 const term=page.getByRole('slider',{name:'Срок кредита, лет',exact:true});
 await expect(combo).not.toBeChecked();await expect(down).toHaveValue(rub(6_800_000));
 for(const [count,cash] of [['2',4_800_000],['3',2_800_000],['4',2_800_000],['5',2_800_000]] as const){
  await children.selectOption(count);await expect(down).toHaveValue(rub(cash));
 }
 await children.selectOption('1');await expect(down).toHaveValue(rub(6_800_000));
 await expect(page.getByText('Минимальный взнос: 53,125% · 6 800 000 ₽',{exact:true})).toBeVisible();
 await combo.check();await expect(down).toHaveValue(rub(2_572_800));
 await expect(page.getByText(/Рыночная часть:.*₽\/мес/)).toBeVisible();
 await page.reload();await expect(combo).toBeChecked();await expect(down).toHaveValue(rub(2_572_800));
 await combo.uncheck();await expect(down).toHaveValue(rub(6_800_000));
 await term.focus();await term.press('End');await expect(term).toHaveAttribute('aria-valuenow','30');
 await expect(page.getByRole('region',{name:'Расчёт после льготного периода'})).toBeVisible();
 await page.getByRole('combobox',{name:'Тип недвижимости'}).selectOption('house');
 await expect(page.getByRole('region',{name:'Расчёт после льготного периода'})).toHaveCount(0);
 await page.getByRole('combobox',{name:'Тип недвижимости'}).selectOption('newbuild');
 await program.selectOption('it');await expect(down).toHaveValue(rub(3_800_000));
 await expect(term).toHaveAttribute('aria-valuemax','30');
 await program.selectOption('farEast');await expect(down).toHaveValue(rub(6_800_000));
 await expect(term).toHaveAttribute('aria-valuemax','20');await expect(term).toHaveAttribute('aria-valuenow','20');
 await page.getByRole('switch',{name:'Повышенный лимит по площади'}).check();await expect(down).toHaveValue(rub(3_800_000));
 await program.selectOption('standard');await expect(down).toHaveValue(rub(2_572_800));
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('Family property quote uses the selected room, children and explicit combo consistently',async({page})=>{
 await page.route('https://telegram.org/js/telegram-web-app.js',route=>route.fulfill({body:''}));
 await page.addInitScript(state=>{
  if(!localStorage.getItem('mortgage-family-property-seeded')){
   localStorage.setItem('mortgage-family-property-seeded','1');
   localStorage.setItem('pulse.dv.control.state.v1',JSON.stringify(state));
   localStorage.setItem('pulse_mortgage_scenario_v1',JSON.stringify({programId:'family',propertyKind:'newbuild',childrenCount:1,hasYoungChild:true,years:40}));
   localStorage.setItem('pulse_mortgage_scenario_v1:property:primorskiy:index-2:',JSON.stringify({programId:'farEast',propertyKind:'newbuild',largeArea:true,years:20}));
  }
  localStorage.setItem('pulse_onboarding_version',state.content.onboardingVersion);
  localStorage.setItem('pulse_mortgage_intro_version','mortgage_intro_v5');
 },DEFAULT_STATE);
 await page.goto('/pulsedv/mini-app/#/property/primorskiy');
 await page.getByRole('button',{name:'Выбрать планировки: 3+',exact:true}).click();
 const section=page.getByRole('region',{name:'Квартиры и планировки ЖК'});
 await expect(section).toContainText('6 800 000 ₽');await expect(section).toContainText('С учётом лимита кредита 6 000 000 ₽');
 await section.getByRole('link',{name:'Рассчитать ипотеку',exact:true}).click();
 const down=page.getByRole('textbox',{name:'Первоначальный взнос',exact:true});
 await expect(down).toHaveValue(rub(6_800_000));
 await page.getByRole('combobox',{name:'Количество детей'}).selectOption('2');await expect(down).toHaveValue(rub(4_800_000));
 await page.getByRole('button',{name:'Вернуться к ЖК',exact:true}).click();
 await expect(section).toContainText('4 800 000 ₽');
 await section.getByRole('link',{name:'Рассчитать ипотеку',exact:true}).click();
 await page.getByRole('switch',{name:'Комбинированная ипотека',exact:true}).check();await expect(down).toHaveValue(rub(2_572_800));
 await page.getByRole('button',{name:'Вернуться к ЖК',exact:true}).click();await expect(section).toContainText('комбинированная');await expect(section).toContainText('2 572 800 ₽');
});

test('Far East property quote derives increased limit from the selected plan rather than another saved object',async({page})=>{
 await page.route('https://telegram.org/js/telegram-web-app.js',route=>route.fulfill({body:''}));
 await page.addInitScript(state=>{
  localStorage.setItem('pulse.dv.control.state.v1',JSON.stringify(state));localStorage.setItem('pulse_onboarding_version',state.content.onboardingVersion);
  localStorage.setItem('pulse_mortgage_intro_version','mortgage_intro_v5');
  localStorage.setItem('pulse_mortgage_scenario_v1',JSON.stringify({programId:'farEast',propertyKind:'newbuild',largeArea:true,years:20}));
 },DEFAULT_STATE);
 await page.goto('/pulsedv/mini-app/#/property/primorskiy');
 const section=page.getByRole('region',{name:'Квартиры и планировки ЖК'});
 await page.getByRole('button',{name:'Выбрать планировки: 3+',exact:true}).click();await expect(section).toContainText('3 800 000 ₽');
 await section.getByRole('link',{name:'Рассчитать ипотеку',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Первоначальный взнос',exact:true})).toHaveValue(rub(3_800_000));
 await expect(page.getByRole('switch',{name:'Повышенный лимит по площади'})).toBeChecked();
 await page.getByRole('button',{name:'Вернуться к ЖК',exact:true}).click();
 await page.getByRole('button',{name:'Выбрать планировки: 1',exact:true}).click();await expect(section).toContainText('1 800 000 ₽');
 await section.getByRole('link',{name:'Рассчитать ипотеку',exact:true}).click();
 await expect(page.getByRole('switch',{name:'Повышенный лимит по площади'})).not.toBeChecked();
 await expect(page.getByRole('textbox',{name:'Первоначальный взнос',exact:true})).toHaveValue(rub(1_800_000));
});
