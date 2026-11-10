// One finite intro: font-ready pen strokes, a ten-second hold, then erasing.
(()=>{
 const note=document.querySelector('.social-note');if(!note)return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');let started=false;
 const phase=value=>{note.dataset.inkPhase=value;window.dispatchEvent(new CustomEvent('pulse:intro',{detail:{phase:value}}))};
 const start=()=>{
  if(started||document.hidden)return;started=true;document.removeEventListener('visibilitychange',start);
  note.classList.add('ink-ready');phase(reduced.matches?'holding':'writing');
  if(!reduced.matches){setTimeout(()=>phase('holding'),3020);setTimeout(()=>phase('erasing'),10000);}
  setTimeout(()=>{note.classList.add('ink-finished');phase('finished')},reduced.matches?10000:11160);
 };
 Promise.resolve(document.fonts?.load('500 28px Caveat','наши соц. сети')).catch(()=>{}).then(()=>{
  if(document.hidden)document.addEventListener('visibilitychange',start);else requestAnimationFrame(start);
 });
})();
