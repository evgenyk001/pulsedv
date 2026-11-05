import {readPresentation} from './presentationFiles';
import type {RuntimeConfig} from './config';
import {TelegramDeliveryError,type TelegramBotSender} from './notificationWorker';
export function telegramSender(config:Pick<RuntimeConfig,'BOT_TOKEN'|'PUBLIC_ORIGIN'>&Partial<Pick<RuntimeConfig,'MEDIA_ROOT'>>,send:typeof fetch=fetch):TelegramBotSender{
 return {async sendDocument(input){
  if(!config.MEDIA_ROOT)throw new Error('Presentation storage unavailable');
  const data=await readPresentation(config.MEDIA_ROOT,input.documentUrl);
  const form=new FormData();form.set('chat_id',input.chatId);form.set('caption',input.caption);
  form.set('document',new Blob([new Uint8Array(data)],{type:'application/pdf'}),input.filename);
  // Keep Telegram forwarding/saving enabled. Attach the exact authenticated Mini App route.
  if(input.deepLink){const url=new URL(input.deepLink);if(url.origin===new URL(config.PUBLIC_ORIGIN).origin&&url.protocol==='https:'&&url.pathname==='/pulsedv/mini-app/')form.set('reply_markup',JSON.stringify({inline_keyboard:[[{text:'Открыть ЖК в PULSE',web_app:{url:url.href}}]]}));}
  const response=await send(`https://api.telegram.org/bot${config.BOT_TOKEN}/sendDocument`,{method:'POST',signal:AbortSignal.timeout(20000),body:form});
  const result=await response.json() as {ok?:boolean;error_code?:number;parameters?:{retry_after?:number}};
  if(!response.ok||!result.ok)throw new TelegramDeliveryError(`Telegram document delivery failed (${result.error_code??response.status})`,result.parameters?.retry_after||0,[400,403].includes(result.error_code??response.status));
 },async sendMessage(input){
  const local=(url:string)=>{try{const parsed=new URL(url);return parsed.origin===new URL(config.PUBLIC_ORIGIN).origin&&parsed.protocol==='https:';}catch{return false}};
  const miniApp=(url:string)=>local(url)&&['/pulsedv/mini-app','/pulsedv/mini-app/','/mini-app','/mini-app/'].includes(new URL(url).pathname);
  const button=(url:string)=>miniApp(url)&&/^[1-9]\d*$/.test(input.chatId)?{web_app:{url}}:{url};
  const links:{text:string;url?:string;web_app?:{url:string}}[][]=[];
  if(input.deepLink&&(input.buttonLabel||local(input.deepLink)))links.push([{text:input.buttonLabel|| (input.deepLink.includes('/control-center/')?'Открыть PULSE Control':input.deepLink.includes('/my-search')?'Открыть мой поиск':'Открыть обращение'),...button(input.deepLink)}]);
  const photo=input.imageUrl?config.PUBLIC_ORIGIN+input.imageUrl:null;
  const escape=(text:string)=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  const [title,...body]=input.text.split('\n\n');
  const text=input.richTitle?'<b>'+escape(title)+'</b>\n\n'+escape(body.join('\n\n')):input.text;
  const response=await send(`https://api.telegram.org/bot${config.BOT_TOKEN}/${photo?'sendPhoto':'sendMessage'}`,{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(10000),body:JSON.stringify({chat_id:input.chatId,...(photo?{photo,caption:text}:{text}),...(input.richTitle?{parse_mode:'HTML'}:{}),...(links.length?{reply_markup:{inline_keyboard:links}}:{})})});
  const result=await response.json() as {ok?:boolean;error_code?:number;parameters?:{retry_after?:number}};
  if(!response.ok||!result.ok)throw new TelegramDeliveryError(`Telegram delivery failed (${result.error_code??response.status})`,result.parameters?.retry_after||0,[400,403].includes(result.error_code??response.status));
 }};
}
