// Decoded, reused device images; only compositor transforms change each frame.
const host=document.querySelector('.cinema'),stage=document.querySelector('.showcase');
const description=document.querySelector('.scene-description'),caption=document.querySelector('.scene-caption'),label=document.querySelector('.scene-label');
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
const HOLD=6.5,EXIT=.72,ENTER=1.10,REV='motion-4';
const images=new Map();
let clock=0,last=0,raf=0,current=0,next=0,previous=0,mode='enter',started=0,paused=false,visible=true,preparing=false,lastLine=-1;
let pair=null,dimensions={width:600,height:600},poses=[];
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{const t=clamp(x);return t*t*(3-2*t)};
const easeOut=x=>1-Math.pow(1-clamp(x),3);
function loadScreen(name,priority='low'){
 if(images.has(name))return images.get(name).promise;
 const image=new Image();image.decoding='async';image.fetchPriority=priority;image.className='rendered-phone';image.alt='';image.width=560;image.height=1152;image.draggable=false;
 const promise=(async()=>{
  const loaded=new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;});
  loaded.catch(()=>{});
  image.src=`assets/phone-${name}.webp?v=${REV}`;
  if(typeof image.decode==='function')await image.decode();else await loaded;
  if(!image.complete||!image.naturalWidth)throw Error('Device image unavailable');
  image.dataset.decoded='true';return image;
 })().catch(error=>{images.delete(name);throw error;});
 images.set(name,{image,promise});return promise;
}
function createPair(index){
 const p=document.createElement('div');p.className='phone-pair';p.setAttribute('aria-hidden','true');p.style.opacity='0';p.dataset.scene=String(index);
 scenes[index].screens.forEach(name=>p.append(images.get(name).image));host.append(p);return p;
}
function setScene(index){
 pair?.remove();current=index;pair=createPair(index);layout();stage.dataset.scene=String(index);
 caption.textContent=scenes[index].title;label.textContent=scenes[index].label;
}
async function transition(index){
 if(preparing||mode!=='hold'||index===current)return;preparing=true;
 try{
  await Promise.all(scenes[index].screens.map(async name=>{const image=await loadScreen(name);if(typeof image.decode==='function')await image.decode();}));
  // Keep the current scene fully visible until every incoming bitmap is decoded.
  if(reduced.matches||paused){preparing=false;return;}
  next=index;previous=current;mode='exit';started=clock;redraw();
 }catch{started=clock-HOLD+4;}finally{preparing=false;}
}
function layout(){
 if(!pair)return;const s=scenes[current],W=dimensions.width,mobile=W<480,pick=[0,1,1,0,1][current];poses=[];
 const H=dimensions.height;let safeBottom=Infinity,lowerEdge=0;
 if(matchMedia('(min-width:960px)').matches){
  const bounds=stage.getBoundingClientRect(),proof=document.querySelector('.social-proof').getBoundingClientRect();
  stage.style.setProperty('--scene-caption-bottom',`${(bounds.bottom-proof.bottom).toFixed(2)}px`);
  // Reserve space above the shared baseline for the badge and a clear phone gap.
  safeBottom=proof.bottom-bounds.top-description.offsetHeight-20;
 }
 [...pair.children].forEach((im,i)=>{
  im.style.display=mobile&&i!==pick?'none':'';
  const angle=s.angles[i],r=700/1440,rad=Math.abs(angle)*Math.PI/180;
  const hh=mobile?Math.min(H*.92/(Math.cos(rad)+r*Math.sin(rad)),W*.78/(r*Math.cos(rad)+Math.sin(rad))):Math.min(H*.88/(Math.cos(rad)+r*Math.sin(rad)),W*.46/(r*Math.cos(rad)+Math.sin(rad)))*(s.heights[i]/.90);
  if(!mobile||i===pick)lowerEdge=Math.max(lowerEdge,H*(mobile?.5:.5+s.levels[i])+hh*(Math.cos(rad)+r*Math.sin(rad))/2);
  im.style.width=`${(hh*r).toFixed(2)}px`;im.style.height=`${hh.toFixed(2)}px`;im.style.left=`${(W*(mobile?.5:i?.75:.25)).toFixed(2)}px`;im.style.top=`${(H*(mobile?.5:.5+s.levels[i])).toFixed(2)}px`;
  im.style.transform=`translate(-50%,-50%) rotate(${angle}deg)`;poses.push({im,angle,phase:i});
 });
 const lift=Math.max(0,lowerEdge-safeBottom);
 if(lift)for(const {im} of poses)im.style.top=`${(parseFloat(im.style.top)-lift).toFixed(2)}px`;
}
function drift(){for(const p of poses){const y=Math.sin(clock*.38+p.phase)*Math.min(2,dimensions.height*.006);p.im.style.transform=`translate(-50%,-50%) translateY(${y.toFixed(2)}px) rotate(${p.angle}deg)`;}}
function drawLines(){
 if(clock-lastLine<1/30&&!reduced.matches)return;lastLine=clock;
 const t=mode==='exit'?smooth((clock-started)/EXIT)*.5:mode==='enter'?.5+easeOut((clock-started)/ENTER)*.5:1;
 const a=curves[previous],b=curves[mode==='exit'?next:current],c=b.map((v,i)=>a[i]+(v-a[i])*t);
 paths.forEach((p,i)=>{const off=i*14,w=Math.sin(clock*.24+i*.04)*14;p.setAttribute('d',`M -120 ${c[0]+off+w} C ${c[2]} ${c[3]+off}, ${c[4]} ${c[5]+off+w}, 810 ${c[1]+off}`)});
}
function render(){
 const elapsed=clock-started;
 if(mode==='exit'&&elapsed>=EXIT){setScene(next);mode='enter';started=clock;}
 else if(mode==='enter'&&elapsed>=ENTER){mode='hold';started=clock;}
 if(mode==='hold'&&!paused&&!reduced.matches&&clock-started>=HOLD)void transition((current+1)%scenes.length);
 const p=clamp((clock-started)/(mode==='exit'?EXIT:ENTER));
 const x=mode==='exit'?-p*p*dimensions.width*.94:mode==='enter'?(1-easeOut(p))*dimensions.width*.94:0;
 pair.style.transform=`translate3d(${x.toFixed(2)}px,0,0)`;
 pair.style.opacity=String(mode==='exit'?1-smooth(p):mode==='enter'?smooth(p/.28):1);
 description.style.opacity=String(mode==='exit'?1-smooth(p/.65):mode==='enter'?smooth((p-.24)/.55):1);
 if(mode==='hold')drift();drawLines();
}
function tick(t){raf=0;const delta=last?Math.min((t-last)/1000,.25):0;last=t;if(!paused&&!reduced.matches&&!document.hidden&&visible)clock+=delta;render();if(!paused&&!reduced.matches&&!document.hidden&&visible)raf=requestAnimationFrame(tick);}
function redraw(){if(!raf){last=0;raf=requestAnimationFrame(tick)}}
function syncMotion(){
 document.documentElement.classList.toggle('motion-paused',paused);
 const svg=document.querySelector('.sprite');if(paused||reduced.matches||document.hidden)svg.pauseAnimations?.();else svg.unpauseAnimations?.();
 window.dispatchEvent(new Event('pulse:motion-change'));
}
async function warmRemaining(){for(const name of [...new Set(scenes.flatMap(s=>s.screens))]){try{await loadScreen(name)}catch{/* A later transition retries while retaining the current picture. */}}}
async function init(){
 await Promise.all(scenes[0].screens.map(name=>loadScreen(name,'high')));
 const r=host.getBoundingClientRect();dimensions={width:r.width,height:r.height};setScene(0);syncMotion();if(reduced.matches)mode='hold';
 stage.classList.add('cinema-ready');host.setAttribute('aria-busy','false');
 const resize=new ResizeObserver(()=>{const r=host.getBoundingClientRect();dimensions={width:r.width,height:r.height};layout();redraw()});resize.observe(host);resize.observe(document.querySelector('.copy'));resize.observe(description);
 document.addEventListener('visibilitychange',()=>{document.documentElement.classList.toggle('is-background',document.hidden);syncMotion();if(document.hidden){cancelAnimationFrame(raf);raf=0}else redraw()});
 new IntersectionObserver(e=>{visible=e[0].isIntersecting;if(visible)redraw();else{cancelAnimationFrame(raf);raf=0}},{threshold:.01}).observe(stage);
 reduced.addEventListener('change',()=>{mode='hold';started=clock;syncMotion();redraw()});
 document.addEventListener('keydown',e=>{if(e.key!=='Escape'||e.repeat)return;paused=!paused;syncMotion();cancelAnimationFrame(raf);raf=0;redraw()});
 // Present a decoded, positioned layer before starting the entrance clock.
 requestAnimationFrame(()=>requestAnimationFrame(()=>{started=clock;redraw();}));
 if('requestIdleCallback' in window)requestIdleCallback(()=>void warmRemaining(),{timeout:1200});else setTimeout(()=>void warmRemaining(),200);
}
init().catch(()=>{document.documentElement.classList.remove('cinema-loading');host.setAttribute('aria-busy','false');});
