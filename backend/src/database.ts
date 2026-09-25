import pg from 'pg';
export type Sql = { query(text:string, values?:unknown[]):Promise<{rows:any[];rowCount?:number|null}> };
export type Database = Sql & { transaction<T>(fn:(sql:Sql)=>Promise<T>):Promise<T>; close():Promise<void> };
export function postgresDatabase(url:string):Database {
  const pool=new pg.Pool({connectionString:url,max:10,connectionTimeoutMillis:5000,statement_timeout:15000});
  pool.on('error',()=>console.error('Unexpected idle database connection error'));
  return {
    query:(text,values)=>pool.query(text,values),
    async transaction(fn){const client=await pool.connect();try{await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}},
    close:()=>pool.end(),
  };
}
export const camelRow=(row:Record<string,any>)=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key.replace(/_([a-z])/g,(_,c)=>c.toUpperCase()),value instanceof Date?value.toISOString():value]));
