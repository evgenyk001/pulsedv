import {test,expect} from '@playwright/test';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';
import {OFFER_VERSION} from '../../packages/partners/offer';
import {emptyPayout} from '../../packages/partners/payout';

for(const width of [390,1440])test(`Partner receiving ${width}px: arrange office pickup in Control, partner sees appointment and can request changes`,async({page,browserName})=>{
 await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(({state,version,payout})=>{
  localStorage.setItem('pulse.partner.guide.v1','seen');localStorage.setItem('pulse_onboarding_version',state.content.onboardingVersion);
  if(!localStorage.getItem('pulse.dv.control.state.v1'))localStorage.setItem('pulse.dv.control.state.v1',JSON.stringify(state));
  if(localStorage.getItem('pulse.partners.v1'))return;
  const now=new Date().toISOString();
  localStorage.setItem('pulse.partners.v1',JSON.stringify({myPartnerId:'partner',partners:[{id:'partner',name:'Анна Иванова',phone:'+79995550101',code:'p01234567890123456789',status:'active',termsVersion:version,createdAt:now}],invitations:[],referrals:[{id:'referral',partnerId:'partner',partnerName:'Анна Иванова',leadId:null,invitationId:null,clientName:'Иван Покупатель',termsVersion:version,status:'accepted',stage:'deal',conflict:false,rejectionReason:null,revision:2,createdAt:now,acceptedAt:now,events:[],phone:'+79995550202'}],rewards:[{id:'reward',referralId:'referral',commissionRub:100000,reserveMinor:600000,baseMinor:9400000,grossMinor:2820000,status:'requested',recipientType:'person',requestedAt:now,paidOn:null,withheldMinor:0,paidMinor:0,revision:2,createdAt:now,payoutDetails:payout,payoutStage:'details_received'}]}));
 },{state:DEFAULT_STATE,version:OFFER_VERSION,payout:{...emptyPayout('Анна Иванова','+79995550101'),method:'cash'}});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/pulsedv/control-center/#/partners?referral=referral');
 const control=page.getByRole('dialog',{name:'Партнёрская рекомендация'}),receiving=control.getByRole('region',{name:'Согласование получения вознаграждения'});
 await expect(control.getByRole('region',{name:'Следующее действие'})).toContainText('Согласуйте получение с партнёром');
 await expect(receiving.getByRole('link',{name:'Позвонить партнёру'})).toHaveAttribute('href','tel:+79995550101');
 const agree=receiving.getByRole('button',{name:'Подтвердить договорённость'});await expect(agree).toBeDisabled();
 await receiving.getByLabel('Адрес офиса для получения').fill('Владивосток, Тестовая улица, 1, офис 2');
 page.once('dialog',dialog=>dialog.dismiss());await control.getByRole('button',{name:'Закрыть рекомендацию'}).click();await expect(control).toBeVisible();
 await receiving.getByLabel('Когда приехать (Владивосток)').fill(new Date(Date.now()+86400000+10*3600000).toISOString().slice(0,16));
 await receiving.getByLabel('Сообщение партнёру').fill('Позвоните перед приездом');
 await expect(agree).toBeDisabled();await receiving.getByRole('checkbox',{name:'Согласовали способ получения с партнёром и проверили данные получателя'}).check();await agree.click();
 await expect(receiving.getByText('Получение согласовано',{exact:true})).toBeVisible();await expect(receiving).toContainText('Владивосток, Тестовая улица, 1, офис 2');
 await expect(control.getByRole('checkbox',{name:'Документы проверены, наличные выданы'})).not.toBeChecked();await expect(control.getByRole('button',{name:'Зафиксировать выплату'})).toBeDisabled();
 await receiving.scrollIntoViewIfNeeded();await page.screenshot({path:`test-results/partner-office-control-${browserName}-${width}.png`,animations:'disabled'});
 await page.goto('/pulsedv/mini-app/#/partners?referral=referral');const partner=page.getByRole('dialog',{name:'Иван П.'});
 await expect(partner).toContainText('Способ получения согласован');await expect(partner).toContainText('Владивосток, Тестовая улица, 1, офис 2');await expect(partner).toContainText('Позвоните перед приездом');await expect(partner).not.toContainText('+79995550202');
 await partner.getByRole('region',{name:'Получение вознаграждения'}).scrollIntoViewIfNeeded();await page.screenshot({path:`test-results/partner-office-mini-${browserName}-${width}.png`,animations:'disabled'});
 await partner.getByRole('button',{name:'Нужно изменить договорённость'}).click();await expect(partner.getByRole('combobox',{name:'Как получить деньги'})).toBeVisible();
 await page.goto('/pulsedv/control-center/#/partners?referral=referral');await expect(receiving.getByText('Нужно согласовать получение',{exact:true})).toBeVisible();await expect(control.getByRole('button',{name:'Зафиксировать выплату'})).toBeDisabled();
 await control.getByRole('button',{name:'История',exact:true}).click();await expect(control.getByText('Партнёр попросил изменить договорённость о получении',{exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([]);
});
