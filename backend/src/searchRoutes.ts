import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Database,Sql} from './database';
import {favoriteOwner} from './favoriteRoutes';
import {listCatalog} from './catalogRepository';
import {HttpError} from './security';
import {defaultSearchSettings,sameSearchCriteria,searchSnapshot,searchChanges,type SearchSettings,type SearchUpdate} from '../../packages/my-search';

const criteria=z.object({q:z.string().trim().max(200),city:z.string().min(1).max(100),rooms:z.enum(['Все','Не важно','Студия','1','2','3','3+','4']),min:z.number().finite().int().min(0).max(1e10),max:z.number().finite().int().positive().max(1e10),delivery:z.string().min(1).max(100),sea:z.boolean(),purchaseMode:z.enum(['any','cash','mortgage'])}).strict().refine(c=>c.min<=c.max,'Проверьте диапазон бюджета');
const settingsSchema=z.object({criteria:criteria.nullable(),watchFavorites:z.boolean(),telegram:z.boolean()}).strict();
export async function searchCatalog(sql:Sql){
 const items=[];let page=1;
 for(;;){const result=await listCatalog(sql,{page,limit:1000,view:'match'});items.push(...result.items);if(page*result.limit>=result.total)break;page++;}
 return items;
}
async function favorites(sql:Sql,owner:string){return (await sql.query('select property_ids from favorite_sets where owner=$1',[owner])).rows[0]?.property_ids??[];}
export async function mergeSearch(sql:Sql,sessionId:string,userId:string){
 const old='session:'+sessionId,owner='user:'+userId;
 await sql.query(`insert into search_profiles(owner,settings,baseline,feed) select $2,settings||'{"telegram":false}'::jsonb,baseline,feed from search_profiles where owner=$1 on conflict(owner) do nothing`,[old,owner]);
 await sql.query('delete from search_profiles where owner=$1',[old]);
}
export async function registerSearchRoutes(app:FastifyInstance,db:Database,visitor:(r:FastifyRequest)=>Promise<void>){
 app.get('/api/v1/me/search',{preHandler:visitor},async r=>db.transaction(async sql=>{
  const identity=await favoriteOwner(sql,r.visitor!.sessionId),row=(await sql.query('select settings,feed from search_profiles where owner=$1',[identity.owner])).rows[0];
  const feed:SearchUpdate[]=row?.feed??[],ids=feed.map(e=>e.propertyId);
  const visible=new Set((await sql.query("select id from catalog_properties where id=any($1::text[]) and status='published'",[ids])).rows.map(p=>p.id));
  return {settings:row?.settings??defaultSearchSettings,feed:feed.filter(e=>visible.has(e.propertyId)),authenticated:identity.authenticated};
 }));
 app.put('/api/v1/me/search',{preHandler:visitor,config:{rateLimit:{max:20,timeWindow:'1 minute'}}},async r=>{
  const settings=settingsSchema.parse(r.body);
  return db.transaction(async sql=>{
   const identity=await favoriteOwner(sql,r.visitor!.sessionId);
   if(settings.telegram&&!identity.authenticated)throw new HttpError(400,'Откройте приложение через Telegram, чтобы включить уведомления');
   const previous=(await sql.query('select * from search_profiles where owner=$1 for update',[identity.owner])).rows[0];
   const reset=!previous||!sameSearchCriteria(previous.settings.criteria,settings.criteria)||previous.settings.watchFavorites!==settings.watchFavorites;
   const baseline=reset?searchSnapshot(await searchCatalog(sql),settings,await favorites(sql,identity.owner)):previous.baseline;
   const feed=reset?[]:(previous.feed as SearchUpdate[]).map(e=>({...e,notified:true}));
   await sql.query(`insert into search_profiles(owner,settings,baseline,feed) values($1,$2::jsonb,$3::jsonb,$4::jsonb) on conflict(owner) do update set settings=excluded.settings,baseline=excluded.baseline,feed=excluded.feed,consent_key=gen_random_uuid(),updated_at=now()`,[identity.owner,JSON.stringify(settings),JSON.stringify(baseline),JSON.stringify(feed)]);
   // Revoke messages from the previous consent, including any claimed lease.
   await sql.query("update outbox_events set processed_at=now(),locked_until=null,lock_token=null,last_error='Search subscription changed' where topic='user.search_updates' and payload->>'owner'=$1 and processed_at is null",[identity.owner]);
   return {settings,feed,authenticated:identity.authenticated};
  });
 });
}
export async function scanSearchProfiles(db:Database,origin:string,now=new Date(),afterOwner='',limit=200){
 if(!(await db.query('select owner from search_profiles where owner>$1 limit 1',[afterOwner])).rows.length)return {checked:0,nextCursor:''};
 const catalog=await searchCatalog(db);let cursor=afterOwner,checked=0;const deadline=Date.now()+2000;
 for(;;){const rows=(await db.query('select owner from search_profiles where owner>$1 order by owner limit 100',[cursor])).rows;
  for(const {owner} of rows){await db.transaction(async sql=>{
   const row=(await sql.query('select * from search_profiles where owner=$1 for update',[owner])).rows[0];if(!row)return;
   const settings=row.settings as SearchSettings,next=searchSnapshot(catalog,settings,await favorites(sql,owner));
   const changes=searchChanges(row.baseline,next,catalog,now.toISOString()).map(e=>({...e,id:randomUUID()}));
   let feed=[...changes.reverse(),...row.feed as SearchUpdate[]].filter(e=>next[e.propertyId]&&(e.kind==='match'?next[e.propertyId].match:next[e.propertyId].favorite)&&Date.parse(e.at)>=now.getTime()-30*86400000).slice(0,30);
   const pending=feed.filter(e=>!e.notified);
   if(settings.telegram&&owner.startsWith('user:')&&pending.length&&(!row.last_notified_at||new Date(row.last_notified_at).getTime()<=now.getTime()-3600000)){
    const titles=[...new Set(pending.slice(0,8).map(e=>e.name+' — '+(e.kind==='price'?'изменение цены в каталоге':e.title)))];
    await sql.query("insert into outbox_events(topic,aggregate_type,aggregate_id,payload,dedup_key) values('user.search_updates','user',$1,$2::jsonb,$3) on conflict(dedup_key) where dedup_key is not null do nothing",[owner.slice(5),JSON.stringify({userId:owner.slice(5),owner,consentKey:row.consent_key,propertyIds:[...new Set(pending.map(e=>e.propertyId))],at:now.toISOString(),title:'PULSE.DV · Обновления вашего поиска',body:titles.join('\n')+'\nАктуальные условия уточнит менеджер.',deepLink:origin+'/pulsedv/mini-app/#/my-search'}),'search:'+owner+':'+pending[0].id]);
    feed=feed.map(e=>({...e,notified:true}));await sql.query('update search_profiles set last_notified_at=$2 where owner=$1',[owner,now.toISOString()]);
   }
   await sql.query('update search_profiles set baseline=$2::jsonb,feed=$3::jsonb where owner=$1',[owner,JSON.stringify(next),JSON.stringify(feed)]);checked++;
  });cursor=owner;if(checked>=limit||Date.now()>=deadline)return {checked,nextCursor:cursor};}
  if(rows.length<100)break;
 }
 return {checked,nextCursor:''};
}
