import { api } from "../../../packages/pulse-data/runtime";
import type { PulseProperty } from "../../../packages/pulse-data";

export type AdminCatalogPage={items:PulseProperty[];page:number;limit:number;total:number;hasMore:boolean};

const query=(input:Record<string,string|number|undefined>)=>{
  const params=new URLSearchParams();
  for(const [key,value] of Object.entries(input))if(value!==undefined&&value!=="")params.set(key,String(value));
  return params.toString();
};

export async function listAdminCatalog(input:{page:number;limit:number;q?:string;status?:"draft"|"published"|"archived"|"all"}){
  return api<AdminCatalogPage>("/control/catalog?"+query({...input,view:"card"}));
}

export async function getAdminProperty(id:string){
  return (await api<{property:PulseProperty}>("/control/catalog/"+encodeURIComponent(id))).property;
}

export async function createAdminProperty(property:PulseProperty){
  return (await api<{property:PulseProperty}>("/control/catalog",{method:"POST",body:JSON.stringify(property)})).property;
}

export async function saveAdminProperty(property:PulseProperty){
  return (await api<{property:PulseProperty}>("/control/catalog/"+encodeURIComponent(property.id),{method:"PUT",body:JSON.stringify(property)})).property;
}

export async function importAdminCatalog(
  properties:PulseProperty[],
  replace:{images:boolean;features:boolean;floorplans:boolean;documents:boolean}
){
  return api<{ok:true;total:number;created:number;updated:number}>("/control/catalog/import",{
    method:"POST",body:JSON.stringify({properties,replace})
  });
}

export async function uploadAdminMedia(
  propertyId:string,
  file:File,
  kind:"cover"|"gallery"|"floorplan"|"presentation"|"document",
  floorplanId?:string
){
  const params=new URLSearchParams({kind,filename:file.name});
  if(floorplanId)params.set("floorplanId",floorplanId);
  const response=await fetch("/api/v1/control/catalog/"+encodeURIComponent(propertyId)+"/media?"+params.toString(),{
    method:"POST",credentials:"same-origin",headers:{"Content-Type":file.type||"application/octet-stream"},body:file,
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||"Не удалось загрузить файл");
  return data.property as PulseProperty;
}

export async function deleteAdminMedia(
  propertyId:string,
  mediaId:string,
  kind:"gallery"|"presentation"|"document"|"floorplan"
){
  const response=await api<{ok:true;property:PulseProperty}>(
    "/control/catalog/"+encodeURIComponent(propertyId)+"/media/"+encodeURIComponent(mediaId)+"?kind="+kind,
    {method:"DELETE",body:"{}"}
  );
  return response.property;
}
