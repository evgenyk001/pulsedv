// Three local Lottie vector assets; one restrained reveal, replay on hover.
(()=>{
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),desktop=matchMedia('(min-width: 960px)');
 const players=[];
 const suspended=()=>reduced.matches||document.hidden||document.documentElement.classList.contains('motion-paused');
 function sync(){for(const p of players){if(reduced.matches)p.animation.goToAndStop(p.animation.totalFrames-1,true);else if(suspended())p.animation.pause();else if(p.started&&!p.complete)p.animation.play();}}
 function mount(){
  if(!desktop.matches||!window.lottie||players.length)return;
  document.querySelectorAll('[data-lottie]').forEach(el=>{
   const host=document.createElement('span');host.className='capability-lottie';el.append(host);
   try{
    const animation=window.lottie.loadAnimation({container:host,path:`assets/capability-${el.dataset.lottie}.json`,renderer:'svg',loop:false,autoplay:false,rendererSettings:{preserveAspectRatio:'xMidYMid meet'}});
    const p={animation,started:false,complete:false};players.push(p);
    animation.addEventListener('DOMLoaded',()=>{el.classList.add('lottie-ready');p.started=true;if(reduced.matches)animation.goToAndStop(animation.totalFrames-1,true);else if(!suspended())animation.play();});
    animation.addEventListener('complete',()=>{p.complete=true;});
    animation.addEventListener('data_failed',()=>{el.classList.remove('lottie-ready');host.remove();});
    el.closest('li').addEventListener('pointerenter',()=>{if(suspended())return;p.complete=false;animation.goToAndPlay(0,true);});
   }catch{host.remove();}
  });
 }
 window.addEventListener('pulse:motion-change',sync);document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);desktop.addEventListener('change',mount);mount();
})();
