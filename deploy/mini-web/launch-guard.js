// Runs independently of the app bundle, including when its download fails.
(()=>{
 const ready=()=>{const tg=window.Telegram?.WebApp;for(const call of [()=>tg?.ready?.(),()=>tg?.expand?.()])try{call()}catch{}};
 ready();window.addEventListener('pulse:telegram-sdk-ready',ready);
 const screen=document.getElementById('pulse-launch');
 if(!screen)return;
 const show=()=>{if(screen.isConnected&&!screen.dataset.ready){const note=document.getElementById('pulse-launch-note');if(note)note.hidden=false}};
 const timer=window.setTimeout(show,15000);
 const failed=event=>{if(event.target instanceof HTMLScriptElement&&event.target.type==='module')show()};
 window.addEventListener('error',failed,true);
 document.getElementById('pulse-launch-retry')?.addEventListener('click',()=>window.location.reload());
 window.addEventListener('pulse:launch-ready',()=>{window.clearTimeout(timer);window.removeEventListener('error',failed,true)},{once:true});
})();
