import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Database} from './database';
import type {RuntimeConfig} from './config';
import {getCatalogProperty} from './catalogRepository';
import {HttpError} from './security';
import {propertyTelegramLink} from '../../packages/browser/propertyLinks';
export async function preparePropertyShare(db:Database,config:RuntimeConfig,userId:string|null,id:string,prepare:boolean,send:typeof fetch=fetch){
 const property=await getCatalogProperty(db,id,'published');
 if(!property)throw new HttpError(404,'ЖК больше не опубликован');
 const url=propertyTelegramLink(property.id,config.TELEGRAM_BOT_USERNAME);
 const result:{url:string;messageId?:string}={url};
 if(!prepare||!config.BOT_TOKEN||!userId)return result;
 // The sender identity comes exclusively from the authenticated database account.
 const user=(await db.query('select telegram_user_id::text from app_users where id=$1',[userId])).rows[0];
 if(!user?.telegram_user_id)return result;
 const name=property.name.slice(0,200),location=[property.city,property.district].filter(Boolean).join(' · ').slice(0,250);
 const text=[name,location,'Посмотрите ЖК, планировки и условия покупки в PULSEDV.RU.'].filter(Boolean).join('\n');
 try{
  const response=await send('https://api.telegram.org/bot'+config.BOT_TOKEN+'/savePreparedInlineMessage',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(6000),body:JSON.stringify({user_id:Number(user.telegram_user_id),allow_user_chats:true,allow_group_chats:true,allow_channel_chats:true,result:{type:'article',id:randomUUID(),title:name,description:location,input_message_content:{message_text:text,link_preview_options:{is_disabled:true}},reply_markup:{inline_keyboard:[[{text:'Открыть ЖК в PULSE',url}]]}}})});
  const data=await response.json() as {ok?:boolean;result?:{id?:string}};
  if(response.ok&&data.ok&&typeof data.result?.id==='string')result.messageId=data.result.id;
 }catch{/* A Telegram outage must still allow sharing the direct Mini App link. */}
 return result;
}
export function registerPropertyShareRoutes(app:FastifyInstance,db:Database,config:RuntimeConfig,visitor:(r:FastifyRequest)=>Promise<void>){
 app.post('/api/v1/me/property-share',{preHandler:visitor,config:{rateLimit:{max:10,timeWindow:'1 minute'}}},async r=>{
  const input=z.object({propertyId:z.string().min(1).max(200),prepare:z.boolean().default(false)}).strict().parse(r.body);
  return preparePropertyShare(db,config,r.visitor!.userId,input.propertyId,input.prepare);
 });
}
