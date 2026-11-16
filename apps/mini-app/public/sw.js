/* Cache the public app shell and its static assets. API and session data stay on the network. */
const CACHE_PREFIX='pulse-pwa-'+self.location.pathname+'-';
const CACHE=CACHE_PREFIX+'__BUILD__';
const BASE=new URL('./',self.location.href);
const SHELL=new URL('index.html',BASE).href;
const POINTER=new URL('__selected_shell__',BASE).href;
const STATE=CACHE_PREFIX+'selection';
const selected=async()=> (await (await caches.open(STATE)).match(POINTER))?.text();
const select=async()=> (await caches.open(STATE)).put(POINTER,new Response(CACHE));
const blockedShell=CACHE_PREFIX+'b1fb883477a29f4f';
const needsRecovery=chosen=>BASE.pathname==='/app/'&&chosen===blockedShell;
const safeAsset=url=>url.origin===BASE.origin&&url.pathname.startsWith(BASE.pathname+'assets/')&&/\.(?:js|css|woff2?)$/.test(url.pathname);
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const shell=await fetch(SHELL,{cache:'no-store'});
 if(!shell.ok||!(await shell.clone().text()).includes('name="pulse-build" content="'+CACHE.slice(CACHE_PREFIX.length)+'"')){
  throw new Error('App shell and worker versions differ');
 }
 const cache=await caches.open(CACHE);
 const assets=__SHELL_ASSETS__;
 await cache.addAll(['offline.html','offline.js','pulse-app-192-v3.png',...assets].map(file=>new Request(new URL(file,BASE),{cache:'reload'})));
 await cache.put(SHELL,shell);
 // Recover installations blocked by the first production shell's phone gate.
 if(needsRecovery(await selected()))await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 let keep=await selected();
 if(!keep||needsRecovery(keep)){await select();keep=CACHE}
 const names=await caches.keys();
 await Promise.all(names.filter(name=>name.startsWith(CACHE_PREFIX)&&![STATE,CACHE,keep].includes(name)).map(name=>caches.delete(name)));
 await self.clients.claim();
})()));
self.addEventListener('message',event=>{
 if(event.data?.type!=='PULSE_ACTIVATE')return;
 event.waitUntil((async()=>{
  try{
   const shell=await (await caches.open(CACHE)).match(SHELL);
   if(!shell)throw new Error('App shell unavailable');
   await select();
   await self.skipWaiting();
   event.ports[0]?.postMessage(true);
  }catch{event.ports[0]?.postMessage(false)}
 })());
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;
 if(request.mode==='navigate'){
  event.respondWith((async()=>{
   const chosen=await selected();
   const shell=chosen&&await (await caches.open(chosen)).match(SHELL);
   return shell||fetch(request).catch(()=>caches.match(new URL('offline.html',BASE).href));
  })());return;
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
