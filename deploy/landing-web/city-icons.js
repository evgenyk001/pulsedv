// Stable silhouettes. One semantic accent follows a scene; replay never flashes.
(()=>{
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),desktop=matchMedia('(min-width:960px)');
 const players=[];let initialDone=false,introSettled=false,scene=0,initialTimer=0;
 const suspended=()=>reduced.matches||document.hidden||!desktop.matches||document.documentElement.classList.contains('motion-paused');
 function play(p){if(!p||!p.loaded||p.failed||p.playing||suspended())return;p.playing=true;p.animation.goToAndPlay(0,true)}
 function initial(){if(!introSettled||initialDone||suspended()||!players.every(p=>p.loaded))return;initialDone=true;players.forEach((p,i)=>setTimeout(()=>play(p),i*100));}
 function sync(){for(const p of players){if(!p.loaded||p.failed)continue;if(reduced.matches){p.animation.goToAndStop(p.animation.totalFrames-1,true);p.playing=false}else if(suspended())p.animation.pause();else if(p.playing)p.animation.play()}if(!suspended())initial()}
 function select(index){scene=index;const active=[0,0,1,2,0][index]??0;players.forEach((p,i)=>p.item.dataset.sceneActive=String(i===active));if(initialDone)play(players[active]);}
 function mount(){
  if(!desktop.matches||!window.lottie||players.length)return;
  document.querySelectorAll('[data-lottie]').forEach(el=>{
   const host=document.createElement('span');host.className='capability-lottie';el.append(host);
   try{
    const animation=window.lottie.loadAnimation({container:host,path:`assets/capability-${el.dataset.lottie}.json?v=light-duotone-1`,renderer:'svg',loop:false,autoplay:false,rendererSettings:{preserveAspectRatio:'xMidYMid meet',progressiveLoad:false}});
    const p={animation,item:el.closest('li'),loaded:false,playing:false};players.push(p);
    animation.addEventListener('DOMLoaded',()=>{p.loaded=true;animation.goToAndStop(animation.totalFrames-1,true);el.classList.add('lottie-ready');if(!initialTimer)initialTimer=setTimeout(()=>{introSettled=true;initial()},1400);if(initialDone)select(scene);else if(introSettled)initial()});
    animation.addEventListener('complete',()=>{p.playing=false});
    animation.addEventListener('data_failed',()=>{p.loaded=true;p.failed=true;p.playing=false;el.classList.remove('lottie-ready');host.remove();initial()});
    p.item.addEventListener('pointerenter',()=>play(p));
   }catch{host.remove()}
  });
 }
 window.addEventListener('pulse:intro',e=>{if(e.detail?.phase==='holding'){introSettled=true;initial()}});
 window.addEventListener('pulse:scene',e=>{if(e.detail?.phase==='hold')select(e.detail.index)});
 window.addEventListener('pulse:motion-change',sync);document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);desktop.addEventListener('change',()=>{mount();sync()});mount();
})();
