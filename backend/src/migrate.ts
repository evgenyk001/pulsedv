import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Database } from './database';
import { postgresDatabase } from './database';
import { readConfig } from './config';
import { DEFAULT_STATE } from '../../packages/pulse-data/model';
export async function migrate(db:Database){
 await db.transaction(async sql=>{
  await sql.query("select pg_advisory_xact_lock(739125)");
  await sql.query('create table if not exists schema_migrations(name text primary key, applied_at timestamptz not null default now())');
  const directory=new URL('../migrations/',import.meta.url);
  for(const name of (await readdir(directory)).filter(x=>x.endsWith('.sql')).sort()){
   if((await sql.query('select name from schema_migrations where name=$1',[name])).rows.length)continue;
   await sql.query(await readFile(new URL(name,directory),'utf8'));
   await sql.query('insert into schema_migrations(name) values($1)',[name]);
  }
  const state={...DEFAULT_STATE,properties:[],updatedAt:new Date().toISOString()};
  await sql.query('insert into app_config(singleton,document) values(true,$1::jsonb) on conflict do nothing',[JSON.stringify(state)]);
 });
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const db=postgresDatabase(readConfig().DATABASE_URL);try{await migrate(db);console.log('Migrations applied');}finally{await db.close();}}
