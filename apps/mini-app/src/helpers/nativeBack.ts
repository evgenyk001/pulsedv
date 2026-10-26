export function nativeBackButton(){
 const app=(window as any).Telegram?.WebApp,b=app?.BackButton;
 return app?.initData&&b&&['show','hide','onClick','offClick'].every(k=>typeof b[k]==='function')?b:null;
}
export function topAppDialog(){return [...document.querySelectorAll<HTMLElement>('[role="dialog"][data-state="open"],dialog[open]')].at(-1)}
export function closeTopAppDialog(){
 const dialog=topAppDialog();if(!dialog)return false;
 if(dialog instanceof HTMLDialogElement){const event=new Event('cancel',{cancelable:true});if(dialog.dispatchEvent(event))dialog.close();}
 else dialog.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
 return true;
}
