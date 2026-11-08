// Original app captures on device renders. One pair owns the stage at a time.
const host=document.querySelector('.cinema'),stage=document.querySelector('.showcase');
const description=document.querySelector('.scene-description'),caption=document.querySelector('.scene-caption'),label=document.querySelector('.scene-label');
const pauseButton=document.querySelector('.motion-toggle'),dots=[...document.querySelectorAll('.scene-dot')];
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const scenes=[
 {title:'Новостройки — перед вами.',label:'Выбирайте',screens:['home','catalog'],angles:[-4,4],heights:[.88,.78],levels:[-.015,.035]},
 {title:'Рассмотрите всё до деталей.',label:'Находите своё',screens:['property','floorplans'],angles:[-3,3],heights:[.79,.89],levels:[.035,-.015]},
 {title:'Сравните варианты. Рассчитайте платёж.',label:'Решайте спокойно',screens:['favorites','mortgage'],angles:[-4,3],heights:[.87,.79],levels:[-.02,.035]},
 {title:'Рекомендуйте PULSE. Получайте больше.',label:'Партнёрская программа',screens:['partners','home'],angles:[-3,4],heights:[.90,.76],levels:[-.015,.045]},
 {title:'Новая квартира. Новый iPhone?',label:'Новогодний розыгрыш',screens:['catalog','giveaway'],angles:[-4,3],heights:[.76,.90],levels:[.045,-.015]},
];
const curves=[[470,240,160,-30,435,770],[370,430,310,-140,360,920],[535,180,10,140,555,530],[390,360,180,-30,470,840],[490,210,280,-180,380,700]];
const paths=[...document.querySelectorAll('.flow-line')];
const HOLD=6.5,EXIT=.95,ENTER=1.05;
let clock=0,last=0,raf=0,current=0,next=0,previous=0,mode='enter',started=0,paused=false,visible=true,queued=null;
let pair=null,dimensions={width:600,height:600};
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{const t=clamp(x);return t*t*(3-2*t)};
function createPair(index){
 const p=document.createElement('div');p.className='phone-pair';p.setAttribute('aria-hidden','true');p.style.opacity='0';p.dataset.scene=String(index);
 scenes[index].screens.forEach(name=>{const im=new Image();im.src=`assets/phone-${name}.webp`;im.className='rendered-phone';im.alt='';im.width=700;im.height=1440;im.draggable=false;p.append(im)});host.append(p);return p;
}
function setScene(index){
 pair?.remove();current=index;pair=createPair(index);layout();stage.dataset.scene=String(index);
 caption.textContent=scenes[index].title;label.textContent=scenes[index].label;
 dots.forEach((d,i)=>d.setAttribute('aria-current',String(index===i)));
}
function transition(index){
 if(index===current&&mode==='hold')return;
 if(paused||reduced.matches){previous=current;setScene(index);mode='hold';started=clock;redraw();return;}
 if(mode!=='hold'){queued=index;return;}
 next=index;previous=current;mode='exit';started=clock;redraw();
}
function layout(){
 if(!pair)return;const s=scenes[current],W=dimensions.width,H=dimensions.height;
 [...pair.children].forEach((im,i)=>{
  const mobile=dimensions.width<480;const pick=[0,1,1,0,1][current];im.style.display=mobile&&i!==pick?'none':'';
  const angle=s.angles[i],r=700/1440,rad=Math.abs(angle)*Math.PI/180;
  // Restrict both rotated rectangles to separate lanes and to the image row.
  const hh=mobile?Math.min(H*.92/(Math.cos(rad)+r*Math.sin(rad)),W*.78/(r*Math.cos(rad)+Math.sin(rad))):Math.min(H*.88/(Math.cos(rad)+r*Math.sin(rad)),W*.46/(r*Math.cos(rad)+Math.sin(rad)))*(s.heights[i]/.90);
  const ww=hh*r,cx=W*(mobile?.5:i?.75:.25),cy=H*(mobile?.5:.5+s.levels[i]);
  im.style.width=`${ww.toFixed(2)}px`;im.style.height=`${hh.toFixed(2)}px`;im.style.left=`${cx.toFixed(2)}px`;im.style.top=`${cy.toFixed(2)}px`;
  const drift=Math.sin(clock*.38+i)*Math.min(3,H*.008);
  im.style.transform=`translate(-50%,-50%) translateY(${drift.toFixed(2)}px) rotate(${angle}deg)`;
 });
}
function drawLines(){
 const t=mode==='exit'?smooth((clock-started)/EXIT)*.5:mode==='enter'?.5+smooth((clock-started)/ENTER)*.5:1;
 const a=curves[previous],b=curves[mode==='exit'?next:current];
 const c=b.map((v,i)=>a[i]+(v-a[i])*t);
 paths.forEach((p,i)=>{const off=i*14,w=Math.sin(clock*.24+i*.04)*14;p.setAttribute('d',`M -120 ${c[0]+off+w} C ${c[2]} ${c[3]+off}, ${c[4]} ${c[5]+off+w}, 810 ${c[1]+off}`)});
}
function render(){
 const elapsed=clock-started;
 if(mode==='exit'&&elapsed>=EXIT){setScene(next);mode='enter';started=clock;}
 else if(mode==='enter'&&elapsed>=ENTER){mode='hold';started=clock;}
 if(mode==='hold'&&!paused&&!reduced.matches){
  if(queued!==null){const q=queued;queued=null;if(q!==current)transition(q)}
  else if(clock-started>=HOLD)transition((current+1)%scenes.length);
 }
 const p=clamp((clock-started)/(mode==='exit'?EXIT:ENTER));
 // Whole-pair translation keeps lane separation at every intermediate frame.
 const x=mode==='exit'?-smooth(p)*dimensions.width*1.12:mode==='enter'?(1-smooth(p))*dimensions.width*1.12:0;
 pair.style.transform=`translate3d(${x.toFixed(2)}px,0,0)`;
 pair.style.opacity=String(mode==='exit'?1-smooth((p-.12)/.68):mode==='enter'?smooth(p/.72):1);
 description.style.opacity=String(mode==='exit'?1-smooth(p/.55):mode==='enter'?smooth((p-.28)/.60):1);
 layout();drawLines();
}
function tick(t){raf=0;const delta=last?Math.min((t-last)/1000,.12):0;last=t;if(!paused&&!reduced.matches&&!document.hidden&&visible)clock+=delta;render();if(!paused&&!reduced.matches&&!document.hidden&&visible)raf=requestAnimationFrame(tick);}
function redraw(){if(!raf){last=0;raf=requestAnimationFrame(tick)}}
function syncRibbonMotion(){const svg=document.querySelector('.sprite');if(paused||reduced.matches||document.hidden)svg.pauseAnimations?.();else svg.unpauseAnimations?.();}
function pauseUI(){syncRibbonMotion();document.documentElement.classList.toggle('motion-paused',paused);pauseButton.setAttribute('aria-pressed',String(paused));pauseButton.setAttribute('aria-label',paused?'Продолжить анимацию':'Приостановить анимацию');pauseButton.querySelector('.pause-icon').hidden=paused;pauseButton.querySelector('.play-icon').hidden=!paused;cancelAnimationFrame(raf);raf=0;redraw();}
async function init(){
 await Promise.all([...new Set(scenes.flatMap(s=>s.screens))].map(name=>new Promise((resolve,reject)=>{const im=new Image();im.onload=resolve;im.onerror=reject;im.src=`assets/phone-${name}.webp`})));
 const initialRect=host.getBoundingClientRect();dimensions={width:initialRect.width,height:initialRect.height};setScene(0);syncRibbonMotion();if(reduced.matches)mode='hold';stage.classList.add('cinema-ready');host.setAttribute('aria-busy','false');
 new ResizeObserver(()=>{const r=host.getBoundingClientRect();dimensions={width:r.width,height:r.height};redraw()}).observe(host);
 dots.forEach((d,i)=>d.addEventListener('click',()=>transition(i)));
 pauseButton.addEventListener('click',()=>{paused=!paused;pauseUI()});
 document.addEventListener('visibilitychange',()=>{document.documentElement.classList.toggle('is-background',document.hidden);syncRibbonMotion();if(document.hidden){cancelAnimationFrame(raf);raf=0}else redraw()});
 new IntersectionObserver(e=>{visible=e[0].isIntersecting;if(visible)redraw();else{cancelAnimationFrame(raf);raf=0}},{threshold:.01}).observe(stage);
 reduced.addEventListener('change',()=>{queued=null;mode='hold';started=clock;pauseUI()});redraw();
}
init().catch(()=>{host.setAttribute('aria-busy','false');document.querySelector('.scene-controls').hidden=true});
