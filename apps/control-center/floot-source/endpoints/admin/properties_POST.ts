import superjson from "superjson";
import { schema, OutputType } from "./properties_POST.schema";
import { requireAdmin } from "../../helpers/requireAdmin";
import { listProperties, saveProperty } from "../../helpers/propertyRepository";

export async function handle(request:Request){
  try{
    await requireAdmin(request);
    const input=schema.parse(superjson.parse(await request.text()));
    await saveProperty(input);
    const property=(await listProperties(true)).find(x=>x.id===input.id);
    if(!property)throw new Error("Object was saved but could not be reloaded");
    return new Response(superjson.stringify({property} satisfies OutputType),{
      headers:{"Content-Type":"application/json"}
    });
  }catch(error){
    console.error("Admin property save error",error);
    const message=error instanceof Error?error.message:"Не удалось сохранить объект";
    const unauthorized=message.toLowerCase().includes("admin")||message.toLowerCase().includes("session");
    return new Response(superjson.stringify({error:message}),{status:unauthorized?401:400});
  }
}