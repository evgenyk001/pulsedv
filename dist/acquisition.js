/* First-party analytics. The page and Telegram links remain usable without the API. */
(() => {
 'use strict';
 const key='pulse.visit.landing.v1',search=location.search.slice(0,3000),campaign=new URLSearchParams(search).get('utm_source')?search:'';
 let visit=null;
 try{visit=JSON.parse(sessionStorage.getItem(key)||'null')}catch{}
 if(!visit||!Number.isFinite(visit.at)||Date.now()-visit.at>1800000||(campaign&&campaign!==visit.campaign))visit={id:crypto.randomUUID(),at:Date.now(),campaign};
 visit.at=Date.now();try{sessionStorage.setItem(key,JSON.stringify(visit))}catch{}
 const post=async(path,body)=>{
  const response=await fetch('/api/v1/'+path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive:true,signal:AbortSignal.timeout(6000)});
  if(!response.ok)throw new Error('Analytics unavailable');return response.json();
 };
 let ready=false,attempts=0;
 const links=[...document.querySelectorAll('a[href="https://t.me/pulsedvbot"]')];
 async function register(){
  if(ready||attempts>=3)return;attempts++;
  try{
   const data=await post('public/traffic',{id:visit.id,search,referrer:document.referrer.slice(0,2000)});
   ready=true;
   for(const link of links){
    const placement=link.classList.contains('qr-link')?'qr':link.classList.contains('social-link')?'social':'primary';
    link.href=data.go+'?placement='+placement;
   }
   const qr=document.querySelector('.qr-link img');
   if(qr){const image=new Image();image.onload=()=>{qr.src=data.qr};image.src=data.qr;}
  }catch{if(attempts<3)setTimeout(register,attempts*2500);}
 }
 for(const link of links)link.addEventListener('click',()=>{
  if(ready)return; // Ready links count the actual redirect on the server.
  const placement=link.classList.contains('qr-link')?'qr':link.classList.contains('social-link')?'social':'primary';
  // keepalive transmits without delaying navigation; repeated clicks are distinct actions.
  void post('public/traffic/click',{id:crypto.randomUUID(),visitId:visit.id,placement}).catch(()=>{});
 });
 window.addEventListener('online',()=>{attempts=0;void register()});
 void register();
})();
