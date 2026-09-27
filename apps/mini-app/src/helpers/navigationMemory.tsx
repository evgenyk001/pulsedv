import React from 'react';
import {useLocation,useNavigationType} from 'react-router-dom';
const positions=new Map<string,number>();
let previous='/';
export function propertyReturn(){try{const v=sessionStorage.getItem('pulse.property.return');return v&&/^\/(catalog|favorites|selection|journey)([?]|$)/.test(v)?v:'/catalog'}catch{return '/catalog'}}
export function NavigationMemory(){
 const location=useLocation(),kind=useNavigationType();const path=location.pathname+location.search;
 React.useLayoutEffect(()=>{
  if(!location.pathname.startsWith('/property/')){try{sessionStorage.setItem('pulse.property.return',path)}catch{}}
  const restore=kind==='POP'||previous.startsWith('/property/');previous=path;
  const y=restore?positions.get(path)||0:0;
  let cancelled=false,frame=0,attempts=0;
  const move=()=>{if(cancelled)return;window.scrollTo(0,y);if(document.documentElement.scrollHeight-window.innerHeight<y&&attempts++<60)frame=requestAnimationFrame(move)};
  frame=requestAnimationFrame(move);
  const stop=()=>{cancelled=true};
  const save=()=>{if(!cancelled&&attempts>0)return;positions.set(path,window.scrollY)};
  window.addEventListener('scroll',save,{passive:true});window.addEventListener('pointerdown',stop,{once:true});window.addEventListener('wheel',stop,{once:true});
  return()=>{cancelAnimationFrame(frame);positions.set(path,window.scrollY);window.removeEventListener('scroll',save);window.removeEventListener('pointerdown',stop);window.removeEventListener('wheel',stop)};
 },[path,kind]);return null;
}
