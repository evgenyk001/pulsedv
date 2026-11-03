import {test,expect} from '@playwright/test';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';
for(const width of [320,390,430])test(`Floorplan square metre price ${width}px: paired area, finish selection, unknown prices and compact layout`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 const state=structuredClone(DEFAULT_STATE),property=state.properties[0];
 const common={roomLabel:'1',isExact:true,imageUrl:null,sortOrder:0};
 property.floorplans=[
  {...common,id:'unit-30',areaFrom:30,areaTo:30,priceFrom:5.13,priceTo:5.13},
  {...common,id:'unit-33',areaFrom:33,areaTo:33,priceFrom:5.643,priceTo:5.643},
  {...common,id:'unit-40',areaFrom:40,areaTo:40,priceFrom:6,priceTo:6,finishOptions:[{finishType:'rough',priceFrom:6,priceTo:6},{finishType:'white_box',priceFrom:6.4,priceTo:6.4},{finishType:'finished',priceFrom:null,priceTo:null}]},
  {...common,id:'unit-range',isExact:false,areaFrom:30,areaTo:50,priceFrom:8,priceTo:9},
  {...common,id:'unit-unknown',areaFrom:47,areaTo:47,priceFrom:null,priceTo:null},
  {...common,id:'unit-fraction',areaFrom:38.2,areaTo:38.2,priceFrom:6.5322,priceTo:6.5322}
 ];
 await page.route('https://telegram.org/js/telegram-web-app.js**',r=>r.fulfill({body:''}));
 await page.addInitScript(state=>{localStorage.setItem('pulse.dv.control.state.v1',JSON.stringify(state));localStorage.setItem('pulse_onboarding_version',state.content.onboardingVersion)},state);
 await page.goto('/pulsedv/mini-app/#/property/primorskiy');await page.getByRole('button',{name:'Выбрать планировки: 1',exact:true}).click();
 const cards=page.locator('#room-plan-options article');await expect(cards).toHaveCount(6);
 const card=(area:string)=>cards.filter({has:page.getByText(area,{exact:true})});
 for(const area of ['30 м²','33 м²','38,2 м²'])await expect(card(area).locator('.pulsePlanUnitPrice')).toHaveText(/^171\s000 ₽\/м²$/);
 await expect(card('30–50 м²').locator('.pulsePlanUnitPrice')).toHaveCount(0);await expect(card('47 м²').locator('.pulsePlanUnitPrice')).toHaveCount(0);
 await card('40 м²').getByRole('button').click();const detail=page.getByRole('dialog').last();await expect(detail.locator('.pulsePlanDetailUnitPrice')).toHaveText(/^150\s000 ₽\/м²$/);
 await detail.getByRole('button',{name:/White Box/}).click();await expect(detail.locator('.pulsePlanDetailUnitPrice')).toHaveText(/^160\s000 ₽\/м²$/);
 await detail.getByRole('button',{name:/Готовый ремонт/}).click();await expect(detail.locator('.pulsePlanDetailUnitPrice')).toHaveCount(0);await page.keyboard.press('Escape');
 await page.getByRole('group',{name:'Варианты отделки'}).getByRole('button',{name:'White Box',exact:true}).click();await expect(cards).toHaveCount(1);await expect(cards.locator('.pulsePlanUnitPrice')).toHaveText(/^160\s000 ₽\/м²$/);
 await page.getByRole('group',{name:'Варианты отделки'}).getByRole('button',{name:'Все варианты',exact:true}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 const unit=card('30 м²').locator('.pulsePlanUnitPrice');await unit.scrollIntoViewIfNeeded();await expect(unit).toBeVisible();await page.screenshot({path:`test-results/unit-price-${width}.png`});
});
