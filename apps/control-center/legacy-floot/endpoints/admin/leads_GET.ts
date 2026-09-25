import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireAdmin } from "../../helpers/requireAdmin";
import { OutputType } from "./leads_GET.schema";

export async function handle(request:Request){
  try{
    await requireAdmin(request);
    const [rows,historyRows]=await Promise.all([
      db.selectFrom("leads")
        .leftJoin("properties","leads.propertyId","properties.id")
        .select([
          "leads.id",
          "leads.name",
          "leads.phone",
          "leads.source",
          "leads.propertyId",
          "leads.status",
          "leads.createdAt",
          "leads.purchaseType",
          "leads.budgetMln",
          "leads.downPaymentMln",
          "leads.mortgagePrograms",
          "leads.borrowerAge",
          "leads.maritalStatus",
          "leads.childrenProfile",
          "leads.priorPreferentialMortgage",
          "leads.pipelineStatus",
          "leads.qualificationLabel",
          "leads.qualificationNote",
          "leads.citizenshipRf",
          "leads.spouseAge",
          "leads.dvSpecialStatus",
          "properties.name as propertyName",
        ])
        .orderBy("leads.createdAt","desc")
        .limit(100)
        .execute(),
      db.selectFrom("leadHistory")
        .select(["id","leadId","eventType","fromStatus","toStatus","note","createdAt"])
        .orderBy("createdAt","desc")
        .limit(500)
        .execute(),
    ]);

    const historyByLead=new Map<string,OutputType["leads"][number]["history"]>();
    historyRows.forEach(row=>{
      const key=String(row.leadId);
      const list=historyByLead.get(key)??[];
      list.push({
        id:String(row.id),
        eventType:row.eventType,
        fromStatus:row.fromStatus,
        toStatus:row.toStatus,
        note:row.note,
        createdAt:new Date(row.createdAt),
      });
      historyByLead.set(key,list);
    });

    const leads=rows.map(row=>({
      id:String(row.id),
      name:row.name,
      phone:row.phone,
      source:row.source,
      propertyId:row.propertyId,
      propertyName:row.propertyName??null,
      status:row.status,
      createdAt:new Date(row.createdAt),
      purchaseType:row.purchaseType,
      budgetMln:row.budgetMln===null?null:Number(row.budgetMln),
      downPaymentMln:row.downPaymentMln===null?null:Number(row.downPaymentMln),
      mortgagePrograms:row.mortgagePrograms,
      borrowerAge:row.borrowerAge,
      maritalStatus:row.maritalStatus,
      childrenProfile:row.childrenProfile,
      priorPreferentialMortgage:row.priorPreferentialMortgage,
      pipelineStatus:row.pipelineStatus,
      qualificationLabel:row.qualificationLabel,
      qualificationNote:row.qualificationNote,
      citizenshipRf:row.citizenshipRf,
      spouseAge:row.spouseAge,
      dvSpecialStatus:row.dvSpecialStatus,
      history:historyByLead.get(String(row.id))??[],
    }));

    return new Response(superjson.stringify({leads} satisfies OutputType),{headers:{"Content-Type":"application/json"}});
  }catch(error){
    return new Response(superjson.stringify({error:error instanceof Error?error.message:"Access denied"}),{status:401});
  }
}