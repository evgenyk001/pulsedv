import type {RuntimeConfig} from './config';
import {TelegramDeliveryError,type TelegramBotSender} from './notificationWorker';
export function telegramSender(config:Pick<RuntimeConfig,'BOT_TOKEN'|'PUBLIC_ORIGIN'>,send:typeof fetch=fetch):TelegramBotSender{
 return {async sendMessage(input){
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
