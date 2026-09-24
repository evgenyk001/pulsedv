import superjson from "superjson";
import { OutputType } from "./map_config_GET.schema";

export async function handle(){
  const key=(process.env as Record<string,string|undefined>).DGIS_MAPGL_KEY;
  if(!key){
    return new Response(superjson.stringify({error:"2GIS MapGL key is not connected"}),{status:503});
  }
  return new Response(superjson.stringify({provider:"2gis",key} satisfies OutputType),{
    headers:{"Content-Type":"application/json","Cache-Control":"private, max-age=300"},
  });
}