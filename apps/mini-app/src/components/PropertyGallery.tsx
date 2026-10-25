import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {ChevronLeft,ChevronRight,ImageOff,Maximize2,X} from 'lucide-react';
import {catalogImageVariant,type PropertyPhoto} from '../../../../packages/domain/propertyPresentation';
import styles from './PropertyGallery.module.css';

function Photo({photo,eager=false,retry=true}:{photo:PropertyPhoto;eager?:boolean;retry?:boolean}){
 const [broken,setBroken]=React.useState(false);
 return broken?<div className={styles.unavailable}><ImageOff size={28}/><span>Фото не загрузилось</span>{retry&&<button type="button" onClick={()=>setBroken(false)}>Попробовать снова</button>}</div>:<img src={photo.url} alt={photo.alt} draggable={false} loading={eager?'eager':'lazy'} decoding="async" onError={()=>setBroken(true)}/>;
}

export function PropertyGallery({name,photos,index,onIndexChange}:{name:string;photos:PropertyPhoto[];index:number;onIndexChange:(index:number)=>void}){
 const [open,setOpen]=React.useState(false);
 const hero=React.useRef<HTMLDivElement>(null),full=React.useRef<HTMLDivElement>(null);
 const trigger=React.useRef<HTMLElement|null>(null);
 const viewer=React.useRef<HTMLDivElement>(null),overlay=React.useRef<HTMLDivElement>(null);
 const closing=React.useRef(false),alive=React.useRef(true),flight=React.useRef<HTMLElement|null>(null);
 const animations=React.useRef<Animation[]>([]),closeTimer=React.useRef<ReturnType<typeof setTimeout>|null>(null),settleTimer=React.useRef<ReturnType<typeof setTimeout>|null>(null);
 const pointers=React.useRef(new Set<number>());
 const gesture=React.useRef<{id:number;x:number;y:number;at:number;axis:'x'|'y'|null;distance:number;velocity:number}|null>(null);
 const resetDrag=(smooth=false)=>{
  gesture.current=null;
  const node=viewer.current;if(!node)return;
  if(settleTimer.current)clearTimeout(settleTimer.current);
  if(smooth)node.dataset.settling='true';else delete node.dataset.settling;
  delete node.dataset.dragging;
  for(const key of ['--gallery-drag-x','--gallery-drag-y','--gallery-scale','--gallery-progress'])node.style.removeProperty(key);
  node.style.removeProperty('background-color');overlay.current?.style.removeProperty('opacity');
  if(smooth)settleTimer.current=setTimeout(()=>{if(viewer.current)delete viewer.current.dataset.settling},440);
 };
 const requestClose=()=>{
  if(closing.current)return;
  const node=viewer.current,rail=hero.current;
  if(!node||!rail||window.matchMedia('(prefers-reduced-motion: reduce)').matches){resetDrag();setOpen(false);return}
  closing.current=true;node.dataset.closing='true';
  rail.scrollLeft=rail.clientWidth*current.current;
  const duration=380;
  const finish=()=>{
   if(!closing.current)return;
   closing.current=false;if(closeTimer.current)clearTimeout(closeTimer.current);
   flight.current?.remove();flight.current=null;animations.current=[];
   if(alive.current)setOpen(false);
  };
  const source=full.current?.children[current.current]?.querySelector('img');
  const target=rail.getBoundingClientRect();
  const body=rail.parentElement?.nextElementSibling?.getBoundingClientRect();
  const visible={left:Math.max(0,target.left),right:Math.min(innerWidth,target.right),top:Math.max(0,target.top),bottom:Math.min(innerHeight,target.bottom,body?.top??target.bottom)};
  if(source instanceof HTMLImageElement&&source.complete&&source.naturalWidth&&visible.bottom-visible.top>24){
   const box=source.getBoundingClientRect(),fit=Math.min(box.width/source.naturalWidth,box.height/source.naturalHeight);
   const width=source.naturalWidth*fit,height=source.naturalHeight*fit,left=box.left+(box.width-width)/2,top=box.top+(box.height-height)/2;
   const scale=Math.max(target.width/width,target.height/height);
   const x=target.left+(target.width-width*scale)/2,y=target.top+(target.height-height*scale)/2;
   const inset=[(visible.top-y)/scale,(x+width*scale-visible.right)/scale,(y+height*scale-visible.bottom)/scale,(visible.left-x)/scale].map(v=>Math.max(0,v)+'px').join(' ');
   const ghost=document.createElement('div');ghost.className=styles.returnPhoto;ghost.dataset.galleryReturn='true';ghost.setAttribute('aria-hidden','true');
   Object.assign(ghost.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px',backgroundImage:'url('+JSON.stringify(source.currentSrc||source.src)+')'});
   document.body.append(ghost);flight.current=ghost;
   if(full.current)full.current.style.visibility='hidden';
   animations.current.push(ghost.animate([{transform:'translate3d(0,0,0) scale(1)',clipPath:'inset(0px)'},{transform:`translate3d(${x-left}px,${y-top}px,0) scale(${scale})`,clipPath:`inset(${inset})`}],{duration,easing:'cubic-bezier(.22,.8,.2,1)',fill:'forwards'}));
  }
  animations.current.push(node.animate([{opacity:1},{opacity:0}],{duration,easing:'ease',fill:'forwards'}));
  if(overlay.current)animations.current.push(overlay.current.animate([{opacity:getComputedStyle(overlay.current).opacity},{opacity:0}],{duration,easing:'ease',fill:'forwards'}));
  closeTimer.current=setTimeout(finish,duration+120);
  void Promise.all(animations.current.map(animation=>animation.finished)).then(finish,finish);
 };
 const pointerDown=(event:React.PointerEvent<HTMLDivElement>)=>{
  if(closing.current||event.button!==0||pointers.current.size>1||(window.visualViewport?.scale??1)>1.01||(event.target as HTMLElement).closest('button'))return;
  resetDrag();gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,at:performance.now(),axis:null,distance:0,velocity:0};
 };
 const pointerMove=(event:React.PointerEvent<HTMLDivElement>)=>{
  const drag=gesture.current;if(!drag||drag.id!==event.pointerId||pointers.current.size>1)return;
  const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
  if(!drag.axis){if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy))drag.axis='x';else if(dy>12&&dy>Math.abs(dx)*1.2){drag.axis='y';try{full.current?.setPointerCapture(event.pointerId)}catch{}}else return}
  if(drag.axis!=='y')return;
  event.preventDefault();drag.distance=Math.max(0,dy);drag.velocity=drag.distance/Math.max(1,performance.now()-drag.at);
  const progress=Math.min(1,drag.distance/(innerHeight*.6)),node=viewer.current;if(!node)return;
  node.dataset.dragging='true';node.style.setProperty('--gallery-drag-x',dx*.2+'px');node.style.setProperty('--gallery-drag-y',drag.distance+'px');node.style.setProperty('--gallery-scale',String(1-progress*.16));node.style.setProperty('--gallery-progress',String(progress));
  node.style.backgroundColor='transparent';if(overlay.current)overlay.current.style.opacity=String(1-progress*.8);
 };
 const pointerUp=(event:React.PointerEvent<HTMLDivElement>)=>{
  const drag=gesture.current;if(!drag||drag.id!==event.pointerId)return;
  gesture.current=null;
  if(drag.axis==='y'&&(drag.distance>=Math.max(100,Math.min(180,innerHeight*.18))||(drag.distance>90&&drag.velocity>.8)))requestClose();else resetDrag(true);
 };
 React.useEffect(()=>{
  alive.current=true;return()=>{alive.current=false;closing.current=false;for(const animation of animations.current)animation.cancel();flight.current?.remove();if(closeTimer.current)clearTimeout(closeTimer.current);if(settleTimer.current)clearTimeout(settleTimer.current)};
 },[]);

 const current=React.useRef(index);current.current=index;
 const active=Math.max(0,Math.min(index,photos.length-1));
 const move=(next:number)=>{
  if(closing.current)return;resetDrag();
  const value=Math.max(0,Math.min(next,photos.length-1));
  current.current=value;onIndexChange(value);
  const node=full.current;if(node)node.scrollTo({left:node.clientWidth*value,behavior:'instant'});
 };
 const read=(event:React.UIEvent<HTMLDivElement>)=>{
  const node=event.currentTarget;
  if(node.clientWidth){const value=Math.max(0,Math.min(photos.length-1,Math.round(node.scrollLeft/node.clientWidth)));current.current=value;onIndexChange(value)}
 };
 const changeOpen=(value:boolean)=>{
  if(!value){requestClose();return}
  if(closing.current)return;
  resetDrag();pointers.current.clear();trigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  setOpen(true);
 };
 React.useEffect(()=>{
  if(!open)return;
  const reset=()=>{pointers.current.clear();resetDrag()};window.addEventListener('blur',reset);
  return()=>window.removeEventListener('blur',reset);
 },[open]);
 React.useEffect(()=>{
  if(!open)return;
  const node=full.current;
  const align=()=>{if(node)node.scrollLeft=node.clientWidth*current.current;};
  align();const observer=new ResizeObserver(align);if(node)observer.observe(node);
  return()=>observer.disconnect();
 },[open]);
 React.useEffect(()=>{
  if(open)return;
  const node=hero.current;
  if(node)node.scrollLeft=node.clientWidth*current.current;
 },[open]);
 React.useEffect(()=>{if(open)document.documentElement.dataset.propertyGallery='open';return()=>{delete document.documentElement.dataset.propertyGallery}},[open]);
 if(!photos.length)return <div className={styles.empty}><ImageOff size={32}/><span>Фото проекта готовятся</span></div>;
 return <Dialog.Root open={open} onOpenChange={changeOpen}>
  <div ref={hero} className={styles.heroRail} onScroll={event=>{if(!open)read(event)}} aria-label={'Фотографии '+name}>
   {photos.map((photo,i)=><button type="button" key={photo.url} className={styles.heroPhoto} aria-label={'Открыть фото '+(i+1)+' из '+photos.length} onClick={()=>{onIndexChange(i);changeOpen(true)}}><Photo photo={photo} eager={i===0} retry={false}/></button>)}
  </div>
  <button type="button" className={styles.openPhotos} onClick={()=>changeOpen(true)} aria-label="Открыть все фотографии"><Maximize2 size={14}/><span>{active+1} / {photos.length}</span></button>
  <Dialog.Portal><Dialog.Overlay ref={overlay} className={styles.overlay}/><Dialog.Content ref={viewer} className={styles.viewer} onPointerDownCapture={event=>{pointers.current.add(event.pointerId);if(pointers.current.size>1)resetDrag(true)}} onPointerUpCapture={event=>pointers.current.delete(event.pointerId)} onPointerCancelCapture={event=>pointers.current.delete(event.pointerId)} aria-describedby={undefined} onOpenAutoFocus={event=>{event.preventDefault();const node=full.current;if(node){node.scrollLeft=node.clientWidth*current.current;node.focus({preventScroll:true})}}} onCloseAutoFocus={event=>{event.preventDefault();trigger.current?.focus({preventScroll:true})}} onKeyDown={event=>{if(event.key==='ArrowRight'){event.preventDefault();move(active+1)}if(event.key==='ArrowLeft'){event.preventDefault();move(active-1)}}}>
   <header className={styles.header}><div><Dialog.Title className={styles.title}>{name}</Dialog.Title><span aria-live="polite">{active+1} из {photos.length}</span></div><Dialog.Close className={styles.close} aria-label="Закрыть фотографии"><X size={22}/></Dialog.Close></header>
   <div className={styles.stage}>
    <div ref={full} tabIndex={0} data-allow-pinch-zoom="true" className={styles.fullRail} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={()=>resetDrag(true)} onScroll={read} aria-label="Полноэкранные фотографии">
     {photos.map((photo,i)=><div className={styles.fullPhoto} key={photo.url}>{Math.abs(i-active)<=1&&<Photo photo={photo} eager/>}</div>)}
    </div>
    {photos.length>1&&<><button type="button" className={styles.previous} aria-label="Предыдущее фото" disabled={active===0} onClick={()=>move(active-1)}><ChevronLeft size={24}/></button><button type="button" className={styles.next} aria-label="Следующее фото" disabled={active===photos.length-1} onClick={()=>move(active+1)}><ChevronRight size={24}/></button></>}
   </div>
   <footer className={styles.footer}><span className={styles.swipeHint}>Потяните фото вниз, чтобы закрыть</span><p>{photos[active]?.alt}</p>{photos.length>1&&<div className={styles.thumbnails} aria-label="Выбор фотографии">{photos.map((photo,i)=><button type="button" key={photo.url} aria-label={'Фото '+(i+1)} aria-pressed={i===active} onClick={()=>move(i)}><img src={catalogImageVariant(photo.url,'thumb')} alt="" loading="lazy" onError={e=>{if(e.currentTarget.getAttribute('src')!==photo.url)e.currentTarget.src=photo.url}}/></button>)}</div>}</footer>
  </Dialog.Content></Dialog.Portal>
 </Dialog.Root>;
}
