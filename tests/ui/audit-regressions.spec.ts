import {test,expect,type Page} from '@playwright/test';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';
const rub=(n:number)=>n.toLocaleString('ru-RU');
async function seed(page:Page){await page.addInitScript(state=>{if(!localStorage.getItem('pulse.dv.control.state.v1'))localStorage.setItem('pulse.dv.control.state.v1',JSON.stringify(state));localStorage.setItem('pulse_onboarding_version',state.content.onboardingVersion);localStorage.setItem('pulse_mortgage_intro_version','mortgage_intro_v5')},DEFAULT_STATE)}

test('Consent reading preserves the open property form and typed contact',async({page})=>{
 await seed(page);await page.goto('/pulsedv/mini-app/#/property/'+DEFAULT_STATE.properties[0].id);
 await page.getByRole('button',{name:'Узнать наличие',exact:true}).click();
 await page.getByRole('textbox',{name:'Как к вам обращаться'}).fill('Проверка черновика');await page.getByRole('textbox',{name:'Телефон',exact:true}).fill('+79990000000');
 const url=page.url();await page.getByRole('button',{name:'согласие на обработку персональных данных',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Согласие на обработку данных',exact:true})).toBeVisible();await expect(page).toHaveURL(url);
 await page.getByRole('button',{name:'Вернуться к заявке',exact:true}).click();await expect(page.getByRole('textbox',{name:'Как к вам обращаться'})).toHaveValue('Проверка черновика');await expect(page.getByRole('textbox',{name:'Телефон',exact:true})).toHaveValue('+79990000000');
});

test('Empty market rate restores the previous rate, and an object-specific deposit survives reload',async({page})=>{
 await seed(page);await page.goto('/pulsedv/mini-app/#/mortgage?price=7800000&property='+DEFAULT_STATE.properties[0].id+'&down=min');
 await page.getByRole('combobox',{name:'Ипотечная программа'}).selectOption('standard');
 const rate=page.getByRole('textbox',{name:'Рыночная ставка, %'}),previous=await rate.inputValue();await rate.fill('');await rate.blur();await expect(rate).toHaveValue(previous);
 const down=page.getByRole('textbox',{name:'Первоначальный взнос',exact:true});await down.fill('2123456');await down.blur();await expect(down).toHaveValue(rub(2123456));await page.reload();await expect(down).toHaveValue(rub(2123456));
});

test('Select reads a normal ruble budget and preserves zero deposit and precise cash entry',async({page})=>{
 await seed(page);await page.goto('/pulsedv/mini-app/#/selection');
 await page.getByRole('textbox',{name:'Опишите квартиру своими словами'}).fill('Двушка во Владивостоке, 30 000 рублей в месяц');await page.getByRole('button',{name:'Понять запрос',exact:true}).click();
 await page.getByRole('button',{name:/Как покупаем/}).click();
 const payment=page.getByRole('textbox',{name:'Комфортный платёж',exact:true});await expect(payment).toHaveValue(rub(30000));
 const down=page.getByRole('textbox',{name:'Первоначальный взнос',exact:true});await down.fill('0');await down.blur();await expect(down).toHaveValue('0');await payment.fill('37500');await payment.blur();await expect(payment).toHaveValue(rub(37500));
});

test('Demo reservation form never pretends to check a shared CRM',async({page})=>{
 await seed(page);await page.goto('/pulsedv/mini-app/#/partners');await page.getByRole('textbox',{name:'Ваше имя для приглашения'}).fill('Тестовый партнёр');await page.getByRole('textbox',{name:'Ваш контактный телефон'}).fill('+79995550101');await page.getByRole('checkbox',{name:/Принимаю условия программы/}).check();await page.getByRole('button',{name:'Стать партнёром PULSE'}).click();
 await page.getByRole('button',{name:'Проверить и закрепить клиента',exact:true}).click();await expect(page.getByText(/Проверка номеров недоступна в тестовой версии/)).toBeVisible();await expect(page.getByRole('button',{name:'Проверить и забронировать',exact:true})).toBeDisabled();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
