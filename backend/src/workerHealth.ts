import {postgresDatabase} from './database';
import {readConfig} from './config';
const db=postgresDatabase(readConfig().DATABASE_URL);
try{
 const row=(await db.query("select updated_at>now()-interval '2 minutes' as healthy from worker_health where name='notifications'")).rows[0];
 process.exitCode=row?.healthy?0:1;
}catch{process.exitCode=1;}finally{await db.close();}
