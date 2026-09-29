import { randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual, createHash, createHmac } from 'node:crypto';
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

export function generateMfaCode(){return String(randomInt(0,1_000_000)).padStart(6,'0');}
export function mfaCodeHash(secret:string,challengeId:string,code:string){
  return createHmac('sha256',secret).update(challengeId+':'+code).digest('hex');
}
export function checkMfaCode(secret:string,challengeId:string,code:string,stored:string){
  const actual=Buffer.from(mfaCodeHash(secret,challengeId,code),'hex');
  const expected=Buffer.from(stored,'hex');
  return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
