import {ribbonGeometry} from './ribbon-geometry.js';
import {criticalStep} from './motion-core.js';
const svg=document.querySelector('.city-ribbon'),stage=document.querySelector('.city-studio');
const surface=svg.querySelector('.ribbon-surface'),shade=svg.querySelector('.ribbon-shade'),shine=svg.querySelector('.ribbon-shine'),edge=svg.querySelector('.ribbon-edge'),gradient=svg.querySelector('#ribbon-satin');
const reduce=matchMedia('(prefers-reduced-motion:reduce)'),portrait=matchMedia('(max-width:959px) and (orientation:portrait)');
let time=0,last=0,raf=0,visible=true,offset=0,velocity=0,target=0;
const running=()=>!document.hidden&&!reduce.matches&&!document.documentElement.classList.contains('motion-paused')&&visible;
function draw(dt){
 [offset,velocity]=criticalStep(offset,velocity,target,dt,2.5);
 const shape=ribbonGeometry(time,offset,portrait.matches?.64:1);
 surface.setAttribute('d',shape.body);shade.setAttribute('d',shape.shade);shine.setAttribute('d',shape.shine);edge.setAttribute('d',shape.edge);
 const light=Math.sin(time*.37)*210;
 gradient.setAttribute('x1',String(-100+light));gradient.setAttribute('x2',String(850+light));
}
function tick(now){raf=0;const dt=last?(now-last)/1000:0;last=now;if(running())time+=dt;draw(dt);if(running())raf=requestAnimationFrame(tick)}
function sync(){
 cancelAnimationFrame(raf);raf=0;last=0;svg.dataset.motion=running()?'running':reduce.matches?'reduced':'paused';
 if(running())raf=requestAnimationFrame(tick);else draw(0);
}
window.addEventListener('pulse:scene',e=>{if(e.detail?.phase==='exit')target=[0,22,-18,12,-8][(e.detail.index+1)%5]});
window.addEventListener('pulse:motion-change',sync);document.addEventListener('visibilitychange',sync);reduce.addEventListener('change',sync);portrait.addEventListener('change',()=>draw(0));
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync()},{threshold:.01}).observe(stage);
draw(0);svg.dataset.ready='true';sync();
