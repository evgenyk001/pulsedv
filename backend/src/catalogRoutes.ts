import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Database } from "./database";
import type { RuntimeConfig } from "./config";
import { audit } from "./repository";
import { catalogImportSchema, catalogPropertySchema } from "./validation";
import { catalogMeta, getCatalogProperty, listCatalog, removeCatalogProperty, upsertCatalogProperty } from "./catalogRepository";

type Guard=(request:FastifyRequest)=>Promise<void>;

const querySchema=z.object({
  page:z.coerce.number().int().min(1).default(1),
  limit:z.coerce.number().int().min(1).max(1000).default(20),
  q:z.string().max(200).optional(),
  city:z.string().max(100).optional(),
  delivery:z.string().max(100).optional(),
  rooms:z.string().max(30).optional(),
  sea:z.union([z.literal("1"),z.literal("true")]).optional(),
  min:z.coerce.number().nonnegative().optional(),
  max:z.coerce.number().nonnegative().optional(),
  sort:z.enum(["popular","priceAsc","priceDesc"]).default("popular"),
  ids:z.string().max(10000).optional(),
  view:z.enum(["card","match"]).default("card"),
}).strict();

const mediaKinds=["cover","gallery","floorplan","presentation","document"] as const;
const mediaQuery=z.object({
  kind:z.enum(mediaKinds),
  floorplanId:z.string().max(120).optional(),
  filename:z.string().max(300).optional(),
  compact:z.literal("1").optional(),
}).strict();

const mediaSpec:Record<string,{ext:string;group:"image"|"pdf"}>={
  "image/jpeg":{ext:"jpg",group:"image"},
  "image/png":{ext:"png",group:"image"},
  "image/webp":{ext:"webp",group:"image"},
  "application/pdf":{ext:"pdf",group:"pdf"},
};

function internalMediaPath(url:string){
  if(!url.startsWith("/media/"))return null;
  const relative=url.slice("/media/".length);
  if(!relative||relative.includes("..")||relative.startsWith("/"))return null;
  return relative;
}

async function bestEffortDelete(config:RuntimeConfig,url:string|null|undefined){
  if(!url)return;
  const relative=internalMediaPath(url);
  if(!relative)return;
  await unlink(join(config.MEDIA_ROOT,relative)).catch(()=>{});
}

export async function registerCatalogRoutes(
  app:FastifyInstance,
  deps:{db:Database;config:RuntimeConfig;control:Guard;editor:Guard;owner:Guard}
){
  const {db,config,editor,owner}=deps;

  for(const type of Object.keys(mediaSpec)){
    if(app.hasContentTypeParser(type))continue;
    app.addContentTypeParser(type,{parseAs:"buffer"},(_request,body,done)=>done(null,body));
  }

  app.get("/api/v1/public/catalog/meta",async()=>catalogMeta(db,"published"));

  app.get("/api/v1/public/catalog",async request=>{
    const query=querySchema.parse(request.query);
    const ids=query.ids?query.ids.split(",").map(x=>x.trim()).filter(Boolean).slice(0,200):undefined;
    return listCatalog(db,{
      page:query.page,limit:query.limit,q:query.q,city:query.city,delivery:query.delivery,rooms:query.rooms,
      sea:!!query.sea,min:query.min,max:query.max,sort:query.sort,ids,view:query.view,
    });
  });

  app.get("/api/v1/public/catalog/:id",async(request,reply)=>{
    const id=z.string().min(1).max(120).parse((request.params as any).id);
    const property=await getCatalogProperty(db,id,"published");
    if(!property)return reply.code(404).send({error:"Объект не найден"});
    return {property};
  });

  app.get("/api/v1/control/catalog",{preHandler:editor},async request=>{
    const query=querySchema.extend({status:z.enum(["draft","published","archived","all"]).default("all")}).parse(request.query);
    const ids=query.ids?query.ids.split(",").map(x=>x.trim()).filter(Boolean).slice(0,500):undefined;
    return listCatalog(db,{
      status:query.status,page:query.page,limit:query.limit,q:query.q,city:query.city,delivery:query.delivery,
      rooms:query.rooms,sea:!!query.sea,min:query.min,max:query.max,sort:query.sort,ids,view:query.view,
    });
  });

  app.get("/api/v1/control/catalog/:id",{preHandler:editor},async(request,reply)=>{
    const id=z.string().min(1).max(120).parse((request.params as any).id);
    const property=await getCatalogProperty(db,id,"any");
    if(!property)return reply.code(404).send({error:"Объект не найден"});
    return {property};
  });

  app.post("/api/v1/control/catalog",{preHandler:editor},async(request,reply)=>{
    const property=catalogPropertySchema.parse(request.body);
    if(await getCatalogProperty(db,property.id,"any"))return reply.code(409).send({error:"Такой ID уже существует"});
    await db.transaction(async sql=>{
      await upsertCatalogProperty(sql,property);
      await audit(sql,request.member!.id,"catalog.create",property.id,{status:property.status});
    });
    return {property:await getCatalogProperty(db,property.id,"any")};
  });

  app.put("/api/v1/control/catalog/:id",{preHandler:editor},async(request,reply)=>{
    const id=z.string().min(1).max(120).parse((request.params as any).id);
    const property=catalogPropertySchema.parse(request.body);
    if(property.id!==id)return reply.code(400).send({error:"ID объекта нельзя менять этим запросом"});
    if(!await getCatalogProperty(db,id,"any"))return reply.code(404).send({error:"Объект не найден"});
    await db.transaction(async sql=>{
      await upsertCatalogProperty(sql,property);
      await audit(sql,request.member!.id,"catalog.update",id,{status:property.status});
    });
    return {property:await getCatalogProperty(db,id,"any")};
  });

  app.post("/api/v1/control/catalog/import",{preHandler:editor,bodyLimit:25*1024*1024,config:{rateLimit:{max:5,timeWindow:"1 minute"}}},async request=>{
    const input=catalogImportSchema.parse(request.body);
    let created=0,updated=0;
    await db.transaction(async sql=>{
      for(const incoming of input.properties){
        const exists=await getCatalogProperty(sql,incoming.id,"any");
        const property=exists?{
          ...incoming,
          images:input.replace.images?incoming.images:exists.images,
          features:input.replace.features?incoming.features:exists.features,
          floorplans:input.replace.floorplans?incoming.floorplans:exists.floorplans,
          documents:input.replace.documents?incoming.documents:(exists.documents??[]),
        }:incoming;
        await upsertCatalogProperty(sql,property);
        exists?updated++:created++;
      }
      await audit(sql,request.member!.id,"catalog.import",null,{count:input.properties.length,created,updated});
    });
    return {ok:true,total:input.properties.length,created,updated};
  });

  app.delete("/api/v1/control/catalog/:id",{preHandler:owner},async(request,reply)=>{
    const id=z.string().min(1).max(120).parse((request.params as any).id);
    const property=await getCatalogProperty(db,id,"any");
    if(!property)return reply.code(404).send({error:"Объект не найден"});
    const removed=await db.transaction(async sql=>{
      const ok=await removeCatalogProperty(sql,id);
      if(ok)await audit(sql,request.member!.id,"catalog.delete",id);
      return ok;
    });
    if(!removed)return reply.code(404).send({error:"Объект не найден"});
    for(const image of property.images)await bestEffortDelete(config,image.url);
    for(const plan of property.floorplans)await bestEffortDelete(config,plan.imageUrl);
    for(const doc of property.documents??[])await bestEffortDelete(config,doc.url);
    await bestEffortDelete(config,property.coverImageUrl);
    return {ok:true};
  });

  app.post("/api/v1/control/catalog/:id/media",{
    preHandler:editor,
    bodyLimit:55*1024*1024,
    config:{rateLimit:{max:600,timeWindow:"1 minute"}},
  },async(request,reply)=>{
    const id=z.string().min(1).max(120).parse((request.params as any).id);
    const query=mediaQuery.parse(request.query);
    const property=await getCatalogProperty(db,id,"any");
    if(!property)return reply.code(404).send({error:"Объект не найден"});

    const type=(request.headers["content-type"]||"").split(";")[0].trim().toLowerCase();
    const spec=mediaSpec[type];
    if(!spec)return reply.code(415).send({error:"Разрешены JPG, PNG, WebP и PDF"});
    const expectsPdf=query.kind==="presentation"||query.kind==="document";
    if(expectsPdf&&spec.group!=="pdf")return reply.code(400).send({error:"Для презентации нужен PDF"});
    if(!expectsPdf&&spec.group!=="image")return reply.code(400).send({error:"Для изображения нужен JPG, PNG или WebP"});
    const body=request.body;
    if(!Buffer.isBuffer(body)||body.length===0)return reply.code(400).send({error:"Файл пустой"});
    if(spec.group==="image"&&body.length>15*1024*1024)return reply.code(413).send({error:"Изображение больше 15 МБ"});
    if(spec.group==="pdf"&&body.length>50*1024*1024)return reply.code(413).send({error:"PDF больше 50 МБ"});

    const folder=spec.group==="image"?"images":"documents";
    const fileName=randomUUID()+"."+spec.ext;
    await mkdir(join(config.MEDIA_ROOT,folder),{recursive:true});
    await writeFile(join(config.MEDIA_ROOT,folder,fileName),body);
    const url="/media/"+folder+"/"+fileName;

    try{
      await db.transaction(async sql=>{
        if(query.kind==="cover"){
          const old=(await sql.query("select cover_image_url from catalog_properties where id=$1 for update",[id])).rows[0]?.cover_image_url;
          await sql.query("update catalog_properties set cover_image_url=$2 where id=$1",[id,url]);
          if(old&&old!==url)void bestEffortDelete(config,old);
        }else if(query.kind==="gallery"){
          const order=Number((await sql.query("select coalesce(max(sort_order),-1)+1 as next from catalog_property_images where property_id=$1",[id])).rows[0]?.next??0);
          await sql.query("insert into catalog_property_images(id,property_id,url,alt,sort_order) values($1,$2,$3,$4,$5)",[randomUUID(),id,url,property.name,order]);
        }else if(query.kind==="floorplan"){
          if(!query.floorplanId)throw Object.assign(new Error("Нужен floorplanId"),{statusCode:400});
          const row=(await sql.query("select image_url from catalog_property_floorplans where id=$1 and property_id=$2 for update",[query.floorplanId,id])).rows[0];
          if(!row)throw Object.assign(new Error("Планировка не найдена"),{statusCode:404});
          await sql.query("update catalog_property_floorplans set image_url=$3 where id=$1 and property_id=$2",[query.floorplanId,id,url]);
          if(row.image_url&&row.image_url!==url)void bestEffortDelete(config,row.image_url);
        }else{
          const order=Number((await sql.query("select coalesce(max(sort_order),-1)+1 as next from catalog_property_documents where property_id=$1",[id])).rows[0]?.next??0);
          const name=(query.filename||property.name+" — презентация").replace(/[\r\n]/g," ").slice(0,300);
          await sql.query("insert into catalog_property_documents(id,property_id,kind,name,url,mime_type,size_bytes,sort_order) values($1,$2,$3,$4,$5,$6,$7,$8)",[
            randomUUID(),id,query.kind,name,url,type,body.length,order
          ]);
        }
        await audit(sql,request.member!.id,"catalog.media.upload",id,{kind:query.kind,size:body.length});
      });
    }catch(error){
      await bestEffortDelete(config,url);
      throw error;
    }
    if(query.compact)return {ok:true,url};
    return {property:await getCatalogProperty(db,id,"any")};
  });

  app.delete("/api/v1/control/catalog/:id/media/:mediaId",{preHandler:editor},async(request,reply)=>{
    const id=z.string().min(1).max(120).parse((request.params as any).id);
    const mediaId=z.string().min(1).max(120).parse((request.params as any).mediaId);
    const kind=z.enum(["gallery","presentation","document","floorplan"]).parse((request.query as any).kind);
    let url:string|null=null;
    const deleted=await db.transaction(async sql=>{
      if(kind==="gallery"){
        const row=(await sql.query("delete from catalog_property_images where id=$1 and property_id=$2 returning url",[mediaId,id])).rows[0];
        url=row?.url??null;
      }else if(kind==="floorplan"){
        const row=(await sql.query("select image_url from catalog_property_floorplans where id=$1 and property_id=$2 for update",[mediaId,id])).rows[0];
        if(row){url=row.image_url??null;await sql.query("update catalog_property_floorplans set image_url=null where id=$1 and property_id=$2",[mediaId,id]);}
      }else{
        const row=(await sql.query("delete from catalog_property_documents where id=$1 and property_id=$2 and kind=$3 returning url",[mediaId,id,kind])).rows[0];
        url=row?.url??null;
      }
      if(!url)return false;
      await audit(sql,request.member!.id,"catalog.media.delete",id,{kind,mediaId});
      return true;
    });
    if(!deleted)return reply.code(404).send({error:"Файл не найден"});
    await bestEffortDelete(config,url);
    return {ok:true,property:await getCatalogProperty(db,id,"any")};
  });
}
