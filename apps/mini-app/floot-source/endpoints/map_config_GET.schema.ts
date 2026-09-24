import superjson from "superjson";

export type OutputType={provider:"2gis";key:string};

export async function getMapConfig(init?:RequestInit):Promise<OutputType>{
  const response=await fetch("/_api/map_config",{method:"GET",...init});
  if(!response.ok){
    const payload=superjson.parse<{error?:string}>(await response.text());
    throw new Error(payload.error||"Карта 2ГИС пока не настроена");
  }
  return superjson.parse<OutputType>(await response.text());
}