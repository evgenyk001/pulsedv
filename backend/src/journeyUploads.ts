import {statfs, mkdir, unlink} from 'node:fs/promises';
import {join} from 'node:path';
import type {Database,Sql} from './database';
import {HttpError} from './security';
import type {JourneyAttachment} from '../../packages/journey/model';

export async function reserveUpload(db:Database,root:string,leadId:string,actor:string,url:string,size:number){
 await mkdir(root,{recursive:true});
 const disk=await statfs(root);
 if(disk.bavail*disk.bsize<512*1024*1024+size)throw new HttpError(507,'Хранилище временно заполнено');
 await db.transaction(async sql=>{
  // One global reservation lock prevents concurrent quota bypass across sessions/leads.
  await sql.query('select pg_advisory_xact_lock(739126)');
  const totals=(await sql.query(`select
   coalesce(sum(size) filter(where lead_id=$1),0) as lead_bytes,
   count(*) filter(where actor=$2 and not attached) as pending,
   coalesce(sum(size) filter(where actor=$2 and created_at>now()-interval '1 day'),0) as daily_bytes,
   coalesce(sum(size),0) as total_bytes from journey_uploads`,[leadId,actor])).rows[0];
  if(Number(totals.pending)>=10||Number(totals.daily_bytes)+size>250*1024*1024||Number(totals.lead_bytes)+size>500*1024*1024||Number(totals.total_bytes)+size>10*1024**3)throw new HttpError(413,'Лимит вложений достигнут. Отправьте уже загруженные файлы или попробуйте позже');
  await sql.query('insert into journey_uploads(url,lead_id,actor,size) values($1,$2,$3,$4)',[url,leadId,actor,size]);
 });
}
export async function bindUpload(sql:Sql,leadId:string,actor:string,attachment:JourneyAttachment){
 const row=(await sql.query("select * from journey_uploads where url=$1 and lead_id=$2 and actor=$3 and ready=true and attached=false and created_at>now()-interval '1 day' for update",[attachment.url,leadId,actor])).rows[0];
 if(!row||JSON.stringify(row.metadata)!==JSON.stringify(attachment)){
  // JSONB key order is not stable; compare the declared attachment fields individually.
  if(!row||!Object.entries(attachment).every(([k,v])=>row.metadata?.[k]===v))throw new HttpError(400,'Вложение недоступно. Загрузите файл заново');
 }
 await sql.query('update journey_uploads set attached=true where url=$1',[attachment.url]);
}
export async function cleanExpiredUploads(db:Database,root:string){
 const rows=(await db.query("select url,lead_id from journey_uploads where attached=false and created_at<now()-interval '1 day' limit 500")).rows;
 for(const row of rows){
  const file=String(row.url).split('/').at(-1)!;
  if(!/^[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/.test(file))continue;
  for(const name of [file,file+'.upload'])try{await unlink(join(root,'private','chat',row.lead_id,name));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  await db.query('delete from journey_uploads where url=$1 and attached=false',[row.url]);
 }
 return rows.length;
}
