import {z} from 'zod';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Database,Sql} from './database';
import {HttpError} from './security';
const property=z.string().min(1).max(200);
// All changes and Telegram binding use the same session -> user lock order.
export async function favoriteOwner(sql:Sql,sessionId:string){
 const s=(await sql.query('select user_id from sessions where id=$1 for update',[sessionId])).rows[0];
 if(!s)throw new HttpError(401,'Сессия истекла');
 if(s.user_id)await sql.query('select id from app_users where id=$1 for update',[s.user_id]);
 return {owner:(s.user_id?'user:':'session:')+(s.user_id||sessionId),authenticated:!!s.user_id};
}
export async function mergeFavorites(sql:Sql,sessionId:string,userId:string){
 await sql.query('select id from app_users where id=$1 for update',[userId]);
 const owners=['user:'+userId,'session:'+sessionId];
 const rows=(await sql.query('select property_ids from favorite_sets where owner=any($1::text[]) order by owner desc', [owners])).rows;
 const ids=[...new Set<string>(rows.flatMap(r=>r.property_ids))].slice(0,500);
 await sql.query('insert into favorite_sets(owner,property_ids) values($1,$2) on conflict(owner) do update set property_ids=excluded.property_ids,updated_at=now()',[owners[0],ids]);
 await sql.query('delete from favorite_sets where owner=$1',[owners[1]]);
}
export async function registerFavoriteRoutes(app:FastifyInstance,db:Database,visitor:(r:FastifyRequest)=>Promise<void>){
 app.get('/api/v1/me/favorites',{preHandler:visitor},async r=>db.transaction(async sql=>{
  const identity=await favoriteOwner(sql,r.visitor!.sessionId);
  const ids=(await sql.query('select property_ids from favorite_sets where owner=$1',[identity.owner])).rows[0]?.property_ids||[];
  return {ids,authenticated:identity.authenticated};
 }));
 app.post('/api/v1/me/favorites',{preHandler:visitor},async r=>{
  const input=z.object({changes:z.array(z.object({id:property,saved:z.boolean()}).strict()).max(500),importIds:z.array(property).max(500).optional()}).strict().parse(r.body);
  return db.transaction(async sql=>{
   const identity=await favoriteOwner(sql,r.visitor!.sessionId);
   const ids=new Set<string>((await sql.query('select property_ids from favorite_sets where owner=$1',[identity.owner])).rows[0]?.property_ids||[]);
   let imported=false;
   if(input.importIds){imported=!!(await sql.query('insert into favorite_imports(session_id) values($1) on conflict do nothing returning session_id',[r.visitor!.sessionId])).rows.length;}
   const additions=[...(imported?input.importIds||[]:[]),...input.changes.filter(c=>c.saved).map(c=>c.id)];
   const available=new Set((await sql.query("select id from catalog_properties where id=any($1::text[]) and status='published'",[additions])).rows.map(p=>p.id));
   if(imported)for(const id of input.importIds||[])if(available.has(id))ids.add(id);
   for(const c of input.changes){if(c.saved&&available.has(c.id))ids.add(c.id);else if(!c.saved)ids.delete(c.id);else throw new HttpError(409,'Этот объект больше не опубликован');}
   if(ids.size>500)throw new HttpError(400,'В избранном можно сохранить до 500 ЖК');
   await sql.query('insert into favorite_sets(owner,property_ids) values($1,$2) on conflict(owner) do update set property_ids=excluded.property_ids,updated_at=now()',[identity.owner,[...ids]]);
   return {ids:[...ids],authenticated:identity.authenticated};
  });
 });
}
