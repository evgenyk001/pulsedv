type TelegramWindow = {
 ready?:()=>void; expand?:()=>void; requestFullscreen?:()=>void;
 isVersionAtLeast?:(version:string)=>boolean; isFullscreen?:boolean; initData?:string;
 disableVerticalSwipes?:()=>void; setHeaderColor?:(color:string)=>void; setBackgroundColor?:(color:string)=>void;
};
const requested=new WeakSet<object>();
let bridgeReady=false;
function readyWithoutSdk(){
 if(bridgeReady||typeof window==='undefined')return;
 const host=window as any;
 try{
  if(typeof host.TelegramWebviewProxy?.postEvent==='function')host.TelegramWebviewProxy.postEvent('web_app_ready',JSON.stringify(''));
  else if(typeof host.external?.notify==='function')host.external.notify(JSON.stringify({eventType:'web_app_ready',eventData:''}));
  else if(window.parent!==window)window.parent.postMessage(JSON.stringify({eventType:'web_app_ready',eventData:''}),'https://web.telegram.org');
  else return;
  bridgeReady=true;
 }catch{/* Keep the catalog usable if this Telegram client has no bridge. */}
}
export function prepareTelegramWindow(tg:TelegramWindow|undefined){
 if(!tg){readyWithoutSdk();return;}
 // Older clients can reject optional methods; they must still be able to open the app.
 for(const action of [()=>tg.ready?.(),()=>tg.expand?.(),()=>tg.setHeaderColor?.('#F3F5F8'),()=>tg.setBackgroundColor?.('#F3F5F8'),()=>tg.disableVerticalSwipes?.()]){
  try{action()}catch{/* Unsupported client capability. */}
 }
 if(!tg.initData||tg.isFullscreen||requested.has(tg)||!tg.requestFullscreen||!tg.isVersionAtLeast?.('8.0'))return;
 requested.add(tg);
 try{tg.requestFullscreen()}catch{/* Expanded mode remains available on older platforms. */}
}
