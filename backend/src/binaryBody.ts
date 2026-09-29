import type {FastifyInstance} from 'fastify';
import {createWriteStream} from 'node:fs';
import {unlink} from 'node:fs/promises';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';

export class BinaryBodyError extends Error{
 constructor(public statusCode:number,message:string){super(message);}
}

const asReadable=(body:unknown)=>{
 if(Buffer.isBuffer(body))return Readable.from(body);
 if(body&&typeof (body as any)[Symbol.asyncIterator]==='function')return body as NodeJS.ReadableStream;
 throw new BinaryBodyError(400,'Файл пустой');
};

export function registerBinaryParsers(app:FastifyInstance,types:string[]){
 for(const type of types){
  if(app.hasContentTypeParser(type))continue;
  app.addContentTypeParser(type,(request,payload,done)=>done(null,payload));
 }
}

export async function readBinaryBody(body:unknown,max:number){
 if(Buffer.isBuffer(body)){
  if(!body.length)throw new BinaryBodyError(400,'Файл пустой');
  if(body.length>max)throw new BinaryBodyError(413,'Файл слишком большой');
  return body;
 }
 const chunks:Buffer[]=[];let size=0;
 for await(const chunk of asReadable(body) as any){
  const value=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=value.length;
  if(size>max)throw new BinaryBodyError(413,'Файл слишком большой');
  chunks.push(value);
 }
 if(!size)throw new BinaryBodyError(400,'Файл пустой');
 return Buffer.concat(chunks,size);
}

export async function streamBinaryBodyToFile(body:unknown,path:string,max:number){
 let size=0;let head=Buffer.alloc(0);
 const limiter=new Transform({
  transform(chunk,_encoding,callback){
   const value=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=value.length;
   if(size>max)return callback(new BinaryBodyError(413,'Файл слишком большой'));
   if(head.length<16)head=Buffer.concat([head,value.subarray(0,16-head.length)]);
   callback(null,value);
  }
 });
 try{
  await pipeline(asReadable(body) as any,limiter,createWriteStream(path,{flags:'wx'}));
  if(!size)throw new BinaryBodyError(400,'Файл пустой');
  return {size,head};
 }catch(error){
  await unlink(path).catch(()=>{});
  throw error;
 }
}
