type TelegramWindow = {
 ready?:()=>void; expand?:()=>void; requestFullscreen?:()=>void;
 isVersionAtLeast?:(version:string)=>boolean; isFullscreen?:boolean; initData?:string;
 disableVerticalSwipes?:()=>void; setHeaderColor?:(color:string)=>void; setBackgroundColor?:(color:string)=>void;
};
const requested=new WeakSet<object>();
export function prepareTelegramWindow(tg:TelegramWindow|undefined){
 if(!tg)return;
 // Older clients can reject optional methods; they must still be able to open the app.
 for(const action of [()=>tg.ready?.(),()=>tg.expand?.(),()=>tg.setHeaderColor?.('#F3F5F8'),()=>tg.setBackgroundColor?.('#F3F5F8'),()=>tg.disableVerticalSwipes?.()]){
  try{action()}catch{/* Unsupported client capability. */}
 }
 if(!tg.initData||tg.isFullscreen||requested.has(tg)||!tg.requestFullscreen||!tg.isVersionAtLeast?.('8.0'))return;
 requested.add(tg);
 try{tg.requestFullscreen()}catch{/* Expanded mode remains available on older platforms. */}
}
