import { db } from "./db";
import { PropertyRecord, PropertyStatus } from "./propertyTypes";

const asNumber=(value:unknown)=>value===null||value===undefined?null:Number(value);

export async function listProperties(includeUnpublished=false):Promise<PropertyRecord[]>{
  let query=db.selectFrom("properties").selectAll();
  if(!includeUnpublished)query=query.where("status","=","published");
  const rows=await query.orderBy("sortOrder","asc").orderBy("createdAt","desc").execute();
  if(rows.length===0)return [];

  const ids=rows.map(row=>row.id);
  const [images,features,floorplans]=await Promise.all([
    db.selectFrom("propertyImages").selectAll().where("propertyId","in",ids).orderBy("sortOrder").execute(),
    db.selectFrom("propertyFeatures").selectAll().where("propertyId","in",ids).orderBy("sortOrder").execute(),
    db.selectFrom("floorplans").selectAll().where("propertyId","in",ids).orderBy("sortOrder").execute(),
  ]);

  return rows.map(row=>({
    id:row.id,
    name:row.name,
    city:row.city,
    district:row.district,
    address:row.address,
    latitude:row.latitude,
    longitude:row.longitude,
    priceFrom:Number(row.priceFrom),
    delivery:row.delivery,
    className:row.className,
    status:row.status,
    description:row.description,
    developerName:row.developerName,
    tags:row.tags,
    coverImageUrl:row.coverImageUrl,
    sortOrder:row.sortOrder,
    images:images.filter(x=>x.propertyId===row.id).map(x=>({
      id:String(x.id),url:x.url,alt:x.alt,sortOrder:x.sortOrder
    })),
    features:features.filter(x=>x.propertyId===row.id).map(x=>({
      id:String(x.id),label:x.label,icon:x.icon,sortOrder:x.sortOrder
    })),
    floorplans:floorplans.filter(x=>x.propertyId===row.id).map(x=>({
      id:String(x.id),
      roomLabel:x.roomLabel,
      areaFrom:asNumber(x.areaFrom),
      areaTo:asNumber(x.areaTo),
      priceFrom:asNumber(x.priceFrom),
      imageUrl:x.imageUrl,
      sortOrder:x.sortOrder
    })),
  }));
}

export type SavePropertyInput={
  id:string;
  name:string;
  city:string;
  district:string;
  address?:string|null;
  latitude?:number|null;
  longitude?:number|null;
  priceFrom:number;
  delivery:string;
  className:string;
  status:PropertyStatus;
  description:string;
  developerName:string;
  tags:string[];
  coverImageUrl?:string|null;
  sortOrder:number;
  images:Array<{url:string;alt?:string;sortOrder:number}>;
  features:Array<{label:string;icon:string;sortOrder:number}>;
  floorplans:Array<{roomLabel:string;areaFrom?:number|null;areaTo?:number|null;priceFrom?:number|null;imageUrl?:string|null;sortOrder:number}>;
};

export async function saveProperty(input:SavePropertyInput){
  const now=new Date();
  await db.transaction().execute(async trx=>{
    await trx.insertInto("properties").values({
      id:input.id,
      name:input.name,
      city:input.city,
      district:input.district,
      address:input.address||null,
      latitude:input.latitude??null,
      longitude:input.longitude??null,
      priceFrom:input.priceFrom,
      delivery:input.delivery,
      className:input.className,
      status:input.status,
      description:input.description,
      developerName:input.developerName,
      tags:input.tags,
      coverImageUrl:input.coverImageUrl||input.images[0]?.url||null,
      sortOrder:input.sortOrder,
      updatedAt:now,
    }).onConflict(oc=>oc.column("id").doUpdateSet({
      name:input.name,
      city:input.city,
      district:input.district,
      address:input.address||null,
      latitude:input.latitude??null,
      longitude:input.longitude??null,
      priceFrom:input.priceFrom,
      delivery:input.delivery,
      className:input.className,
      status:input.status,
      description:input.description,
      developerName:input.developerName,
      tags:input.tags,
      coverImageUrl:input.coverImageUrl||input.images[0]?.url||null,
      sortOrder:input.sortOrder,
      updatedAt:now,
    })).execute();

    await Promise.all([
      trx.deleteFrom("propertyImages").where("propertyId","=",input.id).execute(),
      trx.deleteFrom("propertyFeatures").where("propertyId","=",input.id).execute(),
      trx.deleteFrom("floorplans").where("propertyId","=",input.id).execute(),
    ]);

    if(input.images.length){
      await trx.insertInto("propertyImages").values(input.images.map(x=>({
        propertyId:input.id,url:x.url,alt:x.alt||input.name,sortOrder:x.sortOrder
      }))).execute();
    }
    if(input.features.length){
      await trx.insertInto("propertyFeatures").values(input.features.map(x=>({
        propertyId:input.id,label:x.label,icon:x.icon,sortOrder:x.sortOrder
      }))).execute();
    }
    if(input.floorplans.length){
      await trx.insertInto("floorplans").values(input.floorplans.map(x=>({
        propertyId:input.id,
        roomLabel:x.roomLabel,
        areaFrom:x.areaFrom??null,
        areaTo:x.areaTo??null,
        priceFrom:x.priceFrom??null,
        imageUrl:x.imageUrl??null,
        sortOrder:x.sortOrder,
      }))).execute();
    }
  });
}