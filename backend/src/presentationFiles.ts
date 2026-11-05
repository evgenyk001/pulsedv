import {lstat,readFile} from 'node:fs/promises';
import {join} from 'node:path';
export const MAX_PRESENTATION_BYTES=50_000_000;
export async function presentationFile(root:string,url:string){
 if(!/^\/media\/documents\/[a-f0-9-]{36}\.pdf$/.test(url))throw new Error('Presentation must be an uploaded PDF');
 const path=join(root,url.slice('/media/'.length));
 const file=await lstat(path);
 if(!file.isFile()||file.size<5||file.size>MAX_PRESENTATION_BYTES)throw new Error('Presentation PDF unavailable or too large');
 return path;
}
export async function readPresentation(root:string,url:string){
 const path=await presentationFile(root,url),data=await readFile(path);
 if(data.length>MAX_PRESENTATION_BYTES||data.subarray(0,5).toString()!=='%PDF-')throw new Error('Invalid presentation PDF');
 return data;
}
