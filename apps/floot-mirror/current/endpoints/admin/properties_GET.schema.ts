import superjson from "superjson";
import { PropertyRecord } from "../../helpers/propertyTypes";

export type OutputType={properties:PropertyRecord[]};
export async function getAdminProperties(init?:RequestInit):Promise<OutputType>{
  const response=await fetch("/_api/admin/properties",{method:"GET",credentials:"include",...init});
  if(!response.ok){
    const body=superjson.parse<{error?:string}>(await response.text());
    throw new Error(body.error||"Не удалось загрузить объекты");
  }
  return superjson.parse<OutputType>(await response.text());
}