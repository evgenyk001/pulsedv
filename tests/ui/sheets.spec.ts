import {test,expect,type Page,type Locator} from '@playwright/test';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';
import {OFFER_VERSION} from '../../packages/partners/offer';

async function seed(page:Page){
 await page.addInitScript(state=>{localStorage.setItem('pulse_onboarding_version',state.content.onboardingVersion);localStorage.setItem('pulse.dv.control.state.v1',JSON.stringify(state))},DEFAULT_STATE);
}
async function settled(dialog:Locator){
 await expect(dialog).toBeVisible();
 await expect.poll(()=>dialog.evaluate(el=>el.getAnimations().filter(a=>a.playState==='running').length)).toBe(0);
}
async function dragHandle(page:Page,dialog:Locator,distance:number){
 const handle=dialog.locator(':scope > div[aria-hidden="true"]').first();const box=await handle.boundingBox();
 const x=box!.x+box!.width/2,y=box!.y+box!.height/2;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y+distance,{steps:10});return {x,y};
}
async function docked(page:Page,dialog:Locator){
 await settled(dialog);
 await expect.poll(()=>dialog.evaluate(el=>{
  const rect=el.getBoundingClientRect();const expected=parseFloat(getComputedStyle(el).bottom);
  return Math.abs(rect.bottom-(innerHeight-expected));
 })).toBeLessThan(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
}
for(const width of [320,390,430])test(`Bottom sheets reopen fully after four swipe dismissals at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});await seed(page);await page.goto('/pulsedv/mini-app/#/profile');
 const open=page.getByRole('button',{name:'Связаться с PULSEDV.RU',exact:true});
 for(let cycle=0;cycle<4;cycle++){
  await open.click();const dialog=page.getByRole('dialog');await docked(page,dialog);
  await dragHandle(page,dialog,190);await page.mouse.up();await expect(dialog).toHaveCount(0);
 }
 await open.click();await docked(page,page.getByRole('dialog'));
});

for(const reducedMotion of ['no-preference','reduce'] as const)test(`Sheets spring home after short pulls and interrupted gestures (${reducedMotion})`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion});await seed(page);await page.goto('/pulsedv/mini-app/#/profile');
 const open=page.getByRole('button',{name:'Связаться с PULSEDV.RU',exact:true});await open.click();const dialog=page.getByRole('dialog');await docked(page,dialog);
 await expect(dialog).toBeFocused();
 const restTop=(await dialog.boundingBox())!.y;
 await dragHandle(page,dialog,55);expect((await dialog.boundingBox())!.y).toBeGreaterThan(restTop+30);await page.waitForTimeout(110);await page.mouse.up();await docked(page,dialog);
 await dragHandle(page,dialog,-65);expect((await dialog.boundingBox())!.y).toBeLessThan(restTop-2);expect((await dialog.boundingBox())!.y).toBeGreaterThanOrEqual(restTop-20.5);await page.mouse.up();await docked(page,dialog);
 await dialog.evaluate(el=>el.addEventListener('pointerdown',event=>el.setAttribute('data-test-pointer-id',String((event as PointerEvent).pointerId)),{once:true}));
 await dragHandle(page,dialog,60);
 await dialog.dispatchEvent('pointercancel',{pointerId:Number(await dialog.getAttribute('data-test-pointer-id')),pointerType:'mouse'});await page.mouse.up();await docked(page,dialog);
 const pointer=await dragHandle(page,dialog,60);
 await dialog.evaluate(el=>el.releasePointerCapture(Number(el.getAttribute('data-test-pointer-id'))));
 await page.mouse.move(pointer.x+1,pointer.y+60);await page.mouse.up();await docked(page,dialog);
 await dialog.getByRole('button',{name:'Закрыть заявку',exact:true}).dispatchEvent('click');
 await page.getByRole('button',{name:'Связаться с PULSEDV.RU',exact:true,includeHidden:true}).dispatchEvent('click');await docked(page,dialog);
 await dialog.getByRole('button',{name:'Закрыть заявку',exact:true}).click();await expect(dialog).toHaveCount(0);
 await open.click();await docked(page,dialog);expect(errors).toEqual([]);
});

test('Controlled catalog and saved-search sheets reopen at rest with native scrolling',async({page})=>{
 await page.setViewportSize({width:320,height:568});await seed(page);await page.goto('/pulsedv/mini-app/#/catalog');
 const filter=page.getByRole('button',{name:/^Фильтры/});
 for(let cycle=0;cycle<3;cycle++){
  await filter.click();const dialog=page.getByRole('dialog',{name:'Фильтры',exact:true});await docked(page,dialog);
  await dialog.evaluate(el=>el.scrollTop=120);expect(await dialog.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
  await dialog.press('Escape');await expect(dialog).toHaveCount(0);
 }
 await page.goto('/pulsedv/mini-app/#/my-search');
 for(let cycle=0;cycle<3;cycle++){
  await page.getByRole('button',{name:'Настроить мой поиск',exact:true}).click();const dialog=page.getByRole('dialog');await docked(page,dialog);
  expect(await dialog.evaluate(el=>el.scrollTop)).toBe(0);
  await dragHandle(page,dialog,190);await page.mouse.up();await expect(dialog).toHaveCount(0);
 }
});

test('Bottom sheets follow keyboard viewport changes and recover on reopen',async({page})=>{
 await page.setViewportSize({width:390,height:844});await seed(page);await page.goto('/pulsedv/mini-app/#/profile');
 await page.evaluate(()=>{
  Object.defineProperty(window,'visualViewport',{configurable:true,value:Object.assign(new EventTarget(),{height:innerHeight,offsetTop:0})});
  document.documentElement.style.setProperty('--tg-safe-area-inset-top','47px');document.documentElement.style.setProperty('--tg-safe-area-inset-bottom','34px');
 });
 const open=page.getByRole('button',{name:'Связаться с PULSEDV.RU',exact:true});await open.click();const dialog=page.getByRole('dialog');await docked(page,dialog);
 await expect(dialog.getByPlaceholder('Имя', {exact:true})).not.toBeFocused();
 await dialog.getByPlaceholder('Имя',{exact:true}).fill('Евгений');
 await page.evaluate(()=>{Object.assign(window.visualViewport!,{height:480,offsetTop:12});window.visualViewport!.dispatchEvent(new Event('resize'))});
 await expect.poll(()=>dialog.evaluate(el=>el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(484.5);
 expect((await dialog.boundingBox())!.y).toBeGreaterThanOrEqual(59);
 await expect(dialog.getByPlaceholder('Имя',{exact:true})).toHaveValue('Евгений');
 await page.evaluate(()=>{Object.assign(window.visualViewport!,{height:844,offsetTop:0});window.visualViewport!.dispatchEvent(new Event('resize'))});
 await expect.poll(()=>dialog.evaluate(el=>el.getBoundingClientRect().bottom)).toBeGreaterThan(790);
 await dialog.getByRole('button',{name:'Закрыть заявку',exact:true}).click();await expect(dialog).toHaveCount(0);
 await open.click();await docked(page,dialog);expect((await dialog.boundingBox())!.y).toBeGreaterThanOrEqual(47);
 await page.screenshot({path:'test-results/sheet-reopened-safe-area.png'});
});

// Pause the real CSS exit halfway through: conditional partner content must
// survive dismissal, rather than collapsing before Radix removes the portal.
test('Partner guide keeps its body and geometry throughout the exit',async({page})=>{
 await page.setViewportSize({width:390,height:844});await seed(page);await page.goto('/pulsedv/mini-app/#/partners');
 const dialog=page.getByRole('dialog');await docked(page,dialog);
 const before=(await dialog.boundingBox())!;
 await dialog.evaluate(el=>el.addEventListener('animationstart',()=>{if(el.getAttribute('data-state')==='closed')for(const animation of el.getAnimations()){animation.pause();animation.currentTime=Number(animation.effect!.getTiming().duration)/2} }));
 await dialog.getByRole('button',{name:'Понятно, начнём',exact:true}).click();
 const closing=page.locator('[role="dialog"][data-state="closed"]');
 await expect(closing.getByText('Когда будут деньги?',{exact:true})).toHaveCount(1);
 const halfway=await closing.evaluate(el=>({height:el.getBoundingClientRect().height,opacity:getComputedStyle(el).opacity}));
 expect(halfway.height).toBeCloseTo(before.height,0);
 expect(Number(halfway.opacity)).toBe(1);
 await closing.evaluate(el=>el.getAnimations().forEach(a=>a.play()));await expect(closing).toHaveCount(0);
});

for(const method of ['escape','backdrop','swipe'] as const)test(`Partner client details retain content during ${method} dismissal`,async({page})=>{
 await page.setViewportSize({width:390,height:844});await seed(page);
 await page.addInitScript(version=>{
  localStorage.setItem('pulse.partner.guide.v1','seen');const now=new Date().toISOString();
  localStorage.setItem('pulse.partners.v1',JSON.stringify({myPartnerId:'partner',partners:[{id:'partner',name:'Анна',phone:'+79995550101',code:'p01234567890123456789',status:'active',termsVersion:version,createdAt:now}],invitations:[],referrals:[{id:'referral',partnerId:'partner',partnerName:'Анна',clientName:'Иван Покупатель',termsVersion:version,status:'accepted',stage:'deal',revision:1,createdAt:now,acceptedAt:now,events:[{id:'accepted',kind:'accepted',label:'Покупатель подтвердил рекомендацию',createdAt:now}]}],rewards:[]}));
 },OFFER_VERSION);
 await page.goto('/pulsedv/mini-app/#/partners');
 await page.getByRole('button',{name:/Иван П/}).click();const dialog=page.getByRole('dialog');await docked(page,dialog);
 const before=(await dialog.boundingBox())!;
 await dialog.evaluate(el=>el.addEventListener('animationstart',()=>{
  if(el.getAttribute('data-state')!=='closed')return;
  for(const node of [el,document.querySelector('[data-sheet-overlay]')!])for(const animation of node.getAnimations()){animation.pause();animation.currentTime=Number(animation.effect!.getTiming().duration)/2}
 }));
 if(method==='escape')await page.keyboard.press('Escape');
 else if(method==='backdrop')await page.mouse.click(4,70);
 else {await dragHandle(page,dialog,190);await page.mouse.up()}
 const closing=page.locator('[role="dialog"][data-state="closed"]');
 await expect(closing).toContainText('Покупатель подтвердил рекомендацию');
 await expect.poll(()=>closing.evaluate(el=>el.getBoundingClientRect().top)).toBeGreaterThan(before.y+20);
 const midway=await closing.evaluate(el=>{
  const overlay=document.querySelector('[data-sheet-overlay]')!;
  return {height:el.getBoundingClientRect().height,top:el.getBoundingClientRect().top,opacity:getComputedStyle(el).opacity,inert:(el as HTMLElement).inert,duration:getComputedStyle(el).animationDuration,overlayDuration:getComputedStyle(overlay).animationDuration,overlayOpacity:Number(getComputedStyle(overlay).opacity)};
 });
 expect(midway.height).toBeCloseTo(before.height,0);expect(midway.top).toBeGreaterThan(before.y+20);expect(midway.opacity).toBe('1');expect(midway.inert).toBe(true);
 expect(midway.duration).toBe(midway.overlayDuration);expect(midway.overlayOpacity).toBeGreaterThan(0);expect(midway.overlayOpacity).toBeLessThan(1);
 await closing.evaluate(el=>{for(const node of [el,document.querySelector('[data-sheet-overlay]')!])node.getAnimations().forEach(a=>a.play())});
 await expect(closing).toHaveCount(0);
 await page.getByRole('button',{name:/Иван П/}).click();await docked(page,dialog);await expect(dialog).toContainText('Покупатель подтвердил рекомендацию');
});
