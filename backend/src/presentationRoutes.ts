import {z} from 'zod';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Database} from './database';
import type {RuntimeConfig} from './config';
import {HttpError} from './security';
import {registeredPhone} from './accountRoutes';
import {presentationFile} from './presentationFiles';
function view(row:any,config:RuntimeConfig){return {id:String(row.id),status:row.dead_at?'failed':row.processed_at?(row.last_error?'unavailable':'sent'):'queued',botUrl:'https://t.me/'+config.TELEGRAM_BOT_USERNAME};}
export function registerPresentationRoutes(app:FastifyInstance,db:Database,config:RuntimeConfig,visitor:(r:FastifyRequest)=>Promise<void>){
 app.post('/api/v1/me/presentations',{preHandler:visitor,config:{rateLimit:{max:10,timeWindow:'1 minute'}}},async r=>{
  const input=z.object({propertyId:z.string().min(1).max(200),documentId:z.uuid()}).strict().parse(r.body),userId=r.visitor!.userId;
  if(!await registeredPhone(db,userId))throw new HttpError(403,'Подтвердите свой номер в Telegram');
  if(!config.BOT_TOKEN)throw new HttpError(400,'Отправка файлов в бот пока не подключена');
  return db.transaction(async sql=>{
   const user=(await sql.query('select telegram_user_id from app_users where id=$1 for update',[userId])).rows[0];
   if(!user?.telegram_user_id)throw new HttpError(403,'Откройте приложение через Telegram');
   const doc=(await sql.query("select d.*,p.name as property_name from catalog_property_documents d join catalog_properties p on p.id=d.property_id where d.id=$1 and d.property_id=$2 and d.kind='presentation' and p.status='published'",[input.documentId,input.propertyId])).rows[0];
   if(!doc)throw new HttpError(404,'Презентация недоступна. Обновите карточку ЖК');
   try{await presentationFile(config.MEDIA_ROOT,doc.url)}catch{throw new HttpError(400,'PDF недоступен или больше 50 МБ. Попросите менеджера обновить презентацию');}
   const previous=(await sql.query("select * from outbox_events where topic='document.presentation' and payload->>'userId'=$1 and payload->>'documentId'=$2 and payload->>'documentUrl'=$3 and created_at>now()-interval '2 minutes' and dead_at is null and (processed_at is null or last_error is null) order by created_at desc limit 1",[userId,doc.id,doc.url])).rows[0];
   if(previous)return view(previous,config);
   const payload={userId,propertyId:doc.property_id,documentId:doc.id,documentUrl:doc.url,filename:(doc.property_name+' — презентация').replace(/[\\/<>:"|?*\u0000-\u001f]/g,' ').slice(0,140)+'.pdf',title:'Презентация '+doc.property_name,body:'Сохраните PDF на телефон или перешлите близким.',deepLink:config.PUBLIC_ORIGIN+'/pulsedv/mini-app/#/property/'+encodeURIComponent(doc.property_id)};
   const row=(await sql.query("insert into outbox_events(topic,aggregate_type,aggregate_id,payload) values('document.presentation','catalog_document',$1,$2::jsonb) returning *",[doc.id,JSON.stringify(payload)])).rows[0];
   return view(row,config);
  });
 });
 app.get('/api/v1/me/presentations/:id',{preHandler:visitor},async r=>{
  const {id}=z.object({id:z.uuid()}).parse(r.params);
  const row=(await db.query("select * from outbox_events where id=$1 and topic='document.presentation' and payload->>'userId'=$2",[id,r.visitor!.userId])).rows[0];
  if(!row)throw new HttpError(404,'Запрос не найден');return view(row,config);
 });
}
