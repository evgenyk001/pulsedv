import {criticalStep,smootherstep,clamp01} from './motion-core.js';
const stage=document.querySelector('.city-studio'),host=document.querySelector('.city-cinema'),title=document.querySelector('.city-scene-title'),caption=document.querySelector('.scene-caption'),label=document.querySelector('.scene-label');
const reduce=matchMedia('(prefers-reduced-motion:reduce)'),coarse=matchMedia('(pointer:coarse)');
const scenes=[
 {screens:['home','catalog'],label:'Ваш следующий адрес',title:'Большой выбор. В ваших руках.',angles:[-7,7],levels:[.43,.55],heights:[.82,.73],curve:[545,290,600,690,410,430]},
 {screens:['property','floorplans'],label:'От дома — до деталей',title:'Представьте, как будете здесь жить.',angles:[-5,5],levels:[.53,.43],heights:[.73,.84],curve:[590,355,230,390,410,460]},
 {screens:['favorites','mortgage'],label:'Всё сходится',title:'Сравните варианты. Рассчитайте платёж.',angles:[-6,6],levels:[.45,.54],heights:[.83,.74],curve:[520,300,565,680,320,450]},
 {screens:['partners','home'],label:'Партнёрская программа',title:'Рекомендуйте PULSE. Получайте больше.',angles:[-5,7],levels:[.44,.56],heights:[.84,.71],curve:[565,330,235,430,330,490]},
 {screens:['catalog','giveaway'],label:'Новогодний розыгрыш',title:'Новая квартира. Новый iPhone?',angles:[-7,5],levels:[.53,.43],heights:[.72,.85],curve:[590,350,600,700,370,410]}
];
const bitmaps=new Map(),paths=[...document.querySelectorAll('.city-thread,.city-echo,.city-comet')],shadows=[...document.querySelectorAll('.city-contact-shadow')];
const light=document.querySelector('.city-light'),architecture=document.querySelector('.city-architecture'),comet=document.querySelector('.city-comet');
const v=scenes[0].curve.slice(),vel=v.map(()=>0);let curve=scenes[0].curve;
let current=0,next=0,phase='enter',elapsed=0,time=0,raf=0,last=0,pair,poses=[],W=1,H=1,paused=false,preparing=false,seen=true;
let px=0,py=0,vx=0,vy=0,tx=0,ty=0;
const HOLD=6.4,ENTER=1.25,EXIT=.75;
const active=()=>!reduce.matches&&!paused&&!document.hidden&&seen;
const signal=p=>window.dispatchEvent(new CustomEvent('pulse:scene',{detail:{index:current,phase:p}}));
async function imageFor(name){
 if(!bitmaps.has(name))bitmaps.set(name,(async()=>{const im=new Image();im.width=560;im.height=1152;im.className='city-phone';im.alt='';im.decoding='async';im.src=`assets/phone-${name}.webp`;await im.decode();if(!im.naturalWidth)throw Error('Missing phone');im.dataset.decoded='true';return im})().catch(e=>{bitmaps.delete(name);throw e}));
 return bitmaps.get(name);
}
function layout(){
 if(!pair)return;
 W=stage.clientWidth;H=stage.clientHeight;poses=[];const mobile=matchMedia('(max-width:959px) and (orientation:portrait)').matches,s=scenes[current],pick=[0,1,1,0,1][current];
 [...pair.children].forEach((im,i)=>{
  const show=!mobile||i===pick;im.style.display=show?'block':'none';
  const angle=s.angles[i],rad=Math.abs(angle)*Math.PI/180,r=560/1152;
  const boundH=mobile?H*.88:H*s.heights[i];const boundW=mobile?W*.55:W*.41;
  const hh=Math.min(boundH/(Math.cos(rad)+r*Math.sin(rad)),boundW/(r*Math.cos(rad)+Math.sin(rad)));
  const x=mobile?W*.5:W*(i?.765:.295),y=mobile?H*.49:H*s.levels[i];
  im.style.width=`${hh*r}px`;im.style.height=`${hh}px`;im.style.left=`${x}px`;im.style.top=`${y}px`;
  poses.push({im,i,angle,hh,show,x,y,mobile});
 });
 if(!mobile&&innerHeight>500){const proof=document.querySelector('.social-proof').getBoundingClientRect(),bounds=document.querySelector('.showcase').getBoundingClientRect();title.style.bottom=`${Math.max(0,bounds.bottom-proof.bottom)}px`}else title.style.removeProperty('bottom');
 shadows.forEach((el,i)=>{const p=poses[i];el.style.display=p.show?'block':'none';el.style.width=`${p.hh*.7}px`;el.style.left=`${p.x-p.hh*.35}px`;el.style.right='auto';el.style.bottom=`${Math.max(0,H-(p.y+p.hh*.52)-15)}px`});
}
async function mount(index){
 const ims=await Promise.all(scenes[index].screens.map(imageFor));pair?.remove();pair=document.createElement('div');pair.className='city-pair';ims.forEach(im=>pair.append(im));host.append(pair);current=index;curve=scenes[index].curve;
 caption.textContent=scenes[index].title;label.textContent=scenes[index].label;stage.dataset.scene=String(index);layout();signal('enter');
}
async function prepare(){
 if(preparing)return;preparing=true;const wanted=(current+1)%scenes.length;
 try{await Promise.all(scenes[wanted].screens.map(imageFor));if(phase!=='hold')return;next=wanted;phase='exit';elapsed=0;curve=scenes[wanted].curve;signal('exit')}catch{elapsed=HOLD-3}finally{preparing=false}
}
function line(dt){
 for(let i=0;i<v.length;i++)[v[i],vel[i]]=criticalStep(v[i],vel[i],curve[i],dt,3.5);
 const breath=Math.sin(time*.31)*18;
 const d=off=>{
  const wave=Math.sin(time*.23)*22,curl=Math.cos(time*.19)*18;
  const joinX=365+wave,joinY=260+breath+(v[0]-545)*.35;
  const firstX=110+(v[2]-300)*.16,firstY=70+(v[3]-400)*.13+curl;
  const outgoingX=565+(v[4]-400)*.18,outgoingY=540+(v[5]-450)*.2-curl;
  return `M -110 ${525+off+breath*.4} C ${firstX} ${firstY+off}, ${joinX-(outgoingX-joinX)*.6} ${joinY-(outgoingY-joinY)*.6+off}, ${joinX} ${joinY+off} C ${outgoingX} ${outgoingY+off}, 680 ${480+(v[1]-300)*.2+off+wave}, 910 ${135+off-breath}`;
 };

 paths.forEach(el=>el.setAttribute('d',d(Number(el.dataset.offset||0))));
 comet.style.strokeDashoffset=String(-time*.047);
}
function render(dt){
 [px,vx]=criticalStep(px,vx,tx,dt,3.8);[py,vy]=criticalStep(py,vy,ty,dt,3.8);
 const entering=phase==='enter',exiting=phase==='exit',p=clamp01(elapsed/(exiting?EXIT:ENTER));
 pair.style.opacity='1';
 for(const o of poses){
  const local=entering?clamp01((elapsed-o.i*.12)/(ENTER-.12)):p,e=smootherstep(local);
  const x=entering?(1-e)*W*.7:exiting?-smootherstep(p)*W*.67:0;
  const y=entering?(1-e)*22:exiting?-smootherstep(p)*14:0;
  const rotation=o.angle+(entering?(1-e)*(o.i?5:-5):exiting?-smootherstep(p)*3:0);
  const drift=reduce.matches?0:Math.sin(time*.45+o.i*.8)*2.4;
  const opacity=entering?smootherstep(clamp01(local/.2)):exiting?1-smootherstep(p):1;
  o.im.style.opacity=String(opacity);
  o.im.style.transform=`translate(-50%,-50%) translate3d(${x+px*(o.i?-.6:1)}px,${y+drift+py*.6}px,0) rotate(${rotation}deg) scale(${entering?.965+.035*e:1})`;
  shadows[o.i].style.opacity=String(opacity*.7);shadows[o.i].style.transform=`translateX(${x*.5}px) scaleX(${.9+opacity*.1})`;
 }
 title.style.opacity=String(entering?smootherstep(clamp01((p-.4)/.6)):exiting?1-smootherstep(clamp01(p/.7)):1);
 title.style.transform=`translateY(${entering?(1-smootherstep(p))*8:0}px)`;
 light.style.transform=`translate3d(${px*.5}px,${py*.5}px,0)`;
 architecture.style.transform=`translate3d(${-px*.35}px,${-py*.25}px,0)`;
 line(dt);
}
function tick(now){
 raf=0;const dt=last?Math.max(0,(now-last)/1000):0;last=now;
 if(active()){time+=dt;elapsed+=dt}
 if(phase==='enter'&&elapsed>=ENTER){phase='hold';elapsed=0;signal('hold')}
 if(phase==='hold'&&elapsed>=HOLD&&active())void prepare();
 if(phase==='exit'&&elapsed>=EXIT){phase='loading';pair.style.opacity='0';title.style.opacity='0';void mount(next).then(()=>{phase='enter';elapsed=0;last=0;request()})}
 if(phase==='loading')return;render(active()?dt:0);if(active())raf=requestAnimationFrame(tick);
}
function request(){if(!raf&&pair){last=0;raf=requestAnimationFrame(tick)}}
function sync(){
 document.documentElement.classList.toggle('motion-paused',paused);document.documentElement.classList.toggle('is-background',document.hidden);
 const svg=document.querySelector('.sprite');if(!active())svg.pauseAnimations?.();else svg.unpauseAnimations?.();
 window.dispatchEvent(new Event('pulse:motion-change'));cancelAnimationFrame(raf);raf=0;if(reduce.matches){phase='hold';elapsed=0;render(0)}else request();
}
async function init(){
 await mount(0);if(reduce.matches){phase='hold';elapsed=0}render(0);stage.classList.add('city-ready');document.documentElement.classList.remove('city-loading');host.setAttribute('aria-busy','false');request();
 new ResizeObserver(()=>{layout();if(reduce.matches)render(0);else request()}).observe(stage);
 new IntersectionObserver(e=>{seen=e[0].isIntersecting;sync()},{threshold:.01}).observe(stage);
 document.addEventListener('visibilitychange',sync);reduce.addEventListener('change',sync);
 stage.addEventListener('pointermove',e=>{if(coarse.matches||reduce.matches)return;const r=stage.getBoundingClientRect();tx=((e.clientX-r.left)/r.width-.5)*11;ty=((e.clientY-r.top)/r.height-.5)*8});stage.addEventListener('pointerleave',()=>{tx=ty=0});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!e.repeat){paused=!paused;sync()}});
 const warm=async()=>{for(const name of new Set(scenes.flatMap(s=>s.screens)))try{await imageFor(name)}catch{}};
 if('requestIdleCallback'in window)requestIdleCallback(()=>void warm(),{timeout:1200});else setTimeout(warm,250);
}
init().catch(()=>{host.setAttribute('aria-busy','false');document.documentElement.classList.remove('city-loading')});
