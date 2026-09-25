import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { postgresDatabase } from '../src/database';
import type { Database, Sql } from '../src/database';
function wrap(client:any):Sql {return {async query(text,values){if(values!==undefined)return client.query(text,values);const results=await client.exec(text);return results.at(-1)||{rows:[]};}};}
export async function testDatabase():Promise<Database>{
 if(process.env.TEST_DATABASE_URL)return postgresDatabase(process.env.TEST_DATABASE_URL);
 const pg=new PGlite({extensions:{pgcrypto}});await pg.waitReady;
 return {...wrap(pg),transaction:fn=>pg.transaction(tx=>fn(wrap(tx))),close:()=>pg.close()};
}
