import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {ChevronLeft,ChevronRight,ImageOff,Maximize2,X} from 'lucide-react';
import type {PropertyPhoto} from '../../../../packages/domain/propertyPresentation';
import styles from './PropertyGallery.module.css';

function Photo({photo,eager=false,retry=true}:{photo:PropertyPhoto;eager?:boolean;retry?:boolean}){
 const [broken,setBroken]=React.useState(false);
 return broken?<div className={styles.unavailable}><ImageOff size={28}/><span>Фото не загрузилось</span>{retry&&<button type="button" onClick={()=>setBroken(false)}>Попробовать снова</button>}</div>:<img src={photo.url} alt={photo.alt} draggable={false} loading={eager?'eager':'lazy'} decoding="async" onError={()=>setBroken(true)}/>;
}

export function PropertyGallery({name,photos,index,onIndexChange}:{name:string;photos:PropertyPhoto[];index:number;onIndexChange:(index:number)=>void}){
 const [open,setOpen]=React.useState(false);
 const hero=React.useRef<HTMLDivElement>(null),full=React.useRef<HTMLDivElement>(null);
 const trigger=React.useRef<HTMLElement|null>(null);
 const current=React.useRef(index);current.current=index;
 const active=Math.max(0,Math.min(index,photos.length-1));
 const move=(next:number)=>{
  const value=Math.max(0,Math.min(next,photos.length-1));
  onIndexChange(value);
  const node=full.current;if(node)node.scrollTo({left:node.clientWidth*value,behavior:'instant'});
 };
 const read=(event:React.UIEvent<HTMLDivElement>)=>{
  const node=event.currentTarget;
  if(node.clientWidth)onIndexChange(Math.max(0,Math.min(photos.length-1,Math.round(node.scrollLeft/node.clientWidth))));
 };
 const changeOpen=(value:boolean)=>{
  if(value)trigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  setOpen(value);
 };
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
  <Dialog.Portal><Dialog.Overlay className={styles.overlay}/><Dialog.Content className={styles.viewer} aria-describedby={undefined} onOpenAutoFocus={event=>{event.preventDefault();const node=full.current;if(node){node.scrollLeft=node.clientWidth*current.current;node.focus({preventScroll:true})}}} onCloseAutoFocus={event=>{event.preventDefault();trigger.current?.focus({preventScroll:true})}} onKeyDown={event=>{if(event.key==='ArrowRight'){event.preventDefault();move(active+1)}if(event.key==='ArrowLeft'){event.preventDefault();move(active-1)}}}>
   <header className={styles.header}><div><Dialog.Title className={styles.title}>{name}</Dialog.Title><span aria-live="polite">{active+1} из {photos.length}</span></div><Dialog.Close className={styles.close} aria-label="Закрыть фотографии"><X size={22}/></Dialog.Close></header>
   <div className={styles.stage}>
    <div ref={full} tabIndex={0} data-allow-pinch-zoom="true" className={styles.fullRail} onScroll={read} aria-label="Полноэкранные фотографии">
     {photos.map((photo,i)=><div className={styles.fullPhoto} key={photo.url}>{Math.abs(i-active)<=1&&<Photo photo={photo} eager/>}</div>)}
    </div>
    {photos.length>1&&<><button type="button" className={styles.previous} aria-label="Предыдущее фото" disabled={active===0} onClick={()=>move(active-1)}><ChevronLeft size={24}/></button><button type="button" className={styles.next} aria-label="Следующее фото" disabled={active===photos.length-1} onClick={()=>move(active+1)}><ChevronRight size={24}/></button></>}
   </div>
   <footer className={styles.footer}><p>{photos[active]?.alt}</p>{photos.length>1&&<div className={styles.thumbnails} aria-label="Выбор фотографии">{photos.map((photo,i)=><button type="button" key={photo.url} aria-label={'Фото '+(i+1)} aria-pressed={i===active} onClick={()=>move(i)}><img src={photo.url} alt="" loading="lazy"/></button>)}</div>}</footer>
  </Dialog.Content></Dialog.Portal>
 </Dialog.Root>;
}
