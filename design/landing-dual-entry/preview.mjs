import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('./',import.meta.url));
const capture=resolve(root,'../../.qa/built');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png','.ttf':'font/ttf'};
http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://localhost');let path=decodeURIComponent(u.pathname);
 if(path==='/capture-frame'){
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
  return res.end('<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#ddd"><iframe title="Экран приложения" src="/capture/#'+(u.searchParams.get('route')||'/')+'" style="position:absolute;left:0;top:0;border:0;width:390px;height:844px"></iframe></body></html>');
 }
 if(path==='/mobile-review'){
  const w=['320','375','390','430','568','667','768','844','1024','1366','1440'].includes(u.searchParams.get('width'))?u.searchParams.get('width'):'390';
  const h=['320','375','390','568','667','740','768','844','852','896','900','1024'].includes(u.searchParams.get('height'))?u.searchParams.get('height'):'844';
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
  return res.end('<!doctype html><html><body style="margin:0;background:#ddd"><iframe title="Мобильный лендинг" src="/" style="border:0;width:'+w+'px;height:'+h+'px"></iframe></body></html>');
 }
 const base=path.startsWith('/capture/')?capture:root;
 if(base===capture)path=path.slice('/capture'.length);
 if(path.endsWith('/'))path+='index.html';
 const file=resolve(base,'.'+path);
 if(!file.startsWith(base.endsWith(sep)?base:base+sep)){res.writeHead(403);return res.end()}
 const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);
 }catch{res.writeHead(404);res.end('Not found')}}).listen(Number(process.env.PORT)||4173,'0.0.0.0',()=>console.log('PULSEDV preview ready'));
