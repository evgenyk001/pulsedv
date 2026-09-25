import { z } from "zod";
import superjson from "superjson";
import { PropertyRecord } from "../../helpers/propertyTypes";

const imageSchema=z.object({
  url:z.string().min(1),
  alt:z.string().default(""),
  sortOrder:z.number().int().min(0).default(0),
});
const featureSchema=z.object({
  label:z.string().min(1),
  icon:z.string().min(1).default("sparkles"),
  sortOrder:z.number().int().min(0).default(0),
});
const floorplanSchema=z.object({
  roomLabel:z.string().min(1),
  areaFrom:z.number().nonnegative().nullable().optional(),
  areaTo:z.number().nonnegative().nullable().optional(),
  priceFrom:z.number().nonnegative().nullable().optional(),
  imageUrl:z.string().nullable().optional(),
  sortOrder:z.number().int().min(0).default(0),
});

export const schema=z.object({
  id:z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
  name:z.string().min(2).max(120),
  city:z.string().min(2).max(80),
  district:z.string().min(1).max(120),
  address:z.string().max(240).nullable().optional(),
  latitude:z.number().min(-90).max(90).nullable().optional(),
  longitude:z.number().min(-180).max(180).nullable().optional(),
  priceFrom:z.number().nonnegative(),
  delivery:z.string().min(1).max(120),
  className:z.string().min(1).max(80),
  status:z.enum(["draft","published","archived"]),
  description:z.string().max(4000).default(""),
  developerName:z.string().max(160).default(""),
  tags:z.array(z.string().min(1).max(80)).max(12).default([]),
  coverImageUrl:z.string().nullable().optional(),
  sortOrder:z.number().int().min(0).max(100000).default(0),
  images:z.array(imageSchema).max(30).default([]),
  features:z.array(featureSchema).max(20).default([]),
  floorplans:z.array(floorplanSchema).max(40).default([]),
});

export type InputType=z.infer<typeof schema>;
export type OutputType={property:PropertyRecord};

export async function postAdminProperty(body:InputType,init?:RequestInit):Promise<OutputType>{
  const validated=schema.parse(body);
  const response=await fetch("/_api/admin/properties",{
    method:"POST",
    credentials:"include",
    body:superjson.stringify(validated),
    ...init,
    headers:{"Content-Type":"application/json",...(init?.headers??{})},
  });
  if(!response.ok){
    const payload=superjson.parse<{error?:string}>(await response.text());
    throw new Error(payload.error||"Не удалось сохранить объект");
  }
  return superjson.parse<OutputType>(await response.text());
}