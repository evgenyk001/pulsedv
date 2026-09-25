import { upload } from "@floot/storage";
import superjson from "superjson";
import { schema, OutputType } from "./property_upload_POST.schema";
import { requireAdmin } from "../../helpers/requireAdmin";

const safeName=(value:string)=>value.toLowerCase().replace(/[^a-z0-9._-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80)||"image.jpg";

export async function handle(request:Request){
  try{
    await requireAdmin(request);
    const input=schema.parse(superjson.parse(await request.text()));
    const filename=`properties/${input.propertyId}/${Date.now()}-${safeName(input.fileName)}`;
    const result=await upload({
      visibility:"public",
      filename,
      contentType:input.contentType,
      sizeBytes:input.sizeBytes,
    });
    if(!result.ok)throw new Error(result.error.message);
    return new Response(superjson.stringify({
      presignedUrl:result.presignedUrl,
      url:result.url,
      filename,
    } satisfies OutputType),{headers:{"Content-Type":"application/json"}});
  }catch(error){
    console.error("Property upload prepare error",error);
    return new Response(superjson.stringify({error:error instanceof Error?error.message:"Upload failed"}),{status:400});
  }
}