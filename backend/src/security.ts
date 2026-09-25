import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import type { Sql } from './database';
const scrypt=promisify(scryptCallback);
export const tokenHash=(value:string)=>createHash('sha256').update(value).digest('hex');
export async function hashPassword(password:string){const salt=randomBytes(16).toString('hex');const hash=await scrypt(password,salt,64) as Buffer;return `${salt}:${hash.toString('hex')}`;}
export async function checkPassword(password:string,stored:string){
  const [salt,hex]=stored.split(':');if(!salt||!hex)return false;
  const expected=Buffer.from(hex,'hex');const actual=await scrypt(password,salt,64) as Buffer;
  return expected.length===actual.length&&timingSafeEqual(expected,actual);
}
export async function issueToken(sql:Sql,kind:'visitor'|'control',id:string){
  const token=randomBytes(32).toString('base64url');
  const expiresAt=new Date(Date.now()+(kind==='control'?8*3600:30*86400)*1000).toISOString();
  await sql.query('insert into auth_tokens(token_hash,kind,session_id,member_id,expires_at) values($1,$2,$3,$4,$5)',[tokenHash(token),kind,kind==='visitor'?id:null,kind==='control'?id:null,expiresAt]);
  return {token,expiresAt};
}
export class HttpError extends Error {constructor(public statusCode:number,message:string){super(message);}}
