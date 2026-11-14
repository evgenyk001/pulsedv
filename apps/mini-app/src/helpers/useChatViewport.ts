import {useLayoutEffect,useRef,type RefObject} from 'react';
import {isPwa} from '../pwa/client';

export function useChatViewport(root:RefObject<HTMLDivElement|null>,onResize?:()=>void){
 const callback=useRef(onResize);
 callback.current=onResize;
 useLayoutEffect(()=>{
  const viewport=window.visualViewport;
  const resize=()=>{
   const node=root.current;
   if(!node)return;
   const height=viewport?.height??window.innerHeight;
   const top=viewport?.offsetTop??0;
   node.style.setProperty('--chat-height',height+'px');
   node.style.setProperty('--chat-top',top+'px');
   node.toggleAttribute('data-pwa-keyboard',isPwa&&window.innerHeight-height>100);
   callback.current?.();
  };
  resize();
  viewport?.addEventListener('resize',resize);
  viewport?.addEventListener('scroll',resize);
  window.addEventListener('resize',resize);
  return ()=>{
   viewport?.removeEventListener('resize',resize);
   viewport?.removeEventListener('scroll',resize);
   window.removeEventListener('resize',resize);
  };
 },[root]);
}
