import {test,expect} from '@playwright/test';

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
 await expect(down).toHaveValue(rub(1516188));
 await expect(page.getByText('Увеличьте первоначальный взнос минимум до 1 543 219 ₽')).toBeVisible();
 await down.fill('1543219');await down.blur();
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
