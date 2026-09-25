import { z } from "zod";
import superjson from "superjson";

export const pipelineStatuses=["new","qualified","selection_sent","interested","meeting","booking","deal","lost"] as const;
export const schema=z.object({
  leadId:z.string().regex(/^\d+$/),
  status:z.enum(pipelineStatuses),
  note:z.string().max(1000).nullable().optional(),
});
export type InputType=z.infer<typeof schema>;
export type OutputType={ok:true;leadId:string;status:InputType["status"]};

export async function postLeadPipeline(body:InputType,init?:RequestInit):Promise<OutputType>{
  const validated=schema.parse(body);
  const response=await fetch("/_api/admin/lead_pipeline",{
    method:"POST",
    credentials:"include",
    body:superjson.stringify(validated),
    ...init,
    headers:{"Content-Type":"application/json",...(init?.headers??{})},
  });
  if(!response.ok){
    const payload=superjson.parse<{error?:string}>(await response.text());
    throw new Error(payload.error||"Не удалось обновить этап");
  }
  return superjson.parse<OutputType>(await response.text());
}