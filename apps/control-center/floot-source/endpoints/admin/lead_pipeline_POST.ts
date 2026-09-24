import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireAdmin } from "../../helpers/requireAdmin";
import { schema, type OutputType } from "./lead_pipeline_POST.schema";

export async function handle(request:Request){
  try{
    await requireAdmin(request);
    const input=schema.parse(superjson.parse(await request.text()));
    const current=await db.selectFrom("leads").select(["id","pipelineStatus"]).where("id","=",input.leadId).executeTakeFirst();
    if(!current)throw new Error("Лид не найден");

    await db.transaction().execute(async trx=>{
      await trx.updateTable("leads").set({pipelineStatus:input.status}).where("id","=",input.leadId).execute();
      await trx.insertInto("leadHistory").values({
        leadId:input.leadId,
        eventType:"pipeline_status_changed",
        fromStatus:current.pipelineStatus,
        toStatus:input.status,
        note:input.note??null,
        actorUserId:null,
      }).execute();
    });

    const payload:OutputType={ok:true,leadId:input.leadId,status:input.status};
    return new Response(superjson.stringify(payload),{headers:{"Content-Type":"application/json"}});
  }catch(error){
    const message=error instanceof Error?error.message:"Не удалось обновить этап";
    const unauthorized=message.toLowerCase().includes("admin")||message.toLowerCase().includes("session");
    return new Response(superjson.stringify({error:message}),{status:unauthorized?401:400});
  }
}