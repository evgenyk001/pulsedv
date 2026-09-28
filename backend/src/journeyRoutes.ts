import {z} from 'zod';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Database,Sql} from './database';
import {HttpError} from './security';
import {audit} from './repository';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {getCatalogProperty} from './catalogRepository';
import type {RuntimeConfig} from './config';
import {applyJourney,clientJourney,emptyJourney,type Journey} from '../../packages/journey/model';
const short=z.string().trim().min(1).max(200),note=z.string().trim().max(2000),id=z.uuid();
const attachmentSchema=z.object({kind:z.enum(['image','file']),name:z.string().min(1).max(180),url:z.string().regex(/^\/media\/chat\/[A-Za-z0-9._-]+$/).max(500),mimeType:z.string().min(1).max(120),size:z.number().int().min(1).max(25*1024*1024)}).strict();
export const journeyCommand=z.discriminatedUnion('type',[
 z.object({type:z.literal('collection'),id,title:short,items:z.array(z.object({propertyId:short,note})).min(1).max(10),published:z.boolean()}),
 z.object({type:z.literal('reaction'),collectionId:id,propertyId:short,reaction:z.enum(['liked','expensive','location','question','none']),reply:note}),
 z.object({type:z.literal('showing'),id,propertyId:short,at:z.iso.datetime(),note}),
 z.object({type:z.literal('showing_status'),id,status:z.enum(['requested','confirmed','completed','cancelled']),result:note}),
 z.object({type:z.literal('message'),id,text:z.string().trim().max(2000).default(''),attachment:attachmentSchema.optional()}),
 z.object({type:z.literal('showing_change'),id,action:z.enum(['cancel','reschedule']),at:z.iso.datetime().optional(),note}),
 z.object({type:z.literal('showing_reschedule'),id,accept:z.boolean()}),
 z.object({type:z.literal('next_step'),title:short,dueAt:z.iso.datetime(),done:z.boolean()})
]);
export async function registerJourneyRoutes(app:FastifyInstance,db:Database,control:(r:FastifyRequest)=>Promise<void>,visitor:(r:FastifyRequest)=>Promise<void>,editor:(r:FastifyRequest)=>Promise<void>,origin:string,config:RuntimeConfig){
 const attachmentTypes:Record<string,{ext:string;kind:'image'|'file';max:number}>={'image/jpeg':{ext:'jpg',kind:'image',max:15*1024*1024},'image/png':{ext:'png',kind:'image',max:15*1024*1024},'image/webp':{ext:'webp',kind:'image',max:15*1024*1024},'application/pdf':{ext:'pdf',kind:'file',max:25*1024*1024}};
 for(const type of Object.keys(attachmentTypes))if(!app.hasContentTypeParser(type))app.addContentTypeParser(type,{parseAs:'buffer'},(_request,body,done)=>done(null,body));
 async function leadAccess(sql:Sql,r:FastifyRequest,leadId:string,client:boolean,lock=false){
  const l=(await sql.query('select * from leads where id=$1'+(lock?' for update':''),[leadId])).rows[0];
  const allowed=l&&(client?(l.session_id===r.visitor!.sessionId||!!r.visitor!.userId&&l.user_id===r.visitor!.userId):(r.member!.role!=='manager'||l.manager_id===r.member!.id));
  if(!allowed)throw new HttpError(404,'Клиент недоступен');return l;
 }
 for(const client of [false,true]){
  const prefix=client?'/api/v1/me':'/api/v1/control';const auth=client?visitor:control;
  app.post(prefix+'/journeys/:id/attachments',{preHandler:auth,bodyLimit:26*1024*1024,config:{rateLimit:{max:30,timeWindow:'1 minute'}}},async(r,reply)=>{
   const leadId=id.parse((r.params as any).id);await db.transaction(sql=>leadAccess(sql,r,leadId,client,false));
   const type=(r.headers['content-type']||'').split(';')[0].trim().toLowerCase();const spec=attachmentTypes[type];
   if(!spec)return reply.code(415).send({error:'Можно отправить JPG, PNG, WebP или PDF'});
   const body=r.body;if(!Buffer.isBuffer(body)||!body.length)return reply.code(400).send({error:'Файл пустой'});if(body.length>spec.max)return reply.code(413).send({error:spec.kind==='image'?'Фото больше 15 МБ':'PDF больше 25 МБ'});
   const query=z.object({filename:z.string().max(180).optional()}).strict().parse(r.query);const name=(query.filename||'Файл').replace(/[\r\n]/g,' ').trim().slice(0,180)||'Файл';
   const folder='chat';const fileName=randomUUID()+'.'+spec.ext;await mkdir(join(config.MEDIA_ROOT,folder),{recursive:true});await writeFile(join(config.MEDIA_ROOT,folder,fileName),body);
   if(!client&&r.member)await audit(db,r.member.id,'journey.attachment.upload',leadId,{mimeType:type,size:body.length});
   return {attachment:{kind:spec.kind,name,url:'/media/'+folder+'/'+fileName,mimeType:type,size:body.length}};
  });
  app.post(prefix+'/journeys/:id/read',{preHandler:auth},async r=>{
   const leadId=id.parse((r.params as any).id);const input=z.object({messageIds:z.array(id).min(1).max(100)}).strict().parse(r.body);
   return db.transaction(async sql=>{await leadAccess(sql,r,leadId,client,true);const row=(await sql.query('select document from client_journeys where lead_id=$1',[leadId])).rows[0];const current:Journey=row?.document||emptyJourney(leadId);const target=client?'manager':'client';const ids=new Set(input.messageIds);const now=new Date().toISOString();let changed=false;
    current.messages=(current.messages||[]).map(m=>{if(ids.has(m.id)&&m.author===target&&!m.readAt){changed=true;return {...m,readAt:now}}return m});
    if(changed)await sql.query('update client_journeys set document=$2::jsonb,updated_at=now() where lead_id=$1',[leadId,JSON.stringify(current)]);
    return {journey:client?clientJourney(current):current};
   });
  });
  app.get(prefix+'/journeys',{preHandler:auth},async r=>{
   const values=client?[r.visitor!.sessionId,r.visitor!.userId]:r.member!.role==='manager'?[r.member!.id]:[];
   const where=client?'where l.session_id=$1 or ($2::uuid is not null and l.user_id=$2)':r.member!.role==='manager'?'where l.manager_id=$1':'';
   const rows=(await db.query(`select l.id,l.status,l.property_id,l.created_at,m.name as manager_name,j.document from leads l left join team_members m on m.id=l.manager_id and m.active=true left join client_journeys j on j.lead_id=l.id ${where} order by l.created_at desc limit 1001`,values)).rows;
   return {limited:rows.length>1000,items:rows.slice(0,1000).map(l=>({leadId:l.id,status:l.status,propertyId:l.property_id,createdAt:l.created_at,managerName:l.manager_name||null,journey:client?clientJourney(l.document||emptyJourney(l.id)):l.document||emptyJourney(l.id)}))};
  });
  app.post(prefix+'/journeys/:id',{preHandler:auth},async r=>{
   const leadId=id.parse((r.params as any).id);const input=z.object({revision:z.number().int().nonnegative(),command:journeyCommand}).strict().parse(r.body);
   return db.transaction(async sql=>{
    const l=await leadAccess(sql,r,leadId,client,true);
    const current=(await sql.query('select document from client_journeys where lead_id=$1',[leadId])).rows[0]?.document||emptyJourney(leadId);
    if(current.revision!==input.revision)throw new HttpError(409,'Карточка изменилась. Обновите данные перед повтором');
    const c=input.command;
    if(['deal','closed','lost'].includes(l.status))throw new HttpError(409,'Обращение завершено');
    const propertyIds=c.type==='collection'?c.items.map(x=>x.propertyId):c.type==='showing'?[c.propertyId]:[];
    for(const propertyId of propertyIds)if(!await getCatalogProperty(sql,propertyId,'published'))throw new HttpError(400,'Объект больше не опубликован');
    if(c.type==='showing'&&client&&!current.collections.some((s:any)=>s.published&&s.items.some((i:any)=>i.propertyId===c.propertyId))&&l.property_id!==c.propertyId)throw new HttpError(400,'Выберите объект из своей подборки');
    let next:Journey;try{next=applyJourney(current,c,client?'client':'manager');}catch(e){throw new HttpError(400,(e as Error).message);}
    const confirms=c.type==='showing_status'&&c.status==='confirmed'||c.type==='showing_reschedule'&&c.accept;
    if(confirms&&!l.manager_id)throw new HttpError(400,'Сначала назначьте ответственного менеджера');
    if(confirms&&l.manager_id){
     await sql.query('select id from team_members where id=$1 for update',[l.manager_id]);
     const slot=next.showings.find(s=>s.id===('id' in c?c.id:''))!;
     const conflict=(await sql.query(`select j.lead_id from client_journeys j join leads l on l.id=j.lead_id, jsonb_array_elements(j.document->'showings') s where l.manager_id=$1 and s->>'status'='confirmed' and s->>'id'<>$2 and abs(extract(epoch from ((s->>'at')::timestamptz-$3::timestamptz)))<3600 limit 1`,[l.manager_id,slot.id,slot.at])).rows.length;
     if(conflict)throw new HttpError(409,'У менеджера уже есть показ в пределах часа');
    }
    await sql.query(`insert into client_journeys(lead_id,revision,document) values($1,$2,$3::jsonb) on conflict(lead_id) do update set revision=excluded.revision,document=excluded.document,updated_at=now()`,[leadId,next.revision,JSON.stringify(next)]);
    
    if(client)await sql.query('insert into user_events(idempotency_key,session_id,user_id,event_type,entity_type,entity_id,metadata,occurred_at) values($1,$2,$3,$4,$5,$6,$7::jsonb,now())',[randomUUID(),r.visitor!.sessionId,r.visitor!.userId,c.type==='reaction'?'collection_reaction':c.type==='message'?'client_message':c.type==='showing_change'?(c.action==='cancel'?'showing_cancelled':'showing_reschedule_requested'):'showing_requested','property',c.type==='reaction'||c.type==='showing'?c.propertyId:null,JSON.stringify(c.type==='reaction'?{reaction:c.reaction,reply:c.reply.slice(0,150)}:{})]);
    const recipient=client?l.manager_id:l.user_id;
    if(recipient&&(client||c.type==='collection'&&c.published||['showing_status','showing_reschedule','message'].includes(c.type)))await sql.query('insert into outbox_events(topic,aggregate_type,aggregate_id,payload) values($1,$2,$3,$4::jsonb)',[client?'manager.journey':'user.journey','lead',leadId,JSON.stringify({[client?'managerId':'userId']:recipient,title:'Обновление по подбору',body:client?'Клиент обновил обращение: ответ, сообщение или изменение показа.':'Менеджер обновил ваше обращение. Откройте подборки, показы и сообщения.',deepLink:origin+(client?'/pulsedv/control-center/#/leads?lead='+leadId:'/pulsedv/mini-app/#/journey')})]);
    if(!client)await audit(sql,r.member!.id,'journey.'+c.type,leadId,{revision:next.revision});
    return {journey:client?clientJourney(next):next};
   });
  });
 }

 app.get('/api/v1/control/acquisition',{preHandler:control},async r=>{
  const scoped=r.member!.role==='manager';
  const rows=(await db.query(`select case when coalesce(s.source,'direct')='direct' and s.telegram_start_param is not null then 'telegram' else coalesce(nullif(s.source,''),'direct') end as source,coalesce(nullif(s.campaign,''),s.telegram_start_param,'') as campaign,count(*)::int as visits,
   count(*) filter(where exists(select 1 from leads l where l.session_id=s.id ${scoped?'and l.manager_id=$1':''}))::int as contacts,
   count(*) filter(where exists(select 1 from client_journeys j join leads l on l.id=j.lead_id where l.session_id=s.id ${scoped?'and l.manager_id=$1':''} and exists(select 1 from jsonb_array_elements(j.document->'showings') x where x->>'status'='completed')))::int as showings,
   count(*) filter(where exists(select 1 from leads l where l.session_id=s.id ${scoped?'and l.manager_id=$1':''} and (l.status='deal' or exists(select 1 from lead_stage_events e where e.lead_id=l.id and e.status='deal'))))::int as deals
   from sessions s where s.first_seen_at>=now()-interval '90 days' ${scoped?'and exists(select 1 from leads l where l.session_id=s.id and l.manager_id=$1)':''} group by 1,2 order by visits desc limit 501`,scoped?[r.member!.id]:[])).rows;
  return {items:rows.slice(0,500),limited:rows.length>500,scoped,days:90};
 });
 app.get('/api/v1/public/verifications',async()=>({items:(await db.query('select v.property_id as "propertyId",v.checked_at as "checkedAt",v.note,v.revision,p.updated_at>v.checked_at as invalidated from catalog_verifications v join catalog_properties p on p.id=v.property_id where p.status=\'published\' order by v.checked_at desc limit 2000')).rows}));
 app.post('/api/v1/control/verifications/:id',{preHandler:editor},async r=>{
  const propertyId=short.parse((r.params as any).id);const input=z.object({note,revision:z.number().int().nonnegative()}).strict().parse(r.body);
  return db.transaction(async sql=>{if(!await getCatalogProperty(sql,propertyId,'any'))throw new HttpError(404,'Объект не найден');
   const result=await sql.query(`insert into catalog_verifications(property_id,note,checked_by,revision) select $1,$2,$3,1 where $4=0 on conflict(property_id) do update set note=excluded.note,checked_at=now(),checked_by=excluded.checked_by,revision=catalog_verifications.revision+1 where catalog_verifications.revision=$4 returning property_id`,[propertyId,input.note,r.member!.id,input.revision]);
   // Existing rows need UPDATE even when the submitted revision is nonzero.
   if(!result.rows.length&&input.revision>0){const updated=await sql.query('update catalog_verifications set note=$2,checked_at=now(),checked_by=$3,revision=revision+1 where property_id=$1 and revision=$4 returning property_id',[propertyId,input.note,r.member!.id,input.revision]);if(!updated.rows.length)throw new HttpError(409,'Проверка уже обновлена');}
   else if(!result.rows.length)throw new HttpError(409,'Проверка уже обновлена');
   await audit(sql,r.member!.id,'catalog.verify',null,{propertyId});return {ok:true};
  });
 });
}
