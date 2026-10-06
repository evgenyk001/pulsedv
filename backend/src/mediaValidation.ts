import sharp from 'sharp';
import {Worker} from 'node:worker_threads';
let active=0;
function validatePdf(body:Buffer){
 return new Promise<void>((resolve,reject)=>{
  const worker=new Worker(`const {parentPort,workerData}=require('node:worker_threads');const {PDFDocument}=require('pdf-lib');PDFDocument.load(workerData,{throwOnInvalidObject:true}).then(pdf=>{if(pdf.getPageCount()<1||pdf.getPageCount()>1000)throw new Error('pages');parentPort.postMessage(true)}).catch(()=>parentPort.postMessage(false));`,{eval:true,workerData:body,resourceLimits:{maxOldGenerationSizeMb:128}});
  const timer=setTimeout(()=>{void worker.terminate();reject(new Error('PDF timeout'))},5000);
  const finish=(ok:boolean)=>{clearTimeout(timer);void worker.terminate();ok?resolve():reject(new Error('Invalid PDF'))};
  worker.once('message',ok=>finish(ok===true));worker.once('error',()=>finish(false));worker.once('exit',()=>{clearTimeout(timer);reject(new Error('PDF worker stopped'))});
 });
}
import { HttpError } from './security';

// Decode the complete file. A matching magic prefix alone proves nothing.
export async function validateMedia(type:string,body:Buffer):Promise<Buffer>{
 if(active>=2)throw new HttpError(429,'Проверяем другие файлы. Попробуйте через несколько секунд');
 active++;
 try{
  if(type==='application/pdf'){
   if(!body.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('format');
   await validatePdf(body);
   return body;
  }
  const expected:Record<string,string>={'image/jpeg':'jpeg','image/png':'png','image/webp':'webp'};
  const image=sharp(body,{limitInputPixels:24_000_000,failOn:'warning'});
  const meta=await image.metadata();
  if(!expected[type]||meta.format!==expected[type]||(meta.pages||1)>1)throw new Error('format');
  // Re-encoding drops EXIF/GPS and any trailing payload while validating all pixels.
  return await image.rotate().toBuffer();
 }catch{throw new HttpError(400,'Файл повреждён, имеет неподдерживаемый формат или слишком большое разрешение');}finally{active--;}
}
