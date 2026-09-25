import { z } from "zod";
import superjson from "superjson";

export type AdminPromoBanner={
  id:string;
  title:string;
  body:string;
  ctaLabel:string|null;
  actionUrl:string|null;
  imageUrl:string|null;
  sortOrder:number;
  isActive:boolean;
  startsAt:Date|null;
  endsAt:Date|null;
  audience:string;
  city:string|null;
};

export type GetOutputType={banners:AdminPromoBanner[]};

export async function getAdminBanners(init?:RequestInit):Promise<GetOutputType>{
  const response=await fetch("/_api/admin/banners",{method:"GET",credentials:"include",...init});
  if(!response.ok)throw new Error("Не удалось загрузить баннеры");
  return superjson.parse<GetOutputType>(await response.text());
}

export const saveSchema=z.object({
  id:z.string().regex(/^\d+$/).nullable().optional(),
  title:z.string().min(2).max(180),
  body:z.string().max(600).default(""),
  ctaLabel:z.string().max(80).nullable().optional(),
  actionUrl:z.string().max(500).nullable().optional(),
  imageUrl:z.string().max(1200).nullable().optional(),
  sortOrder:z.number().int().min(0).max(10000).default(100),
  isActive:z.boolean().default(true),
  startsAt:z.string().nullable().optional(),
  endsAt:z.string().nullable().optional(),
  audience:z.string().max(120).default("all"),
  city:z.string().max(120).nullable().optional(),
});
export type SaveInputType=z.infer<typeof saveSchema>;
export type SaveOutputType={banner:AdminPromoBanner};

export async function postAdminBanner(body:SaveInputType,init?:RequestInit):Promise<SaveOutputType>{
  const validated=saveSchema.parse(body);
  const response=await fetch("/_api/admin/banners",{
    method:"POST",
    credentials:"include",
    body:superjson.stringify(validated),
    ...init,
    headers:{"Content-Type":"application/json",...(init?.headers??{})},
  });
  if(!response.ok){
    const payload=superjson.parse<{error?:string}>(await response.text());
    throw new Error(payload.error||"Не удалось сохранить баннер");
  }
  return superjson.parse<SaveOutputType>(await response.text());
}