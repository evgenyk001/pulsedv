import {test,expect,type Page} from '@playwright/test';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';

// SDK contract fixture only: never represents Yandex tiles, copyrights or advertising.
const sdkFixture=String.raw`(()=>{
 const log=window.__mapCalls=[];
 class Entity{constructor(props={}){this.props=props;this.element=document.createElement('div')}addChild(child){this.element.append(child.element);return this}}
 class Map extends Entity{
  constructor(root,props){super(props);this.element=root;this.zoom=props.location.zoom;this.root=document.createElement('div');this.root.dataset.testid='map-sdk-contract';this.root.style='display:grid;gap:28px;padding:100px 130px';root.append(this.root);log.push({type:'create',props})}
  addChild(child){this.root.append(child.element);return this}
  removeChild(child){child.element.remove();log.push({type:'remove'})}
  setLocation(location){if(location.zoom!==undefined)this.zoom=location.zoom;log.push({type:'location',location})}
  setCamera(camera){log.push({type:'camera',camera})}
  destroy(){this.root.remove();log.push({type:'destroy'})}
 }
 class Marker extends Entity{constructor(props,element){super(props);this.element=element;log.push({type:'marker',coordinates:props.coordinates})}update(props){Object.assign(this.props,props)}}
 class Open extends Entity{constructor(props){super(props);this.element=document.createElement('a');this.element.href='https://yandex.ru/maps/';this.element.textContent=props.title}}
 window.ymaps3={ready:Promise.resolve(),YMap:Map,YMapMarker:Marker,YMapDefaultSchemeLayer:Entity,YMapDefaultFeaturesLayer:Entity,YMapControls:Entity,import:async()=>({YMapOpenMapsButton:Open})};
})();`;
async function setup(page:Page){
 await page.addInitScript(state=>{
  localStorage.setItem('pulse.dv.control.state.v1',JSON.stringify(state));
  localStorage.setItem('pulse_onboarding_version',state.content.onboardingVersion);
 },DEFAULT_STATE);
 await page.route('**/mini-app/map-config.json',route=>route.fulfill({json:{provider:'yandex',key:'sdk-contract-key'}}));
}
const openMap='/pulsedv/mini-app/#/catalog?view=map&city='+encodeURIComponent('Владивосток');

for(const width of [320,390])test(`Yandex SDK contract ${width}px: pins, zoom, selection, property navigation and cleanup`,async({page})=>{
 await page.setViewportSize({width,height:844});await setup(page);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 let requests=0;
 await page.route('https://api-maps.yandex.ru/v3/**',async route=>{
  requests++;const url=new URL(route.request().url());expect(url.searchParams.get('apikey')).toBe('sdk-contract-key');
  expect(url.searchParams.get('lang')).toBe('ru_RU');await route.fulfill({contentType:'application/javascript',body:sdkFixture});
 });
 await page.goto(openMap);
 const pin=page.getByRole('button',{name:'ЖК Приморский, от 7,8 млн рублей',exact:true});
 await expect(pin).toBeVisible();await expect(page.getByRole('button',{name:'ЖК Восточный, от 5,4 млн рублей',exact:true})).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Открыть в Картах',exact:true})).toBeVisible();
 expect(requests).toBe(1);
 await page.getByRole('button',{name:'Увеличить карту',exact:true}).click();
 const fits=await page.evaluate(()=>(window as any).__mapCalls.filter((x:any)=>x.type==='location'&&x.location.bounds).length);
 await pin.click();await expect(pin).toHaveAttribute('aria-pressed','true');
 expect(await page.evaluate(()=>(window as any).__mapCalls.filter((x:any)=>x.type==='location'&&x.location.bounds).length)).toBe(fits);
 const last=await page.evaluate(()=>(window as any).__mapCalls.filter((x:any)=>x.type==='location').at(-1).location);
 expect(last.center).toEqual([131.8855,43.1155]);expect(last.zoom).toBeUndefined();
 await page.getByRole('button',{name:'Открыть ЖК Приморский',exact:true}).click();
 await expect(page).toHaveURL(/#\/property\/primorskiy/);
 expect(await page.evaluate(()=>(window as any).__mapCalls.filter((x:any)=>x.type==='destroy').length)).toBe(1);
 await page.getByRole('link',{name:'Назад',exact:true}).click();await expect(page).toHaveURL(/view=map/);await expect(pin).toBeVisible();expect(requests).toBe(1);expect(errors).toEqual([]);
});

test('Map SDK network failure can be retried and list remains available',async({page})=>{
 await setup(page);let requests=0;
 await page.route('https://api-maps.yandex.ru/v3/**',async route=>{
  if(++requests===1)await route.abort('failed');else await route.fulfill({contentType:'application/javascript',body:sdkFixture});
 });
 await page.goto(openMap);await expect(page.getByText('Не удалось открыть карту',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Открыть список ЖК',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Попробовать снова',exact:true}).click();
 await expect(page.getByRole('button',{name:'ЖК Приморский, от 7,8 млн рублей',exact:true})).toBeVisible();expect(requests).toBe(2);
});

test('Missing map key keeps catalog usable and exposes no technical configuration',async({page})=>{
 await setup(page);await page.route('**/mini-app/map-config.json',route=>route.fulfill({json:{}}));
 await page.goto(openMap);await expect(page.getByText('Не удалось открыть карту',{exact:true})).toBeVisible();
 await expect(page.locator('body')).not.toContainText('MAP_YANDEX_KEY');
 await page.getByRole('button',{name:'Открыть список ЖК',exact:true}).click();
 await expect(page).not.toHaveURL(/view=map/);await expect(page.getByText('ЖК Приморский',{exact:true})).toBeVisible();
});
