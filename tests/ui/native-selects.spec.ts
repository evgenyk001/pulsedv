import {test,expect} from '@playwright/test';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';

for(const width of [320,390,430])test(`Native pickers ${width}px: draft/apply/reset, sorting, selection, mortgage and floorplans`,async({page,browserName})=>{
 await page.setViewportSize({width,height:844});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(state=>{if(!localStorage.getItem('pulse.dv.control.state.v1'))localStorage.setItem('pulse.dv.control.state.v1',JSON.stringify(state));localStorage.setItem('pulse_onboarding_version',state.content.onboardingVersion)},DEFAULT_STATE);
 const noOverflow=async()=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto('/pulsedv/mini-app/#/catalog');await page.getByRole('button',{name:'Фильтры',exact:true}).click();const sheet=page.getByRole('dialog');
 const city=sheet.getByRole('combobox',{name:'Город',exact:true});await expect(city).toHaveJSProperty('tagName','SELECT');await city.selectOption('Владивосток');
 await sheet.getByRole('switch',{name:'Вид на море'}).click();await expect(sheet.getByRole('switch',{name:'Вид на море'})).toBeChecked();await city.selectOption('Артём');await expect(sheet.getByRole('switch',{name:'Вид на море'})).toHaveCount(0);
 await sheet.getByRole('combobox',{name:'Комнатность'}).selectOption('2');await sheet.getByRole('combobox',{name:'Срок сдачи'}).selectOption('2027');
 expect(page.url()).not.toContain('city=');const apply=sheet.getByRole('button',{name:/Показать \d+ проект/});await expect(apply).toBeInViewport({ratio:1});await noOverflow();
 await sheet.screenshot({path:`test-results/native-filters-${browserName}-${width}.png`});await apply.click();
 const query=new URLSearchParams(page.url().split('?')[1]);expect(query.get('city')).toBe('Артём');expect(query.get('rooms')).toBe('2');expect(query.get('delivery')).toBe('2027');expect(query.has('sea')).toBe(false);
 await page.getByRole('combobox',{name:'Сортировка'}).selectOption('priceAsc');expect(page.url()).toContain('sort=priceAsc');await page.reload();await expect(page.getByRole('combobox',{name:'Сортировка'})).toHaveValue('priceAsc');
 await page.getByRole('button',{name:/Фильтры, выбрано/}).click();await expect(city).toHaveValue('Артём');await sheet.getByRole('button',{name:'Сбросить',exact:true}).click();await expect(city).toHaveValue('Все');await expect(sheet.getByRole('combobox',{name:'Комнатность'})).toHaveValue('Все');await sheet.getByRole('button',{name:/Показать \d+ проект/}).click();expect(page.url()).not.toContain('city=');
 await page.goto('/pulsedv/mini-app/#/selection');await page.getByRole('combobox',{name:'Город',exact:true}).selectOption('Артём');await page.getByRole('combobox',{name:'Комнатность'}).selectOption('2');await noOverflow();
 await page.screenshot({path:`test-results/native-selection-${browserName}-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:/Где и что/}).click();await page.screenshot({path:`test-results/neutral-selection-${browserName}-${width}.png`,fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:/Как покупаем/}).click();await page.getByRole('combobox',{name:'Способ покупки'}).selectOption('cash');await page.getByRole('combobox',{name:'Способ покупки'}).selectOption('mortgage');await page.getByRole('combobox',{name:'Сценарий для расчёта'}).selectOption('farEast');
 await page.getByRole('button',{name:/Когда нужны ключи/}).click();await page.getByRole('combobox',{name:'Срок сдачи'}).selectOption('2027');
 await page.goto('/pulsedv/mini-app/#/mortgage');await page.getByRole('dialog',{name:'Знакомство с ипотекой'}).getByRole('button',{name:'Закрыть знакомство с ипотекой'}).click();
 await page.getByRole('combobox',{name:'Количество детей'}).selectOption('2');await page.getByRole('combobox',{name:'Тип недвижимости'}).selectOption('house');await page.getByRole('combobox',{name:'Ипотечная программа'}).selectOption('farEast');await expect(page.getByRole('combobox',{name:'Тип недвижимости'})).toHaveValue('house');await noOverflow();
 await page.screenshot({path:`test-results/native-mortgage-${browserName}-${width}.png`,fullPage:true});
 await page.getByRole('combobox',{name:'Ипотечная программа'}).selectOption('family');await expect(page.getByRole('combobox',{name:'Количество детей'})).toHaveValue('2');
 await page.goto('/pulsedv/mini-app/#/property/'+DEFAULT_STATE.properties[0].id);const rooms=page.getByRole('combobox',{name:'Комнатность планировок'});await expect(rooms).toHaveJSProperty('tagName','SELECT');
 const options=await rooms.locator('option').allTextContents();if(options.length>1){await rooms.selectOption({label:options[1]});await expect(rooms).toHaveValue(options[1]);}
 await noOverflow();expect(errors).toEqual([]);
});

test('Every search picker uses only published catalog rooms and delivery years',async({page})=>{
 const state=structuredClone(DEFAULT_STATE);
 const template=state.properties[0];
 const make=(id:string,status:'published'|'draft'|'archived',room:string,delivery:string)=>({...structuredClone(template),id,status,delivery,floorplans:[{...template.floorplans[0],roomLabel:room}]});
 state.properties=[make('one','published','Студия','Сдан'),make('two','published','2','III кв. 2032'),make('five','published','5-комнатная','2032'),make('draft','draft','8','2040'),make('archived','archived','9','2041')];
 state.select.roomOptions=['1','4'];state.select.deliveryOptions=['2026','2030'];
 await page.addInitScript(state=>{localStorage.setItem('pulse.dv.control.state.v1',JSON.stringify(state));localStorage.setItem('pulse_onboarding_version',state.content.onboardingVersion)},state);
 const roomValues=['Все','Студия','2','5'];
 const values=async(selector:ReturnType<typeof page.getByRole>)=>selector.locator('option').evaluateAll(nodes=>nodes.map(n=>(n as HTMLOptionElement).value));
 await page.goto('/pulsedv/mini-app/#/catalog');await page.getByRole('button',{name:'Фильтры',exact:true}).click();
 const sheet=page.getByRole('dialog');
 await expect.poll(()=>values(sheet.getByRole('combobox',{name:'Комнатность',exact:true}))).toEqual(roomValues);
 await expect.poll(()=>values(sheet.getByRole('combobox',{name:'Срок сдачи',exact:true}))).toEqual(['Любой','Сдан','2032']);
 await page.goto('/pulsedv/mini-app/#/my-search?draft=1');
 await expect.poll(()=>values(page.getByRole('dialog').getByRole('combobox',{name:'Комнатность',exact:true}))).toEqual(roomValues);
 await expect.poll(()=>values(page.getByRole('dialog').getByRole('combobox',{name:'Срок сдачи',exact:true}))).toEqual(['Любой','Сдан','2032']);
 await page.goto('/pulsedv/mini-app/#/selection');
 await expect.poll(()=>values(page.getByRole('combobox',{name:'Комнатность',exact:true}))).toEqual(roomValues);
 await page.getByRole('button',{name:/Когда нужны ключи/}).click();
 await expect.poll(()=>values(page.getByRole('combobox',{name:'Срок сдачи',exact:true}))).toEqual(['Не важно','Сдан','2032']);
});
