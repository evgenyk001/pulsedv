import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireAdmin } from "../../helpers/requireAdmin";
import type { GetOutputType } from "./banners_GET.schema";

export async function handle(request:Request){
  try{
    await requireAdmin(request);
    const rows=await db.selectFrom("promoBanners")
      .select(["id","title","body","ctaLabel","actionUrl","imageUrl","sortOrder","isActive","startsAt","endsAt","audience","city"])
      .orderBy("sortOrder","asc")
      .orderBy("updatedAt","desc")
      .execute();
    const banners=rows.map(row=>({
      id:String(row.id),
      title:row.title,
      body:row.body,
      ctaLabel:row.ctaLabel,
      actionUrl:row.actionUrl,
      imageUrl:row.imageUrl,
      sortOrder:row.sortOrder,
      isActive:row.isActive,
      startsAt:row.startsAt?new Date(row.startsAt):null,
      endsAt:row.endsAt?new Date(row.endsAt):null,
      audience:row.audience,
      city:row.city,
    }));
    return new Response(superjson.stringify({banners} satisfies GetOutputType),{headers:{"Content-Type":"application/json"}});
  }catch(error){
    return new Response(superjson.stringify({error:error instanceof Error?error.message:"Access denied"}),{status:401});
  }
}