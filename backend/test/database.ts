import {randomUUID} from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { postgresDatabase } from '../src/database';
import type { Database, Sql } from '../src/database';
function wrap(client:any):Sql {return {async query(text,values){if(values!==undefined)return client.query(text,values);const results=await client.exec(text);return results.at(-1)||{rows:[]};}};}
export async function testDatabase():Promise<Database>{
 if(process.env.TEST_DATABASE_URL){
  const base=postgresDatabase(process.env.TEST_DATABASE_URL);
  // Extensions belong to the shared test database, never to a disposable schema.
  await base.transaction(async sql=>{await sql.query('select pg_advisory_xact_lock(739125)');await sql.query('create extension if not exists pgcrypto with schema public')});
  const schema='test_'+randomUUID().replaceAll('-','');await base.query('create schema '+schema);
  const url=new URL(process.env.TEST_DATABASE_URL);url.searchParams.set('options','-c search_path='+schema+',public');const scoped=postgresDatabase(url.toString());
  return {...scoped,close:async()=>{await scoped.close();await base.query('drop schema '+schema+' cascade');await base.close()}};
 }
 const pg=new PGlite({extensions:{pgcrypto}});await pg.waitReady;
 return {...wrap(pg),transaction:fn=>pg.transaction(tx=>fn(wrap(tx))),close:()=>pg.close()};
}
