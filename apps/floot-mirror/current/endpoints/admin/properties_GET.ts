import superjson from "superjson";
import { requireAdmin } from "../../helpers/requireAdmin";
import { listProperties } from "../../helpers/propertyRepository";
import { OutputType } from "./properties_GET.schema";

export async function handle(request:Request){
  try{
    await requireAdmin(request);
    const properties=await listProperties(true);
    return new Response(superjson.stringify({properties} satisfies OutputType),{
      headers:{"Content-Type":"application/json"}
    });
  }catch(error){
    return new Response(superjson.stringify({error:error instanceof Error?error.message:"Access denied"}),{status:401});
  }
}