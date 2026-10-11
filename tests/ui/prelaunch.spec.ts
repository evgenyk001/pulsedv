import {test,expect} from '@playwright/test';
import {businessDay} from '../../packages/pulse-data/business';
const seedLead={id:'58f80f88-bd0f-45e1-b385-73549757791a',name:'Причина потери — тест',phone:'+79990000000',source:'test',propertyId:null,comment:null,status:'new',manager:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),sessionId:'loss-test',userId:null,score:0,priority:'cold',scoreReasons:[],topPropertyId:null,city:null,mortgageProgram:null,nextAction:null};
for(const width of [320,390,430])test(`Loss reason editing and analytics at ${width}px`,async({page,browserName})=>{
 await page.setViewportSize({width,height:844});
 await page.addInitScript(lead=>{if(!localStorage.getItem('pulse.dv.control.leads.v1'))localStorage.setItem('pulse.dv.control.leads.v1',JSON.stringify([lead]))},seedLead);
 await page.goto('/pulsedv/control-center/#/leads');await page.locator('.leadRowButton').filter({hasText:seedLead.name}).click();
 const editor=page.getByRole('dialog',{name:'Карточка клиента'});await editor.getByLabel('Статус',{exact:true}).selectOption('lost');
 await editor.getByRole('button',{name:'Сохранить карточку'}).click();await expect(editor.getByRole('alert')).toContainText('Выберите причину');
 await editor.getByLabel('Причина потери *',{exact:true}).selectOption('other');await editor.getByLabel('Уточнение причины *',{exact:true}).fill('Пока арендует, вернуться в январе');
 await editor.getByRole('button',{name:'Сохранить карточку'}).click();await expect(editor).toHaveCount(0);
 await page.getByRole('button',{name:'Все',exact:true}).click();await page.locator('.leadRowButton').filter({hasText:seedLead.name}).click();
 await expect(editor.getByLabel('Причина потери *',{exact:true})).toHaveValue('other');await expect(editor.getByLabel('Уточнение причины *',{exact:true})).toHaveValue('Пока арендует, вернуться в январе');
 await editor.getByRole('button',{name:'Закрыть',exact:true}).click();await page.goto('/pulsedv/control-center/#/analytics');
 const panel=page.getByRole('region',{name:'Причины потери клиентов'});await expect(panel.getByText('Другая причина',{exact:true})).toBeVisible();await expect(panel.getByText('1 · 100%',{exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await panel.screenshot({path:`test-results/loss-reasons-${browserName}-${width}.png`});
 await panel.getByLabel('Потери с').fill('2020-01-01');await expect(panel.getByRole('alert')).toContainText('Выберите корректный период');
 await panel.getByLabel('Потери с').fill(businessDay());await expect(panel.getByText('1 · 100%',{exact:true})).toBeVisible();
});

test('Large Mini App catalog renders pages, finds the final property and keeps a small DOM',async({page})=>{
 const {DEFAULT_STATE}=await import('../../packages/pulse-data/model');
 const properties=Array.from({length:1000},(_,i)=>({...DEFAULT_STATE.properties[0],id:'large-'+i,name:'ЖК Масштаб '+String(i+1).padStart(4,'0'),status:'published' as const,sortOrder:i,priceFrom:7,description:'Большой тестовый каталог',images:[],coverImageUrl:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',floorplans:[{id:'plan-'+i,roomLabel:'2',areaFrom:50,areaTo:60,priceFrom:7,imageUrl:null,sortOrder:0}]}));
 await page.addInitScript(state=>{localStorage.setItem('pulse.dv.control.state.v1',JSON.stringify(state));localStorage.setItem('pulse_onboarding_version',state.content.onboardingVersion)}, {...DEFAULT_STATE,properties});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:390,height:844});const start=Date.now();await page.goto('/pulsedv/mini-app/#/catalog');
 const links=page.getByRole('link',{name:/Открыть ЖК Масштаб/});await expect(links).toHaveCount(20);const firstPageMs=Date.now()-start;
 await page.getByRole('button',{name:/Показать ещё/}).click();await expect(links).toHaveCount(40);
 await page.getByRole('textbox',{name:'Поиск',exact:true}).fill('Масштаб 1000');await expect(links).toHaveCount(1);await expect(links).toHaveAttribute('href',/large-999/);
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(errors).toEqual([]);expect(firstPageMs).toBeLessThan(10000);
 console.log('UI_SCALE_BENCHMARK '+JSON.stringify({properties:1000,firstPageMs,initialCards:20,nextPageCards:40}));
 await page.screenshot({path:'test-results/catalog-scale-1000.png',fullPage:true});
});
