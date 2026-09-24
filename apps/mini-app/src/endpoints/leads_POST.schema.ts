export type LeadPayload={source:string;propertyId:string|null;name:string;phone:string;comment:string|null};
export async function postLead(payload:LeadPayload){
  const stored=JSON.parse(localStorage.getItem("pulse_preview_leads")||"[]");
  stored.push({...payload,id:crypto.randomUUID(),createdAt:new Date().toISOString()});
  localStorage.setItem("pulse_preview_leads",JSON.stringify(stored));
  await new Promise(r=>setTimeout(r,350));
  return {ok:true};
}
