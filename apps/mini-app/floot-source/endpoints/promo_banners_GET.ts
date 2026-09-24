import superjson from "superjson";
import { db } from "../helpers/db";
import type { OutputType } from "./promo_banners_GET.schema";

export async function handle(){
  try{
    const now=new Date();
    const rows=await db.selectFrom("promoBanners")
      .select(["id","imageUrl","title","body","ctaLabel","actionUrl","audience","city","startsAt","endsAt"])
      .where("isActive","=",true)
      .orderBy("sortOrder","asc")
      .execute();

    const banners=rows
      .filter(row=>(!row.startsAt||new Date(row.startsAt)<=now)&&(!row.endsAt||new Date(row.endsAt)>=now))
      .map(row=>({
        id:String(row.id),
        imageUrl:row.imageUrl,
        title:row.title,
        body:row.body,
        ctaLabel:row.ctaLabel,
        actionUrl:row.actionUrl,
        audience:row.audience,
        city:row.city,
      }));

    return new Response(superjson.stringify({banners} satisfies OutputType),{
      headers:{"Content-Type":"application/json"}
    });
  }catch(error){
    console.error("Promo banners load error",error);
    return new Response(superjson.stringify({banners:[]} satisfies OutputType),{
      headers:{"Content-Type":"application/json"}
    });
  }
}