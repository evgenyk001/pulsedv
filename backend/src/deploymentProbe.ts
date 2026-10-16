// Disposable Compose smoke test only. TLS exception is restricted to loopback.
import assert from 'node:assert/strict';
import {request} from 'node:https';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {DEFAULT_PROPERTIES} from '../../packages/pulse-data/model';

const base=new URL(process.env.PULSE_SMOKE_URL||'');
assert.equal(base.protocol,'https:');assert.equal(base.hostname,'127.0.0.1');
const stateFile=process.env.PULSE_SMOKE_STATE_FILE;assert.ok(stateFile);
const headers={host:'localhost',origin:'https://localhost'};
async function call(path:string,{method='GET',body,cookie,token,type='application/json'}:{method?:string;body?:unknown;cookie?:string;token?:string;type?:string}={}){
 const data=body===undefined?undefined:Buffer.isBuffer(body)?body:Buffer.from(JSON.stringify(body));
 return new Promise<{status:number;headers:import('node:http').IncomingHttpHeaders;bytes:Buffer;json:()=>any}>((resolve,reject)=>{
  const req=request(new URL(path,base),{method,servername:'localhost',rejectUnauthorized:false,headers:{...headers,...(data?{'content-type':type,'content-length':data.length}:{}),...(cookie?{cookie}:{}),...(token?{authorization:'Bearer '+token}:{})},timeout:15000},res=>{
   const chunks:Buffer[]=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{const bytes=Buffer.concat(chunks);resolve({status:res.statusCode!,headers:res.headers,bytes,json:()=>JSON.parse(bytes.toString())})});
  });req.on('timeout',()=>req.destroy(new Error('Smoke request timed out')));req.on('error',reject);req.end(data);
 });
}
const login=await call('/api/v1/control/login',{method:'POST',body:{email:process.env.OWNER_EMAIL,password:process.env.OWNER_PASSWORD}});
assert.equal(login.status,200,'Owner login through Caddy');
const setCookie=login.headers['set-cookie']?.find(c=>c.startsWith('pulse_control='));assert.ok(setCookie);assert.match(setCookie,/Secure/i);assert.match(setCookie,/HttpOnly/i);assert.match(setCookie,/Path=\/api\/v1\/control/);
const cookie=setCookie.split(';')[0];
assert.equal((await call('/api/v1/control/me',{cookie})).status,200);
assert.equal((await call('/api/v1/control/me')).status,401);
assert.equal((await call('/ready')).status,200);

if(process.argv[2]==='seed'){
 for(const path of ['/','/pulsedv/mini-app/','/pulsedv/control-center/','/partner-offer/']){
  const response=await call(path);assert.equal(response.status,200,path);assert.match(response.bytes.toString(),/<html/i);
  if(path.includes('control-center'))assert.match(String(response.headers['content-security-policy']),/frame-ancestors 'none'/);
  for(const match of response.bytes.toString().matchAll(/(?:src|href)="([^"#]+\.(?:js|css))"/g)){
   assert.equal((await call(new URL(match[1],new URL(path,base)).pathname)).status,200,'Built asset '+match[1]);
  }
 }
 assert.equal((await call('/media/private/probe.txt')).status,404);
 const property=structuredClone(DEFAULT_PROPERTIES[0]);property.id=randomUUID();property.priceFrom=7.543219;property.status='published';
 assert.equal((await call('/api/v1/control/catalog',{method:'POST',body:property,cookie})).status,200,'Create catalog property');
 const png=await sharp({create:{width:8,height:8,channels:3,background:'red'}}).png().toBuffer();
 assert.equal((await call('/api/v1/control/catalog/'+property.id+'/media?kind=cover',{method:'POST',body:png,type:'image/png',cookie})).status,200,'Upload into production media volume');
 const saved=(await call('/api/v1/public/catalog/'+property.id)).json().property;
 assert.equal(saved.priceFrom,7.543219);assert.match(saved.coverImageUrl,/^\/media\/images\//);
 const media=await call(saved.coverImageUrl);assert.equal(media.status,200);assert.match(String(media.headers['content-type']),/image/);
 const session=await call('/api/v1/auth/session',{method:'POST',body:{}});assert.equal(session.status,200);
 const input={idempotencyKey:randomUUID(),name:'CI Smoke Buyer',phone:'+79990000991',source:'mortgage',propertyId:property.id,consent:true,consentVersion:(await call('/api/v1/public/state')).json().consentVersion,context:{price:7543219,down:1516187}};
 const lead=await call('/api/v1/leads',{method:'POST',token:session.json().accessToken,body:input});assert.equal(lead.status,200,'Lead through production API');
 const duplicate=await call('/api/v1/leads',{method:'POST',token:session.json().accessToken,body:input});assert.equal(duplicate.status,200);assert.equal(duplicate.json().id,lead.json().id);assert.equal(duplicate.json().duplicate,true);
 await writeFile(stateFile,JSON.stringify({propertyId:property.id,leadId:lead.json().id,media:saved.coverImageUrl}));
 console.log('Production routes, assets, secure login, catalog, media and idempotent lead passed');
}else if(process.argv[2]==='verify'){
 const state=JSON.parse(await readFile(stateFile,'utf8'));
 const property=await call('/api/v1/public/catalog/'+state.propertyId);assert.equal(property.status,200);assert.equal(property.json().property.priceFrom,7.543219);
 assert.equal((await call(state.media)).status,200);
 const lead=await call('/api/v1/control/leads/'+state.leadId,{cookie});assert.equal(lead.status,200);assert.equal(lead.json().lead.requestContext.price,7543219);
 console.log('Catalog, exact price, lead and media survived container restart');
}else throw new Error('Expected seed or verify');
