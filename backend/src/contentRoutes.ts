import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Database } from "./database";
import type { RuntimeConfig } from "./config";
import { audit } from "./repository";

type Guard=(request:FastifyRequest)=>Promise<void>;

const mediaSpec:Record<string,{ext:string;max:number}>={
  "image/jpeg":{ext:"jpg",max:15*1024*1024},
  "image/png":{ext:"png",max:15*1024*1024},
  "image/webp":{ext:"webp",max:15*1024*1024},
};

export async function registerContentRoutes(
  app:FastifyInstance,
  deps:{db:Database;config:RuntimeConfig;editor:Guard}
){
  const {db,config,editor}=deps;
  for(const type of Object.keys(mediaSpec)){
    if(app.hasContentTypeParser(type))continue;
    app.addContentTypeParser(type,{parseAs:"buffer"},(_request,body,done)=>done(null,body));
  }

  app.post("/api/v1/control/content/banner-media",{
    preHandler:editor,
    bodyLimit:16*1024*1024,
    config:{rateLimit:{max:60,timeWindow:"1 minute"}},
  },async(request,reply)=>{
    const type=(request.headers["content-type"]||"").split(";")[0].trim().toLowerCase();
    const spec=mediaSpec[type];
    if(!spec)return reply.code(415).send({error:"Разрешены JPG, PNG и WebP"});
    const body=request.body;
    if(!Buffer.isBuffer(body)||body.length===0)return reply.code(400).send({error:"Файл пустой"});
    if(body.length>spec.max)return reply.code(413).send({error:"Изображение должно быть меньше 15 МБ"});
    const query=z.object({filename:z.string().max(180).optional()}).strict().parse(request.query);
    const folder="banners";
    const fileName=randomUUID()+"."+spec.ext;
    await mkdir(join(config.MEDIA_ROOT,folder),{recursive:true});
    await writeFile(join(config.MEDIA_ROOT,folder,fileName),body);
    await audit(db,request.member!.id,"banner.media.upload",null,{filename:query.filename||null,mimeType:type,size:body.length});
    return {imageUrl:"/media/"+folder+"/"+fileName,mimeType:type,size:body.length};
  });
}
