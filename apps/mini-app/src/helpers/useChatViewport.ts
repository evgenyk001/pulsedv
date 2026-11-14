import {useLayoutEffect,useRef,type RefObject} from 'react';
import {isPwa} from '../pwa/client';

export function useChatViewport(root:RefObject<HTMLDivElement|null>,onResize?:()=>void){
 const callback=useRef(onResize);
 callback.current=onResize;
 useLayoutEffect(()=>{
  const viewport=window.visualViewport;
  let frame=0;
  const resize=()=>{
   const node=root.current;
   if(!node)return;
   const height=viewport?.height??window.innerHeight;
   const top=viewport?.offsetTop??0;
   node.style.setProperty('--chat-height',height+'px');
   node.style.setProperty('--chat-top',top+'px');
   const typing=node.contains(document.activeElement)&&document.activeElement instanceof HTMLTextAreaElement;
   node.toggleAttribute('data-pwa-keyboard',isPwa&&typing&&window.innerHeight-height>100);
   callback.current?.();
  };
  const updateFocus=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(resize)};
  resize();
  document.addEventListener('focusin',updateFocus);
  document.addEventListener('focusout',updateFocus);
  viewport?.addEventListener('resize',resize);
  viewport?.addEventListener('scroll',resize);
  window.addEventListener('resize',resize);
  return ()=>{
   cancelAnimationFrame(frame);
   document.removeEventListener('focusin',updateFocus);
   document.removeEventListener('focusout',updateFocus);
   viewport?.removeEventListener('resize',resize);
   viewport?.removeEventListener('scroll',resize);
   window.removeEventListener('resize',resize);
  };
 },[root]);
}
