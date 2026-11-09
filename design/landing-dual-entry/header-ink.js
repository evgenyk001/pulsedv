// Start the one-time ink sequence only when its actual handwriting font is ready.
(()=>{
 const note=document.querySelector('.social-note');if(!note)return;
 let started=false;
 const start=()=>{if(started||document.hidden)return;started=true;note.classList.add('ink-ready');document.removeEventListener('visibilitychange',start)};
 const ready=document.fonts?.load('500 28px Caveat','наши соц. сети')??Promise.resolve();
 Promise.resolve(ready).catch(()=>{}).then(()=>{
  if(document.hidden)document.addEventListener('visibilitychange',start);
  else requestAnimationFrame(start);
 });
})();
