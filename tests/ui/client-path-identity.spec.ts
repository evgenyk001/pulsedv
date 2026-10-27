import {test,expect} from '@playwright/test';

test('Control shows registered client identity in the activity path and supports identity search',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});
 await page.addInitScript(()=>{
  localStorage.setItem('pulse.dv.control.profiles.v1',JSON.stringify([{
   id:'profile',sessionId:'e9a67671-session',userId:'user',score:10,priority:'cold',scoreReasons:[],topPropertyId:null,city:null,mortgageProgram:null,nextAction:'Уточнить пожелания',eventCount:1,
   firstSeenAt:new Date().toISOString(),lastSeenAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
   client:{firstName:'Анна',lastName:'Иванова',phone:'+79991234567',username:'anna',telegramId:'123456789'}
  }]));
 });
 await page.goto('/pulsedv/control-center/#/users');
 const search=page.getByRole('textbox',{name:'Поиск посетителя'});
 for(const term of ['Анна','79991234567','anna','123456789']){
  await search.fill(term);await expect(page.locator('.leadRowButton').filter({hasText:'Анна Иванова'})).toBeVisible();
 }
 await search.fill('');await page.locator('.leadRowButton').filter({hasText:'Анна Иванова'}).click();
 const drawer=page.getByRole('dialog',{name:'Профиль посетителя'});
 await expect(drawer.getByRole('heading',{name:'Анна Иванова'})).toBeVisible();
 await expect(drawer.getByRole('link',{name:'+79991234567'})).toHaveAttribute('href','tel:+79991234567');
 await expect(drawer.getByRole('link',{name:'@anna'})).toHaveAttribute('href','https://t.me/anna');
 await expect(drawer.getByText('Telegram ID: 123456789')).toBeVisible();
 await expect(drawer.getByRole('heading',{name:/Посетитель/})).toHaveCount(0);
});
