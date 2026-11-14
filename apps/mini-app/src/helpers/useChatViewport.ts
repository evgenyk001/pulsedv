import {useLayoutEffect,useRef,type RefObject} from 'react';
import {isPwa} from '../pwa/client';

export function useChatViewport(root:RefObject<HTMLDivElement|null>,onResize?:()=>void,view?:string){
 const callback=useRef(onResize);
 callback.current=onResize;
 useLayoutEffect(()=>{
  const viewport=window.visualViewport;
  let frame=0;
  let settledFrame=0;
  let settleTimer=0;
  const node=root.current;
  let report:HTMLOutputElement|null=null;
  let headingTaps=0;
  let lastHeadingTap=0;
  const enableDiagnostics=()=>{
   if(report)return;
   report=document.createElement('output');
   report.style.cssText='position:fixed;top:80px;left:10px;right:10px;z-index:2147483001;padding:8px;background:#fff;color:#111;font:12px monospace;pointer-events:none;white-space:pre-wrap';
   document.body.append(report);
   sample('При включении');
  };
  const samples:string[]=[];
  const sample=(label:string)=>{
   if(!report||!node)return;
   const field=node.querySelector('textarea');
   if(!field)return;
   const rect=field.getBoundingClientRect();
   const x=rect.x+rect.width/2;
   const y=rect.y+rect.height/2;
   const topElement=document.elementFromPoint(x,y);
   const hit=topElement===field?'поле':topElement?topElement.tagName+':'+(topElement.classList.item(0)??''):'вне видимой области';
   const px=Math.round;
   samples.push(label+': поле '+px(rect.top)+'–'+px(rect.bottom)+'; экран '+px(viewport?.offsetTop??0)+'+'+px(viewport?.height??innerHeight)+'; окно '+innerHeight+'; прокрутка '+px(scrollY)+'; сверху '+hit);
   report.textContent=samples.slice(-4).join('\n');
  };
  let unfocusedHeight=0;
  const focusedComposer=()=>{
   const active=document.activeElement;
   return active instanceof HTMLTextAreaElement&&node?.contains(active)?active:null;
  };
  const resize=()=>{
   const node=root.current;
   if(!node)return;
   const typing=!!focusedComposer();
   const top=viewport?.offsetTop??0;
   const height=viewport?.height??window.innerHeight;
   // With the keyboard open, the visual viewport can be panned inside the layout
   // viewport. Its offset positions the chat; it does not reduce its height.
   const visibleHeight=typing?height:Math.min(height,window.innerHeight);
   if(!typing)unfocusedHeight=visibleHeight;
   node.style.setProperty('--chat-height',(isPwa?visibleHeight:height)+'px');
   node.style.setProperty('--chat-top',(isPwa&&!typing?0:top)+'px');
   node.toggleAttribute('data-pwa-keyboard',isPwa&&typing&&unfocusedHeight-visibleHeight>100);
   if(isPwa&&!typing&&getComputedStyle(node).position==='fixed'&&window.scrollY){
    window.scrollTo({top:0,left:0,behavior:'instant'});
   }
   callback.current?.();
  };
  const updateFocus=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(resize)};
  const dismissOnTap=(event:MouseEvent)=>{
   if(!isPwa||!(event.target instanceof Element)||event.target.closest('button,a,input,textarea,label,select,[role="button"]'))return;
   if(event.target.closest('h1')){
    const now=performance.now();
    headingTaps=now-lastHeadingTap<700?headingTaps+1:1;
    lastHeadingTap=now;
    if(headingTaps===5)enableDiagnostics();
   }
   focusedComposer()?.blur();
  };
  const restoreAfterBlur=(event:FocusEvent)=>{
   if(!isPwa||!(event.target instanceof HTMLTextAreaElement)||!node?.contains(event.target))return;
   node.removeAttribute('data-pwa-keyboard');
   resize();
   updateFocus();
   window.clearTimeout(settleTimer);
   settleTimer=window.setTimeout(()=>{
    cancelAnimationFrame(settledFrame);
    settledFrame=requestAnimationFrame(()=>{resize();sample("После закрытия")});
   },400);
  };
  resize();

  node?.addEventListener('click',dismissOnTap);
  node?.addEventListener('focusout',restoreAfterBlur);
  document.addEventListener('focusin',updateFocus);

  window.addEventListener('scroll',resize);
  viewport?.addEventListener('resize',resize);
  viewport?.addEventListener('scroll',resize);
  window.addEventListener('resize',resize);
  return ()=>{
   report?.remove();
   cancelAnimationFrame(frame);
   cancelAnimationFrame(settledFrame);
   window.clearTimeout(settleTimer);
   document.removeEventListener('focusin',updateFocus);
   node?.removeEventListener('click',dismissOnTap);
   node?.removeEventListener('focusout',restoreAfterBlur);
   window.removeEventListener('scroll',resize);
   viewport?.removeEventListener('resize',resize);
   viewport?.removeEventListener('scroll',resize);
   window.removeEventListener('resize',resize);
  };
 },[root,view]);
}
