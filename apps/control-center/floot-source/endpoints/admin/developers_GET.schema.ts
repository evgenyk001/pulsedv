import { z } from "zod";
import superjson from "superjson";

export type AdminDeveloper={
  id:string;
  name:string;
  legalName:string|null;
  partnerStatus:"prospect"|"negotiating"|"active"|"paused"|"archived";
  contactName:string|null;
  email:string|null;
  phone:string|null;
  telegram:string|null;
  internalNotes:string;
  cooperationTerms:string;
};

export type GetOutputType={developers:AdminDeveloper[]};

export async function getAdminDevelopers(init?:RequestInit):Promise<GetOutputType>{
  const response=await fetch("/_api/admin/developers",{method:"GET",credentials:"include",...init});
  if(!response.ok)throw new Error("Не удалось загрузить застройщиков");
  return superjson.parse<GetOutputType>(await response.text());
}

export const saveSchema=z.object({
  id:z.string().regex(/^\d+$/).nullable().optional(),
  name:z.string().min(2).max(180),
  legalName:z.string().max(240).nullable().optional(),
  partnerStatus:z.enum(["prospect","negotiating","active","paused","archived"]).default("prospect"),
  contactName:z.string().max(160).nullable().optional(),
  email:z.string().email().nullable().optional().or(z.literal("")),
  phone:z.string().max(80).nullable().optional(),
  telegram:z.string().max(120).nullable().optional(),
  internalNotes:z.string().max(5000).default(""),
  cooperationTerms:z.string().max(5000).default(""),
});
export type SaveInputType=z.infer<typeof saveSchema>;
export type SaveOutputType={developer:AdminDeveloper};

export async function postAdminDeveloper(body:SaveInputType,init?:RequestInit):Promise<SaveOutputType>{
  const validated=saveSchema.parse(body);
  const response=await fetch("/_api/admin/developers",{
    method:"POST",credentials:"include",body:superjson.stringify(validated),...init,
    headers:{"Content-Type":"application/json",...(init?.headers??{})},
  });
  if(!response.ok){
    const payload=superjson.parse<{error?:string}>(await response.text());
    throw new Error(payload.error||"Не удалось сохранить застройщика");
  }
  return superjson.parse<SaveOutputType>(await response.text());
}