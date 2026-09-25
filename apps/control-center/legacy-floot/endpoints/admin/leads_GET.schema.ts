import superjson from "superjson";

export type AdminLead={
  id:string;
  name:string;
  phone:string;
  source:string;
  propertyId:string|null;
  propertyName:string|null;
  status:string;
  createdAt:Date;
  purchaseType:string|null;
  budgetMln:number|null;
  downPaymentMln:number|null;
  mortgagePrograms:string[];
  borrowerAge:number|null;
  maritalStatus:string|null;
  childrenProfile:string|null;
  priorPreferentialMortgage:string|null;
  pipelineStatus:string;
  qualificationLabel:string|null;
  qualificationNote:string|null;
  citizenshipRf:boolean|null;
  spouseAge:number|null;
  dvSpecialStatus:string|null;
  history:Array<{id:string;eventType:string;fromStatus:string|null;toStatus:string|null;note:string|null;createdAt:Date}>;
};
export type OutputType={leads:AdminLead[]};

export async function getAdminLeads(init?:RequestInit):Promise<OutputType>{
  const response=await fetch("/_api/admin/leads",{method:"GET",credentials:"include",...init});
  if(!response.ok){
    const payload=superjson.parse<{error?:string}>(await response.text());
    throw new Error(payload.error||"Не удалось загрузить заявки");
  }
  return superjson.parse<OutputType>(await response.text());
}