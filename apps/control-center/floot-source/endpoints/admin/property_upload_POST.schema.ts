import { z } from "zod";
import superjson from "superjson";

export const schema=z.object({
  propertyId:z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
  fileName:z.string().min(1).max(120),
  contentType:z.string().regex(/^image\/(jpeg|png|webp|gif|svg\+xml)$/),
  sizeBytes:z.number().int().positive().max(20*1024*1024),
});
export type InputType=z.infer<typeof schema>;
export type OutputType={presignedUrl:string;url:string;filename:string};

export async function postPropertyUpload(body:InputType,init?:RequestInit):Promise<OutputType>{
  const validated=schema.parse(body);
  const response=await fetch("/_api/admin/property_upload",{
    method:"POST",
    credentials:"include",
    body:superjson.stringify(validated),
    ...init,
    headers:{"Content-Type":"application/json",...(init?.headers??{})},
  });
  if(!response.ok){
    const payload=superjson.parse<{error?:string}>(await response.text());
    throw new Error(payload.error||"Не удалось подготовить загрузку");
  }
  return superjson.parse<OutputType>(await response.text());
}