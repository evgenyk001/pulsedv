import { postgresDatabase } from './database';
import { readConfig } from './config';
import { hashPassword } from './security';
const email=process.env.OWNER_EMAIL?.trim().toLowerCase();
const password=process.env.OWNER_PASSWORD;
if(!email||!email.includes('@')||!password||password.length<14)throw new Error('Set OWNER_EMAIL and OWNER_PASSWORD (at least 14 characters)');
const db=postgresDatabase(readConfig().DATABASE_URL);
try{
 await db.transaction(async sql=>{
  await sql.query('select pg_advisory_xact_lock(739126)');
  if((await sql.query("select id from team_members where role='owner'")).rows.length)throw new Error('Owner already exists. Bootstrap does not reset credentials.');
  await sql.query("insert into team_members(name,email,password_hash,role) values($1,$2,$3,'owner')",[process.env.OWNER_NAME||'Владелец',email,await hashPassword(password)]);
 });
 console.log('Owner created. Remove bootstrap password from environment.');
}finally{await db.close();}
