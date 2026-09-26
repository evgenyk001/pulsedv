import { randomUUID } from "node:crypto";
import type { Sql } from "./database";
import type { PulseProperty } from "../../packages/pulse-data/model";

export type CatalogView="card"|"match"|"full";
export type CatalogListOptions={
  status?:"draft"|"published"|"archived"|"all";
  page?:number;
  limit?:number;
  q?:string;
  city?:string;
  delivery?:string;
  rooms?:string;
  sea?:boolean;
  min?:number;
  max?:number;
  sort?:"popular"|"priceAsc"|"priceDesc";
  ids?:string[];
  view?:CatalogView;
};

type CatalogDocument={id?:string;kind:"presentation"|"document";name:string;url:string;mimeType:string|null;sizeBytes:number|null;sortOrder:number};
export type CatalogProperty=PulseProperty&{documents?:CatalogDocument[]};

const n=(value:unknown)=>value===null||value===undefined?null:Number(value);
const normalizeBase=(row:any):CatalogProperty=>({
  id:String(row.id),
  name:String(row.name??""),
  city:String(row.city??""),
  district:String(row.district??""),
  address:row.address??null,
  latitude:n(row.latitude),
  longitude:n(row.longitude),
  priceFrom:Number(row.price_from??row.priceFrom??0),
  delivery:String(row.delivery??""),
  className:String(row.class_name??row.className??""),
  status:row.status,
  description:String(row.description??""),
  developerName:String(row.developer_name??row.developerName??""),
  tags:Array.isArray(row.tags)?row.tags:[],
  coverImageUrl:row.cover_image_url??row.coverImageUrl??null,
  sortOrder:Number(row.sort_order??row.sortOrder??999),
  images:[],
  features:[],
  floorplans:[],
  documents:[],
});

async function hydrate(sql:Sql,items:CatalogProperty[],view:CatalogView){
  if(!items.length||view==="card")return items;
  const ids=items.map(item=>item.id);
  const byId=new Map(items.map(item=>[item.id,item]));

  const [features,floorplans]=await Promise.all([
    sql.query("select id,property_id,label,icon,sort_order from catalog_property_features where property_id=any($1::text[]) order by property_id,sort_order,id",[ids]),
    sql.query("select id,property_id,room_label,area_from,area_to,price_from,image_url,sort_order from catalog_property_floorplans where property_id=any($1::text[]) order by property_id,sort_order,id",[ids]),
  ]);
  for(const row of features.rows){
    byId.get(row.property_id)?.features.push({id:row.id,label:row.label,icon:row.icon,sortOrder:Number(row.sort_order)});
  }
  for(const row of floorplans.rows){
    byId.get(row.property_id)?.floorplans.push({
      id:row.id,roomLabel:row.room_label,areaFrom:n(row.area_from),areaTo:n(row.area_to),
      priceFrom:n(row.price_from),imageUrl:view==="full"?row.image_url:null,sortOrder:Number(row.sort_order),
    });
  }
  if(view!=="full")return items;

  const [images,documents]=await Promise.all([
    sql.query("select id,property_id,url,alt,sort_order from catalog_property_images where property_id=any($1::text[]) order by property_id,sort_order,id",[ids]),
    sql.query("select id,property_id,kind,name,url,mime_type,size_bytes,sort_order from catalog_property_documents where property_id=any($1::text[]) order by property_id,sort_order,id",[ids]),
  ]);
  for(const row of images.rows){
    byId.get(row.property_id)?.images.push({id:row.id,url:row.url,alt:row.alt,sortOrder:Number(row.sort_order)});
  }
  for(const row of documents.rows){
    byId.get(row.property_id)?.documents?.push({
      id:row.id,kind:row.kind,name:row.name,url:row.url,mimeType:row.mime_type??null,
      sizeBytes:n(row.size_bytes),sortOrder:Number(row.sort_order),
    });
  }
  return items;
}

export async function listCatalog(sql:Sql,options:CatalogListOptions={}){
  const page=Math.max(1,Math.floor(options.page??1));
  const limit=Math.max(1,Math.min(1000,Math.floor(options.limit??20)));
  const where:string[]=[];
  const values:unknown[]=[];
  const add=(value:unknown)=>{values.push(value);return "$"+values.length;};

  const status=options.status??"published";
  if(status!=="all")where.push("p.status="+add(status));
  if(options.q?.trim()){
    const q="%"+options.q.trim().toLowerCase()+"%";
    where.push("lower(p.name||' '||p.city||' '||p.district||' '||p.developer_name) like "+add(q));
  }
  if(options.city&&options.city!=="Все")where.push("p.city="+add(options.city));
  if(options.delivery&&options.delivery!=="Любой"&&options.delivery!=="Не важно")where.push("p.delivery ilike "+add("%"+options.delivery+"%"));
  if(options.ids?.length)where.push("p.id=any("+add(options.ids)+"::text[])");
  if(options.sea)where.push("(p.tags::text ilike '%море%' or exists(select 1 from catalog_property_features f where f.property_id=p.id and f.label ilike '%море%'))");

  const minM=options.min&&options.min>1000?options.min/1_000_000:options.min;
  const maxM=options.max&&options.max>1000?options.max/1_000_000:options.max;
  if(options.rooms&&options.rooms!=="Все"){
    const room=add(options.rooms);
    const planConditions=["fp.property_id=p.id","fp.room_label="+room];
    if(minM!==undefined)planConditions.push("fp.price_from>="+add(minM));
    if(maxM!==undefined)planConditions.push("fp.price_from<="+add(maxM));
    where.push("exists(select 1 from catalog_property_floorplans fp where "+planConditions.join(" and ")+")");
  }else{
    if(minM!==undefined)where.push("p.price_from>="+add(minM));
    if(maxM!==undefined)where.push("p.price_from<="+add(maxM));
  }

  const clause=where.length?" where "+where.join(" and "):"";
  const order=options.sort==="priceAsc"?"p.price_from asc,p.sort_order asc,p.id asc":
    options.sort==="priceDesc"?"p.price_from desc,p.sort_order asc,p.id asc":
    "p.sort_order asc,p.id asc";

  const totalResult=await sql.query("select count(*)::int as total from catalog_properties p"+clause,values);
  const total=Number(totalResult.rows[0]?.total??0);
  const listValues=[...values,limit,(page-1)*limit];
  const rows=(await sql.query(
    "select p.* from catalog_properties p"+clause+" order by "+order+" limit $"+(values.length+1)+" offset $"+(values.length+2),
    listValues
  )).rows;
  const items=await hydrate(sql,rows.map(normalizeBase),options.view??"card");
  return {items,page,limit,total,hasMore:page*limit<total};
}

export async function getCatalogProperty(sql:Sql,id:string,status:"published"|"any"="published"){
  const row=(await sql.query("select * from catalog_properties where id=$1"+(status==="published"?" and status='published'":""),[id])).rows[0];
  if(!row)return null;
  return (await hydrate(sql,[normalizeBase(row)],"full"))[0];
}

export async function catalogMeta(sql:Sql,status:"published"|"all"="published"){
  const where=status==="published"?"where status='published'":"";
  const row=(await sql.query(`select coalesce(min(price_from),0) as min_price,coalesce(max(price_from),0) as max_price,count(*)::int as total from catalog_properties ${where}`)).rows[0];
  const cities=(await sql.query(`select city,count(*)::int as count from catalog_properties ${where} group by city order by city`)).rows;
  return{
    minPriceRub:Math.round(Number(row?.min_price??0)*1_000_000),
    maxPriceRub:Math.round(Number(row?.max_price??0)*1_000_000),
    stepRub:100_000,
    total:Number(row?.total??0),
    cities:cities.map(item=>({city:item.city,count:Number(item.count)})),
  };
}

export async function upsertCatalogProperty(sql:Sql,p:CatalogProperty){
  await sql.query(`insert into catalog_properties(
    id,name,city,district,address,latitude,longitude,price_from,delivery,class_name,status,description,developer_name,tags,cover_image_url,sort_order
  ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16)
  on conflict(id) do update set
    name=excluded.name,city=excluded.city,district=excluded.district,address=excluded.address,latitude=excluded.latitude,longitude=excluded.longitude,
    price_from=excluded.price_from,delivery=excluded.delivery,class_name=excluded.class_name,status=excluded.status,description=excluded.description,
    developer_name=excluded.developer_name,tags=excluded.tags,cover_image_url=excluded.cover_image_url,sort_order=excluded.sort_order`,[
    p.id,p.name,p.city,p.district,p.address,p.latitude,p.longitude,p.priceFrom,p.delivery,p.className,p.status,p.description,p.developerName,
    JSON.stringify(p.tags??[]),p.coverImageUrl,p.sortOrder
  ]);

  await sql.query("delete from catalog_property_images where property_id=$1",[p.id]);
  for(const [index,image] of (p.images??[]).entries()){
    await sql.query("insert into catalog_property_images(id,property_id,url,alt,sort_order) values($1,$2,$3,$4,$5)",[
      image.id||randomUUID(),p.id,image.url,image.alt||p.name,image.sortOrder??index
    ]);
  }

  await sql.query("delete from catalog_property_features where property_id=$1",[p.id]);
  for(const [index,feature] of (p.features??[]).entries()){
    await sql.query("insert into catalog_property_features(id,property_id,label,icon,sort_order) values($1,$2,$3,$4,$5)",[
      feature.id||randomUUID(),p.id,feature.label,feature.icon||"building",feature.sortOrder??index
    ]);
  }

  await sql.query("delete from catalog_property_floorplans where property_id=$1",[p.id]);
  for(const [index,plan] of (p.floorplans??[]).entries()){
    await sql.query("insert into catalog_property_floorplans(id,property_id,room_label,area_from,area_to,price_from,image_url,sort_order) values($1,$2,$3,$4,$5,$6,$7,$8)",[
      plan.id||randomUUID(),p.id,plan.roomLabel,plan.areaFrom,plan.areaTo,plan.priceFrom,plan.imageUrl,plan.sortOrder??index
    ]);
  }

  await sql.query("delete from catalog_property_documents where property_id=$1",[p.id]);
  for(const [index,doc] of (p.documents??[]).entries()){
    await sql.query("insert into catalog_property_documents(id,property_id,kind,name,url,mime_type,size_bytes,sort_order) values($1,$2,$3,$4,$5,$6,$7,$8)",[
      doc.id||randomUUID(),p.id,doc.kind,doc.name,doc.url,doc.mimeType,doc.sizeBytes,doc.sortOrder??index
    ]);
  }
}

export async function removeCatalogProperty(sql:Sql,id:string){
  return (await sql.query("delete from catalog_properties where id=$1 returning id",[id])).rows.length>0;
}
