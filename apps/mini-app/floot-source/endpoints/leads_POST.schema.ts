import { z } from "zod";
import superjson from "superjson";

export const schema=z.object({
  source:z.string().min(1).max(80).default("app"),
  propertyId:z.string().max(80).nullable().optional(),
  name:z.string().min(2).max(120),
  phone:z.string().min(5).max(40),
  telegram:z.string().max(120).nullable().optional(),
  comment:z.string().max(1200).nullable().optional(),
  purchaseType:z.enum(["cash","mortgage"]).nullable().optional(),
  budgetMln:z.number().positive().max(500).nullable().optional(),
  downPaymentMln:z.number().nonnegative().max(500).nullable().optional(),
  citizenshipRf:z.boolean().nullable().optional(),
  borrowerAge:z.number().int().min(18).max(100).nullable().optional(),
  maritalStatus:z.enum(["married","single"]).nullable().optional(),
  spouseAge:z.number().int().min(18).max(100).nullable().optional(),
  childrenProfile:z.enum(["none","under7","two_minors","disabled_child","minor_7_18"]).nullable().optional(),
  priorPreferentialMortgage:z.enum(["no","yes","unsure"]).nullable().optional(),
  dvSpecialStatus:z.enum(["none","teacher_doctor","hectare","mobility","other"]).nullable().optional(),
  mortgagePrograms:z.array(z.string().min(1).max(80)).max(6).optional(),
});
export type InputType=z.infer<typeof schema>;
export type OutputType={ok:true;id:string};

export async function postLead(body:InputType,init?:RequestInit):Promise<OutputType>{
  const validated=schema.parse(body);
  const response=await fetch("/_api/leads",{
    method:"POST",
    body:superjson.stringify(validated),
    ...init,
    headers:{"Content-Type":"application/json",...(init?.headers??{})},
  });
  if(!response.ok){
    const payload=superjson.parse<{error?:string}>(await response.text());
    throw new Error(payload.error||"Не удалось отправить заявку");
  }
  return superjson.parse<OutputType>(await response.text());
}