import React from 'react';
/** Modal focus, background isolation and scroll restoration are shared by every editor. */
export function useDialog(open:boolean,onClose:()=>void){
 const close=React.useRef(onClose);close.current=onClose;
 React.useLayoutEffect(()=>{
  if(!open)return;
  const previous=document.activeElement as HTMLElement|null;
  const dialog=Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"],[role="alertdialog"]')).at(-1);if(!dialog)return;
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const isolated:{el:HTMLElement;inert:boolean}[]=[];
  for(let node:HTMLElement|null=dialog;node&&node!==document.body;node=node.parentElement){for(const sibling of Array.from(node.parentElement?.children??[])){if(sibling!==node&&sibling instanceof HTMLElement&&!sibling.matches('.menuScrim')&&!sibling.contains(dialog)){isolated.push({el:sibling,inert:sibling.inert});sibling.inert=true}}}
  const focusable=()=>Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]')).filter(x=>x.getClientRects().length&&!x.closest('[hidden],[inert]')&&x.getAttribute('aria-hidden')!=='true');
  focusable()[0]?.focus({preventScroll:true});
  const key=(e:KeyboardEvent)=>{
   if(Array.from(document.querySelectorAll('[role="dialog"],[role="alertdialog"]')).at(-1)!==dialog)return;
   if(e.key==='Escape'&&!e.defaultPrevented){e.preventDefault();close.current()}
   if(e.key==='Tab'){const items=focusable(),first=items[0],last=items.at(-1);if(!first){e.preventDefault();return}if(e.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){e.preventDefault();last?.focus()}else if(!e.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){e.preventDefault();first.focus()}}
  };
  document.addEventListener('keydown',key);
  return()=>{document.body.style.overflow=overflow;for(const {el,inert} of isolated)el.inert=inert;document.removeEventListener('keydown',key);if(previous?.isConnected)previous.focus({preventScroll:true})};
 },[open]);
}
