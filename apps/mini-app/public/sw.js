/* Public static assets only. No API, media, personal data, session tokens or HTML snapshots. */
const CACHE_PREFIX='pulse-pwa-'+self.location.pathname+'-';
const CACHE=CACHE_PREFIX+'__BUILD__';
const BASE=new URL('./',self.location.href);
const safeAsset=url=>url.origin===BASE.origin&&url.pathname.startsWith(BASE.pathname+'assets/')&&/\.(?:js|css|woff2?)$/.test(url.pathname);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll([new URL('offline.html',BASE).href,new URL('offline.js',BASE).href,new URL('pulse-app-192-v3.png',BASE).href]))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const names=(await caches.keys()).filter(n=>n.startsWith(CACHE_PREFIX));for(const name of names.slice(0,-2))await caches.delete(name);await self.clients.claim()})()));
self.addEventListener('message',event=>{if(event.data?.type==='PULSE_ACTIVATE')void self.skipWaiting()});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).catch(()=>caches.match(new URL('offline.html',BASE).href)));return;
 }
 if(['offline.js','pulse-app-192-v3.png'].some(file=>url.href===new URL(file,BASE).href)){event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));return;}
 if(!safeAsset(url))return;
 event.respondWith((async()=>{const cached=await caches.match(request);if(cached)return cached;const response=await fetch(request);if(response.ok&&response.type==='basic'){const cache=await caches.open(CACHE);await cache.put(request,response.clone());const keys=await cache.keys();if(keys.length>100)await cache.delete(keys[0]);}return response})());
});
function destination(value){try{const url=new URL(value,BASE);if(url.origin===BASE.origin){if(url.pathname===BASE.pathname)return url.href;if(BASE.pathname==='/landing-cinematic/pwa-preview/'&&url.pathname==='/app/')return new URL(url.hash||'#/profile',BASE).href}}catch{}return new URL('#/profile',BASE).href}
self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()??{}}catch{}
 event.waitUntil(self.registration.showNotification(typeof data.title==='string'?data.title.slice(0,100):'PULSEDV.RU',{body:typeof data.body==='string'?data.body.slice(0,180):'Откройте приложение для просмотра обновления.',icon:new URL('pulse-app-192-v3.png',BASE).href,badge:new URL('pulse-app-192-v3.png',BASE).href,tag:typeof data.tag==='string'?data.tag.slice(0,150):'pulse-update',data:{url:destination(data.url)}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const destinationUrl=new URL(destination(event.notification.data?.url));
 const launchUrl=new URL(BASE);
 launchUrl.searchParams.set('pushRoute',destinationUrl.hash);
 launchUrl.hash=destinationUrl.hash;
 event.waitUntil((async()=>{
  const tabs=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=tabs.find(tab=>new URL(tab.url).origin===BASE.origin&&new URL(tab.url).pathname===BASE.pathname);
  if(existing){
   try{existing.postMessage({type:'PULSE_OPEN',url:destinationUrl.href})}catch{}
   try{
    const navigated=await existing.navigate(launchUrl.href);
    if(navigated){await navigated.focus();return}
   }catch{}
  }
  await self.clients.openWindow(launchUrl.href);
 })());
});
