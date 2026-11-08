// Physically rendered phones composited with continuous browser motion.
// No WebGL, external scripts, authentication or API calls at runtime.
const host=document.querySelector('.cinema');
const stage=document.querySelector('.showcase');
const pauseButton=document.querySelector('.motion-toggle');
const caption=document.querySelector('.scene-caption');
const label=document.querySelector('.scene-label');
const description=document.querySelector('.scene-description');
const dots=[...document.querySelectorAll('.scene-dot')];
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const sceneSpecs=[
 {title:'Новостройки — перед вами.',label:'Выбирайте',screens:['home','catalog'],poses:[[-.97,.32,.25,-.07,.22,-.10,.98],[1.02,-.25,-.42,.08,-.27,.09,.90]]},
 {title:'Рассмотрите всё до деталей.',label:'Находите своё',screens:['property','floorplans'],poses:[[-.90,-.16,.1,.03,.29,-.12,1.02],[1.12,.43,-.64,-.05,-.30,.16,.84]]},
 {title:'Сравните варианты. Рассчитайте платёж.',label:'Решайте спокойно',screens:['favorites','mortgage'],poses:[[-1.08,.46,-.55,-.08,.27,-.16,.86],[.93,-.10,.24,.04,-.23,.10,1.01]]},
 {title:'Рекомендуйте PULSE. Получайте больше.',label:'Партнёрская программа',screens:['partners','home'],poses:[[-.76,.05,.42,.02,.18,-.07,1.08],[1.25,.25,-1.05,-.04,-.32,.17,.78]]},
 {title:'Новая квартира. Новый iPhone?',label:'Новогодний розыгрыш',screens:['catalog','giveaway'],poses:[[-1.05,.30,-.70,-.04,.32,-.14,.85],[.81,-.13,.38,.02,-.17,.09,1.07]]},
];

const paths=[...document.querySelectorAll('.flow-line')];
let raf=0,clock=0,lastTime=0,manualPause=false,inView=true,current=0,initial=true;
let active=null,leaving=null,transitionAt=0;
let dimensions={width:600,height:700};
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=t=>1-Math.pow(1-t,4);
function createPair(index){
 const pair=document.createElement('div');pair.className='phone-pair';pair.dataset.index=String(index);pair.setAttribute('aria-hidden','true');
 sceneSpecs[index].screens.forEach(name=>{const image=document.createElement('img');image.className='rendered-phone';image.src=`assets/phone-${name}.webp`;image.alt='';image.width=700;image.height=1440;image.draggable=false;pair.append(image);});host.append(pair);return pair;
}
function select(index){
 if(index===current&&!initial)return;
 leaving?.remove();leaving=active;current=index;active=createPair(index);transitionAt=clock;initial=false;
 caption.textContent=sceneSpecs[index].title;label.textContent=sceneSpecs[index].label;
 dots.forEach((d,i)=>d.setAttribute('aria-current',String(i===index)));stage.dataset.scene=String(index);
}
function position(pair,phase,dir){
 if(!pair)return;const poses=sceneSpecs[Number(pair.dataset.index)].poses;
 [...pair.children].forEach((p,i)=>{
  const a=poses[i],t=clamp((phase-i*.11)/1.30),e=ease(t),drift=Math.sin(clock*.49+i*1.9)*.018;
  const shift=dir==='in'?(1-e)*1.30:dir==='out'?-Math.pow(t,3)*1.40:0;
  const x=(a[0]*.173+shift)*dimensions.width;
  const y=(-a[1]*.155+drift+(dir==='in'?(1-e)*(i?-.10:.12):dir==='out'?-t*.09:0))*dimensions.height;
  const roll=(a[5]+(dir==='in'?(1-e)*-.18:dir==='out'?t*.17:0))*180/Math.PI;
  const turn=Math.sin(clock*.24+i)*2+(dir==='in'?(1-e)*-12:0);
  p.style.transform=`translate(-50%,-50%) translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) rotate(${roll.toFixed(2)}deg) perspective(1000px) rotateY(${turn.toFixed(2)}deg) scale(${a[6]})`;
  p.style.opacity=String(dir==='in'?clamp(phase*3-i*.15):1-clamp((t-.70)/.30));
  p.style.zIndex=String(Math.round((a[2]+2)*10));
 });
}
const lineScenes=[
 [470,240,160,-30,435,770],
 [370,430,310,-140,360,920],
 [535,180,10,140,555,530],
 [390,360,180,-30,470,840],
 [490,210,280,-180,380,700]
];
function lines(time,phase){
 const now=lineScenes[current],prev=lineScenes[Number(leaving?.dataset.index??current)];const blend=ease(clamp(phase/1.8));
 const a=now.map((v,i)=>prev[i]+(v-prev[i])*blend);
 paths.forEach((p,i)=>{const offset=i*14,wave=Math.sin(time*.26+i*.05)*16;p.setAttribute('d',`M -120 ${a[0]+offset+wave} C ${a[2]} ${a[3]+offset}, ${a[4]} ${a[5]+offset+wave}, 810 ${a[1]+offset}`);});
}
function draw(timestamp){
 raf=0;const dt=lastTime?Math.min(.25,(timestamp-lastTime)/1000):0;lastTime=timestamp;
 if(!manualPause&&!reduced.matches&&!document.hidden&&inView)clock+=dt;
 if(!manualPause&&!reduced.matches&&clock-transitionAt>7.4)select((current+1)%sceneSpecs.length);
 const phase=reduced.matches?2:clock-transitionAt;
 position(active,phase,'in');position(leaving,phase,'out');lines(clock,phase);
 description.style.opacity=String(clamp((phase-.35)*1.9));
 if(phase>1.6&&leaving){leaving.remove();leaving=null;}
 if(!document.hidden&&inView&&!manualPause&&!reduced.matches)raf=requestAnimationFrame(draw);
}
function redraw(){if(!raf){lastTime=0;raf=requestAnimationFrame(draw);}}
function pauseUI(){pauseButton.setAttribute('aria-pressed',String(manualPause));pauseButton.setAttribute('aria-label',manualPause?'Продолжить анимацию':'Приостановить анимацию');pauseButton.querySelector('.pause-icon').hidden=manualPause;pauseButton.querySelector('.play-icon').hidden=!manualPause;if(manualPause){cancelAnimationFrame(raf);raf=0;}redraw();}
async function init(){
 const names=[...new Set(sceneSpecs.flatMap(s=>s.screens))];
 await Promise.all(names.map(name=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve();image.onerror=reject;image.src=`assets/phone-${name}.webp`;})));
 select(0);if(reduced.matches)clock=2;
 stage.classList.add('cinema-ready');host.setAttribute('aria-busy','false');
 new ResizeObserver(()=>{const r=host.getBoundingClientRect();dimensions={width:r.width,height:r.height};redraw();}).observe(host);
 pauseButton.addEventListener('click',()=>{manualPause=!manualPause;pauseUI();});
 dots.forEach((d,i)=>d.addEventListener('click',()=>{select(i);if(reduced.matches||manualPause)clock=transitionAt+2;redraw();}));
 document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else redraw();});
 new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;if(inView)redraw();else{cancelAnimationFrame(raf);raf=0;}},{threshold:.01}).observe(stage);
 reduced.addEventListener('change',()=>{clock=transitionAt+2;pauseUI();});redraw();
}
init().catch(()=>{host.setAttribute('aria-busy','false');document.querySelector('.scene-controls').hidden=true;});
