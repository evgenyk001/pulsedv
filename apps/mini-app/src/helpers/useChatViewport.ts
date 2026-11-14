import {useLayoutEffect,useRef,type RefObject} from 'react';
import {isPwa} from '../pwa/client';

export function useChatViewport(root:RefObject<HTMLDivElement|null>,onResize?:()=>void){
 const callback=useRef(onResize);
 callback.current=onResize;
 useLayoutEffect(()=>{
  const viewport=window.visualViewport;
  let frame=0;
  const node=root.current;
  const focusedComposer=()=>{
   const active=document.activeElement;
   return active instanceof HTMLTextAreaElement&&node?.contains(active)?active:null;
  };
  const resize=()=>{
   const node=root.current;
   if(!node)return;
   const height=viewport?.height??window.innerHeight;
   const top=viewport?.offsetTop??0;
   node.style.setProperty('--chat-height',height+'px');
   node.style.setProperty('--chat-top',top+'px');
   const typing=!!focusedComposer();
   node.toggleAttribute('data-pwa-keyboard',isPwa&&typing&&window.innerHeight-height>100);
   if(isPwa&&!typing&&getComputedStyle(node).position==='fixed'&&window.scrollY){
    window.scrollTo({top:0,left:0,behavior:'instant'});
   }
   callback.current?.();
  };
  const updateFocus=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(resize)};
  const dismissOnTap=(event:MouseEvent)=>{
   if(!isPwa||!(event.target instanceof Element)||event.target.closest('button,a,input,textarea,label,select,[role="button"]'))return;
   focusedComposer()?.blur();
  };
  const restoreAfterBlur=(event:FocusEvent)=>{
   if(!isPwa||!(event.target instanceof HTMLTextAreaElement)||!node?.contains(event.target))return;
   node.removeAttribute('data-pwa-keyboard');
   updateFocus();
  };
  resize();
  node?.addEventListener('click',dismissOnTap);
  node?.addEventListener('focusout',restoreAfterBlur);
  document.addEventListener('focusin',updateFocus);

  viewport?.addEventListener('resize',resize);
  viewport?.addEventListener('scroll',resize);
  window.addEventListener('resize',resize);
  return ()=>{
   cancelAnimationFrame(frame);
   document.removeEventListener('focusin',updateFocus);
   node?.removeEventListener('click',dismissOnTap);
   node?.removeEventListener('focusout',restoreAfterBlur);
   viewport?.removeEventListener('resize',resize);
   viewport?.removeEventListener('scroll',resize);
   window.removeEventListener('resize',resize);
  };
 },[root]);
}
