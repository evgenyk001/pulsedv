import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireAdmin } from "../../helpers/requireAdmin";
import { schema, type OutputType } from "./banners_POST.schema";

export async function handle(request:Request){
  try{
    await requireAdmin(request);
    const input=schema.parse(superjson.parse(await request.text()));
    const values={
      title:input.title,
      body:input.body,
      ctaLabel:input.ctaLabel??null,
      actionUrl:input.actionUrl??null,
      imageUrl:input.imageUrl??null,
      sortOrder:input.sortOrder,
      isActive:input.isActive,
      startsAt:input.startsAt?new Date(input.startsAt):null,
      endsAt:input.endsAt?new Date(input.endsAt):null,
      audience:input.audience,
      city:input.city??null,
      updatedAt:new Date(),
    };

    let id=input.id??null;
    if(id){
      await db.updateTable("promoBanners").set(values).where("id","=",id).execute();
    }else{
      const created=await db.insertInto("promoBanners").values(values).returning("id").executeTakeFirstOrThrow();
      id=String(created.id);
    }

    const row=await db.selectFrom("promoBanners")
      .select(["id","title","body","ctaLabel","actionUrl","imageUrl","sortOrder","isActive","startsAt","endsAt","audience","city"])
      .where("id","=",id)
      .executeTakeFirstOrThrow();

    const banner={
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
    };

    return new Response(superjson.stringify({banner} satisfies OutputType),{headers:{"Content-Type":"application/json"}});
  }catch(error){
    const message=error instanceof Error?error.message:"Не удалось сохранить баннер";
    const unauthorized=message.toLowerCase().includes("admin")||message.toLowerCase().includes("session");
    return new Response(superjson.stringify({error:message}),{status:unauthorized?401:400});
  }
}