import {test,expect,type Page} from '@playwright/test';
import {DEFAULT_STATE} from '../../packages/pulse-data/model';

// SDK contract fixture only: never represents Yandex tiles, copyrights or advertising.
const sdkFixture=String.raw`(()=>{
 const log=window.__mapCalls=[];
 class Entity{constructor(props={}){this.props=props;this.element=document.createElement('div')}addChild(child){this.element.append(child.element);return this}}
 class Map extends Entity{
  constructor(root,props){super(props);this.element=root;this.zoom=props.location.zoom;this.listeners=[];this.root=document.createElement('div');this.root.dataset.testid='map-sdk-contract';this.root.style='display:flex;flex-wrap:wrap;align-content:start;gap:40px;padding:110px 65px';root.append(this.root);log.push({type:'create',props})}
  addChild(child){this.root.append(child.element);if(child.listener)this.listeners.push(child.listener);return this}
  removeChild(child){child.element.remove();this.listeners=this.listeners.filter(fn=>fn!==child.listener);log.push({type:'remove'})}
  setLocation(location){if(location.zoom!==undefined)this.zoom=location.zoom;if(location.bounds)this.zoom=14;log.push({type:'location',location});this.listeners.forEach(fn=>fn({location:{zoom:this.zoom}}))}
  setMargin(margin){log.push({type:'margin',margin})}
  setCamera(camera){log.push({type:'camera',camera})}
  destroy(){this.root.remove();log.push({type:'destroy'})}
 }
 class Marker extends Entity{constructor(props,element){super(props);this.element=element;log.push({type:'marker',coordinates:props.coordinates})}update(props){Object.assign(this.props,props)}}
 class Listener extends Entity{constructor(props){super(props);this.listener=props.onUpdate}}
 class Open extends Entity{constructor(props){super(props);this.element=document.createElement('a');this.element.href='https://yandex.ru/maps/';this.element.textContent=props.title}}
 window.ymaps3={ready:Promise.resolve(),YMap:Map,YMapMarker:Marker,YMapListener:Listener,YMapDefaultSchemeLayer:Entity,YMapDefaultFeaturesLayer:Entity,YMapControls:Entity,import:async()=>({YMapOpenMapsButton:Open})};
})();`;
async function setup(page:Page,state=DEFAULT_STATE){
 await page.addInitScript(state=>{
  localStorage.setItem('pulse.dv.control.state.v1',JSON.stringify(state));
  localStorage.setItem('pulse_onboarding_version',state.content.onboardingVersion);
 },state);
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
 await expect.poll(()=>page.evaluate(()=>(window as any).__mapCalls.filter((x:any)=>x.type==='destroy').length)).toBe(1);
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

for(const width of [320,390,430])test(`Map preview ${width}px: bounded card, favorite and close without opening the project`,async({page})=>{
 await page.setViewportSize({width,height:844});await setup(page);
 await page.route('https://api-maps.yandex.ru/v3/**',route=>route.fulfill({contentType:'application/javascript',body:sdkFixture}));
 await page.goto(openMap);
 const pin=page.getByRole('button',{name:'ЖК Приморский, от 7,8 млн рублей',exact:true});
 await pin.click();const card=page.getByRole('article',{name:'ЖК Приморский',exact:true});
 await expect(card).toBeVisible();await expect(card.getByRole('heading',{name:'ЖК Приморский',exact:true})).toBeVisible();
 const map=await page.getByLabel('Интерактивная карта Яндекс Карты с новостройками',{exact:true}).boundingBox();
 const box=await card.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(map!.x);expect(box!.x+box!.width).toBeLessThanOrEqual(map!.x+map!.width+1);expect(box!.y+box!.height).toBeLessThanOrEqual(map!.y+map!.height-40);
 expect(await page.evaluate(()=>(window as any).__mapCalls.filter((x:any)=>x.type==='margin').at(-1).margin[2])).toBeGreaterThan(150);
 await card.getByRole('button',{name:'Добавить в избранное',exact:true}).click();
 await expect(card.getByRole('button',{name:'Убрать из избранного',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page).toHaveURL(/view=map/);
 await card.getByRole('button',{name:'Закрыть карточку ЖК',exact:true}).click();await expect(card).toHaveCount(0);await expect(pin).toHaveAttribute('aria-pressed','false');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('pulse.dv.favorites.v1')||'[]'))).toContain('primorskiy');
});

test('Clusters count only filtered projects, split on zoom-in and regroup on zoom-out',async({page})=>{
 await page.setViewportSize({width:390,height:844});await setup(page);
 await page.route('https://api-maps.yandex.ru/v3/**',route=>route.fulfill({contentType:'application/javascript',body:sdkFixture}));
 await page.goto(openMap);
 const zoomOut=page.getByRole('button',{name:'Уменьшить карту',exact:true});
 for(let n=0;n<5;n++)await zoomOut.click();
 const cluster=page.getByRole('button',{name:'Показать группу из 2 ЖК',exact:true});
 await expect(cluster).toBeVisible();await expect(page.getByRole('button',{name:/, от .* млн рублей/})).toHaveCount(0);
 await cluster.click();await expect(cluster).toHaveCount(0);
 await expect(page.getByRole('button',{name:/, от .* млн рублей/})).toHaveCount(2);
 for(let n=0;n<5;n++)await zoomOut.click();await expect(cluster).toBeVisible();
});

test('Coincident projects retain exact count and each project remains reachable at maximum zoom',async({page})=>{
 const state=structuredClone(DEFAULT_STATE);
 const seed=state.properties.find(p=>p.id==='primorskiy')!;
 state.properties=Array.from({length:10},(_,n)=>({...structuredClone(seed),id:'cluster-'+n,name:'ЖК Тест '+n}));
 await page.setViewportSize({width:390,height:844});await setup(page,state);
 await page.route('https://api-maps.yandex.ru/v3/**',route=>route.fulfill({contentType:'application/javascript',body:sdkFixture}));
 await page.goto(openMap);
 const cluster=page.getByRole('button',{name:'Показать группу из 10 ЖК',exact:true});await expect(cluster).toBeVisible();
 await cluster.click();const group=page.getByRole('region',{name:'ЖК в одной точке',exact:true});await expect(group).toBeVisible();
 await expect(group.getByRole('button',{name:/ЖК Тест/})).toHaveCount(10);
 await group.getByRole('button',{name:/ЖК Тест 9 /}).click();await expect(page.getByRole('article',{name:'ЖК Тест 9',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Открыть ЖК Тест 9',exact:true}).click();await expect(page).toHaveURL(/property\/cluster-9/);
});

test('Map background tap dismisses the project preview, while map controls and favorites keep it open',async({page})=>{
 await page.setViewportSize({width:390,height:844});await setup(page);
 await page.route('https://api-maps.yandex.ru/v3/**',route=>route.fulfill({contentType:'application/javascript',body:sdkFixture}));
 await page.goto(openMap);
 await page.getByRole('button',{name:'ЖК Приморский, от 7,8 млн рублей',exact:true}).click();
 const card=page.getByRole('article',{name:'ЖК Приморский',exact:true});await expect(card).toBeVisible();
 await page.getByRole('button',{name:'Увеличить карту',exact:true}).click();await expect(card).toBeVisible();
 await card.getByRole('button',{name:'Добавить в избранное',exact:true}).click();await expect(card).toBeVisible();
 await page.getByTestId('map-sdk-contract').click({position:{x:10,y:10}});await expect(card).toHaveCount(0);
});
