import { addPulseLead } from "../../../../packages/pulse-data";

export type LeadPayload={source:string;propertyId:string|null;name:string;phone:string;comment:string|null};
export async function postLead(payload:LeadPayload){
  addPulseLead(payload);
  await new Promise(r=>setTimeout(r,220));
  return {ok:true};
}
