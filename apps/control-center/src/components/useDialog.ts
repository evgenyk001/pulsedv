import React from 'react';
/** Keep keyboard focus inside the active drawer and restore it on close. */
export function useDialog(open:boolean,onClose:()=>void){
 const close=React.useRef(onClose);close.current=onClose;
 React.useEffect(()=>{
  if(!open)return;
  const previous=document.activeElement as HTMLElement|null;
  const dialog=document.querySelector<HTMLElement>('[role="dialog"]');
  if(!dialog)return;
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const focusable=()=>Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]')).filter(x=>x.getClientRects().length);
  focusable()[0]?.focus();
  const key=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){e.preventDefault();close.current();}
   if(e.key==='Tab'){const items=focusable();const first=items[0],last=items.at(-1);if(!first){e.preventDefault();return;}if(e.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  };
  document.addEventListener('keydown',key);
  return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);previous?.focus();};
 },[open]);
}
