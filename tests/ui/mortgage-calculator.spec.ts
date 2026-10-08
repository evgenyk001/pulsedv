import {test,expect} from '@playwright/test';

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
  await page.getByRole('button',{name:'2',exact:true}).click();
  await expect(down).toHaveValue('1 507 500');
  await expect(page.getByText('Минимальный взнос: 20,1% · 1 507 500 ₽',{exact:true})).toBeVisible();
  await expect(page.getByText('20,1% · 1 507 500 ₽',{exact:true})).toBeVisible();
  await expect(page.getByText(/Льготная часть — до 8 000 000 ₽ под 8%/)).toBeVisible();
  await expect(page.getByText('5 992 500 ₽',{exact:true}).first()).toBeVisible();
  const rate=.08/12,months=180;
  const payment=Math.round(5_992_500*rate*Math.pow(1+rate,months)/(Math.pow(1+rate,months)-1));
  await expect(page.getByText(new Intl.NumberFormat('ru-RU').format(payment)+' ₽ / мес',{exact:true})).toBeVisible();
  await slider.focus();await page.keyboard.press('ArrowRight');
  await expect(down).toHaveValue('1 515 000');
  await page.keyboard.press('Home');await expect(down).toHaveValue('1 507 500');
  await price.fill('7543219');await price.blur();
  await expect(price).toHaveValue('7 543 219');
  await expect(down).toHaveValue('1 516 188');
  await down.fill('2123456');await down.blur();
  await expect(down).toHaveValue('2 123 456');
  await price.fill('6500000');await price.blur();
  await expect(down).toHaveValue('2 123 456');
  // Remove the incoming price override; returning should restore the last calculation.
  await page.goto('/pulsedv/mini-app/#/mortgage');
  await expect(price).toHaveValue('6 500 000');
  await expect(down).toHaveValue('2 123 456');
  await page.reload();await expect(down).toHaveValue('2 123 456');
  await slider.focus();await page.keyboard.press('Home');
  await expect(down).toHaveValue('1 306 500');
  await price.fill('7500000');await price.blur();
  await down.fill('1507499');await down.blur();
  await expect(down).toHaveValue('1 507 500');
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
 await page.getByRole('button',{name:'Сохранить',exact:true}).click();
 await page.goto('/pulsedv/mini-app/#/mortgage?price=7543219');
 const story=page.getByRole('dialog',{name:'Знакомство с ипотекой',exact:true});
 await expect(story).toBeVisible();await story.getByRole('button',{name:'Закрыть знакомство с ипотекой'}).click();
 const down=page.getByRole('textbox',{name:'Первоначальный взнос',exact:true});
 await expect(down).toHaveValue('1 885 805');
 await expect(page.getByText(/Проверьте документы с менеджером\./)).toBeVisible();
 await page.getByRole('button',{name:/Дальневосточная/}).click();
 await expect(down).toHaveValue('1 516 188');
 await expect(page.getByText(/Увеличьте первоначальный взнос минимум до 1 543 219 ₽/)).toBeVisible();
 await down.fill('1543219');await down.blur();
 await expect(page.getByText('6 000 000 ₽',{exact:true}).first()).toBeVisible();
 await expect(page.getByText('Сумма кредита выше доступного лимита',{exact:true})).toHaveCount(0);
 const term=page.getByRole('slider',{name:'Срок кредита, лет'});
 await term.focus();await page.keyboard.press('Home');
 await expect(page.getByText('1 год',{exact:true})).toBeVisible();
});
