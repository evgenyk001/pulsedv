import superjson from "superjson";
import { listProperties } from "../helpers/propertyRepository";
import { OutputType } from "./properties_GET.schema";

export async function handle(){
  try{
    const properties=await listProperties(false);
    return new Response(superjson.stringify({properties} satisfies OutputType),{
      headers:{"Content-Type":"application/json"}
    });
  }catch(error){
    console.error("Properties load error",error);
    return new Response(superjson.stringify({error:"Не удалось загрузить объекты"}),{status:500});
  }
}