export function dismissLaunchScreen(){
 const screen=document.getElementById('pulse-launch');
 if(!screen||screen.dataset.ready)return;
 screen.dataset.ready='true';screen.setAttribute('aria-hidden','true');screen.inert=true;
 window.dispatchEvent(new Event('pulse:launch-ready'));
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){screen.remove();return}
 screen.classList.add('pulseLaunchLeaving');window.setTimeout(()=>screen.remove(),260);
}
