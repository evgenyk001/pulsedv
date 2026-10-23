import {test,expect,type Page} from '@playwright/test';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';
import {OFFER_VERSION} from '../../packages/partners/offer';
const common='p01234567890123456789',personal='i01234567890123456789';
const attr='pulse.partner-invitation.v1';
async function fixture(page:Page,own=false,code=personal){
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(({state,own,code,common,personal,version,attr})=>{
  if(localStorage.getItem('test.attribution-seeded'))return;
  localStorage.setItem('test.attribution-seeded','1');
  localStorage.setItem('pulse_onboarding_version',state.content.onboardingVersion);
  localStorage.setItem('pulse.partner.guide.v1','seen');
  localStorage.setItem('pulse.dv.control.state.v1',JSON.stringify(state));
  const at=new Date().toISOString();
  localStorage.setItem('pulse.partners.v1',JSON.stringify({myPartnerId:own?'partner-1':null,partners:[{id:'partner-1',userId:null,name:'Евгений Козменко',phone:'+79995550101',code:common,status:'active',termsVersion:version,termsAcceptedAt:at,createdAt:at}],invitations:[{id:'invite-1',partnerId:'partner-1',code:personal,label:'Покупатель',createdAt:at}],referrals:[],rewards:[]}));
  localStorage.setItem(attr,JSON.stringify({code,partnerName:'Евгений Козменко',expiresAt:Date.now()+86400000}));
 },{state:DEFAULT_STATE,own,code,common,personal,version:OFFER_VERSION,attr});
}

for(const code of [common,personal])test(`Own saved invitation ${code[0]} does not appear in ordinary profile forms`,async({page})=>{
 await fixture(page,true,code);await page.goto('/pulsedv/mini-app/#/profile');
 for(const name of ['Оставить заявку менеджеру','Связаться с PULSEDV.RU']){
  await page.getByRole('button',{name,exact:true}).click();
  const form=page.getByRole('dialog');await expect(form.getByRole('checkbox')).toHaveCount(1);
  await expect(form).not.toContainText('меня пригласил');expect(await page.evaluate(key=>localStorage.getItem(key),attr)).toBeNull();
  await form.getByRole('button',{name:'Закрыть заявку',exact:true}).click();await expect(form).toHaveCount(0);
 }
});

test('Invitation preview cannot create a buyer form or remember its partner',async({page})=>{
 await fixture(page);await page.goto('/pulsedv/mini-app/#/partner-invite?code='+personal+'&preview=1');
 await expect(page.getByText(/Предпросмотр приглашения/)).toBeVisible();
 await expect(page.getByRole('button',{name:'Получить консультацию',exact:true})).toBeDisabled();
 expect(await page.evaluate(key=>localStorage.getItem(key),attr)).toBeNull();
 await page.goto('/pulsedv/mini-app/#/profile');await page.getByRole('button',{name:'Оставить заявку менеджеру',exact:true}).click();
 await expect(page.getByRole('dialog').getByRole('checkbox')).toHaveCount(1);
});

test('Ordinary agency contact ignores a remembered invitation without sharing buyer data',async({page})=>{
 await fixture(page);await page.goto('/pulsedv/mini-app/#/profile');await page.getByRole('button',{name:'Связаться с PULSEDV.RU',exact:true}).click();
 const form=page.getByRole('dialog');await expect(form.getByRole('checkbox')).toHaveCount(1);
 await expect(form).not.toContainText('Евгений Козменко');
 expect(await page.evaluate(key=>localStorage.getItem(key),attr)).not.toBeNull();
 await form.getByRole('textbox',{name:'Как к вам обращаться'}).fill('Прямой клиент');await form.getByRole('textbox',{name:'Телефон',exact:true}).fill('+79995550202');
 await form.getByRole('checkbox',{name:/Я даю согласие/}).check();await form.getByRole('button',{name:'Отправить заявку',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Обращение создано',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('pulse.partners.v1')!).referrals)).toHaveLength(0);
 await page.reload();await page.getByRole('button',{name:'Связаться с PULSEDV.RU',exact:true}).click();
 await expect(page.getByRole('dialog').getByRole('checkbox')).toHaveCount(1);
});

test('Ordinary manager contact ignores another partner invitation',async({page})=>{
 await fixture(page);await page.goto('/pulsedv/mini-app/#/profile');
 await page.getByRole('button',{name:'Оставить заявку менеджеру',exact:true}).click();
 const form=page.getByRole('dialog');await expect(form.getByRole('checkbox')).toHaveCount(1);
 await expect(form).not.toContainText('меня пригласил');
});

test('Expired invitation is rechecked when opening a form that was already mounted',async({page})=>{
 await fixture(page);await page.goto('/pulsedv/mini-app/#/profile');
 await expect(page.getByRole('button',{name:'Связаться с PULSEDV.RU',exact:true})).toBeVisible();
 await page.evaluate(key=>{const v=JSON.parse(localStorage.getItem(key)!);v.expiresAt=Date.now()-1;localStorage.setItem(key,JSON.stringify(v));},attr);
 await page.getByRole('button',{name:'Связаться с PULSEDV.RU',exact:true}).click();
 await expect(page.getByRole('dialog').getByRole('checkbox')).toHaveCount(1);
});

test('Opting out also suppresses the explicit invitation on reopening its form',async({page})=>{
 await fixture(page);await page.goto('/pulsedv/mini-app/#/partner-invite?code='+personal);
 await page.getByRole('button',{name:'Получить консультацию',exact:true}).click();
 const form=page.getByRole('dialog');await expect(form.getByRole('checkbox')).toHaveCount(2);
 await form.getByRole('button',{name:'Я обратился самостоятельно',exact:true}).click();
 await expect(form.getByRole('checkbox')).toHaveCount(1);
 await form.getByRole('button',{name:'Закрыть заявку',exact:true}).click();await expect(form).toHaveCount(0);
 await page.getByRole('button',{name:'Получить консультацию',exact:true}).click();await expect(form.getByRole('checkbox')).toHaveCount(1);
});
