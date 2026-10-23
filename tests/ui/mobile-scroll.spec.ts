import {test,expect,type Page,type Locator} from '@playwright/test';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';
import {OFFER_VERSION} from '../../packages/partners/offer';

async function seed(page:Page){
 await page.addInitScript(({state,version})=>{
  localStorage.setItem('pulse.dv.control.state.v1',JSON.stringify(state));
  localStorage.setItem('pulse_onboarding_version',state.content.onboardingVersion);
  localStorage.setItem('pulse_mortgage_intro_version','mortgage_intro_v5');
  localStorage.setItem('pulse.partner.guide.v1','seen');
  const now=new Date().toISOString();
  localStorage.setItem('pulse.partners.v1',JSON.stringify({myPartnerId:'partner',partners:[{id:'partner',name:'Анна Иванова',phone:'+79995550101',code:'p01234567890123456789',status:'active',termsVersion:version,createdAt:now}],invitations:[],referrals:[{id:'referral',partnerId:'partner',partnerName:'Анна Иванова',leadId:null,invitationId:null,clientName:'Иван Покупатель',termsVersion:version,status:'accepted',stage:'deal',conflict:false,rejectionReason:null,revision:2,createdAt:now,acceptedAt:now,phone:'+79995550202',events:Array.from({length:12},(_,i)=>({id:'event-'+i,kind:'accepted',label:'Покупатель подтвердил рекомендацию. Проверяем уникальность и готовим документы',createdAt:now}))}],rewards:[{id:'reward',referralId:'referral',commissionRub:157000,reserveMinor:942000,baseMinor:14758000,grossMinor:4427400,status:'paid',recipientType:'person',requestedAt:now,paidOn:now,withheldMinor:0,paidMinor:4427400,revision:2,createdAt:now}]}));
 },{state:DEFAULT_STATE,version:OFFER_VERSION});
}

async function noSidewaysPage(page:Page){
 expect(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth)).toBeLessThanOrEqual(1);
 await page.evaluate(()=>window.scrollTo({left:100,top:window.scrollY,behavior:'instant'}));
 expect(await page.evaluate(()=>window.scrollX)).toBe(0);
 // Check actual scrollports, including portals outside #root. Horizontal photo
 // rails and map gestures remain available; only their scrollbar is hidden.
 const visibleBars=await page.evaluate(()=>Array.from(document.querySelectorAll('*')).filter(node=>{
  const e=node as HTMLElement,s=getComputedStyle(e);
  if(!e.clientWidth||!e.clientHeight||!['auto','scroll'].some(v=>s.overflowX===v||s.overflowY===v))return false;
  if(e.scrollHeight<=e.clientHeight+1&&e.scrollWidth<=e.clientWidth+1)return false;
  return s.getPropertyValue('scrollbar-width')!=='none'&&getComputedStyle(e,'::-webkit-scrollbar').display!=='none';
 }).map(e=>e.tagName+'.'+e.className));
 expect(visibleBars).toEqual([]);
}

async function checkSheet(page:Page,dialog:Locator){
 await expect(dialog).toBeVisible();
 expect(await dialog.evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);
 const outside=await dialog.evaluate(e=>{
  const r=e.getBoundingClientRect();
  return Array.from(e.querySelectorAll('h2,h3,p,label,input,select,textarea,ol')).filter(n=>{
   const b=n.getBoundingClientRect();return b.width>0&&(b.left<r.left-1||b.right>r.right+1);
  }).map(n=>n.tagName+':'+n.textContent?.slice(0,60));
 });
 expect(outside).toEqual([]);
 await noSidewaysPage(page);
}

for(const width of [320,390,430])test(`Mobile scroll ${width}px: every route and portalled sheets stay within the screen`,async({page,browserName})=>{
 test.setTimeout(180000);
 await page.setViewportSize({width,height:844});await page.emulateMedia({reducedMotion:'reduce'});await seed(page);
 const routes=['/','/catalog','/map','/mortgage','/selection','/favorites','/journey','/partners','/partner-offer','/partner-invite','/profile','/my-search','/privacy','/personal-data-consent','/property/primorskiy'];
 for(const route of routes){
  await test.step(route,async()=>{
   await page.goto('/pulsedv/mini-app/#'+route);
   await expect(page.locator('main').first()).toBeVisible();
   await expect(page.locator('.screenLoadState')).toHaveCount(0);
   await expect(page.locator('main').first()).not.toHaveText('');
   await noSidewaysPage(page);
   await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
   await noSidewaysPage(page);
  });
 }
 await page.goto('/pulsedv/mini-app/#/partners?referral=referral');
 const paid=page.getByRole('dialog',{name:'Иван П.'});await checkSheet(page,paid);
 await paid.evaluate(e=>e.scrollTo({top:e.scrollHeight,behavior:'instant'}));
 expect(await paid.evaluate(e=>e.scrollTop)).toBeGreaterThan(100);
 await expect(paid.getByText('История рекомендации',{exact:true})).toBeVisible();
 await checkSheet(page,paid);
 await page.screenshot({path:`test-results/mobile-scroll-partner-${browserName}-${width}.png`});
 await paid.press('Escape');await expect(paid).not.toBeVisible();
 await page.goto('/pulsedv/mini-app/#/catalog');
 await page.getByRole('button',{name:'Фильтры',exact:true}).click();
 await checkSheet(page,page.getByRole('dialog',{name:'Фильтры',exact:true}));
 await page.keyboard.press('Escape');
 await page.goto('/pulsedv/mini-app/#/profile');
 await page.getByRole('button',{name:'История подборов',exact:true}).click();
 await checkSheet(page,page.getByRole('dialog',{name:'История подборов',exact:true}));
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'О сервисе PULSEDV.RU',exact:true}).click();
 await checkSheet(page,page.getByRole('dialog',{name:'О PULSEDV.RU',exact:true}));
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Оставить заявку менеджеру',exact:true}).click();
 await checkSheet(page,page.getByRole('dialog'));
});
