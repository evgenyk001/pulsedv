import superjson from "superjson";
import { db } from "../helpers/db";
import { schema, OutputType } from "./leads_POST.schema";
import { qualifyMortgage } from "../helpers/mortgageQualification";

export async function handle(request:Request){
  try{
    const input=schema.parse(superjson.parse(await request.text()));
    const qualification=input.purchaseType==="mortgage"?qualifyMortgage({citizenshipRf:input.citizenshipRf??null,borrowerAge:input.borrowerAge??null,maritalStatus:input.maritalStatus??null,spouseAge:input.spouseAge??null,childrenProfile:input.childrenProfile??null,priorPreferential:input.priorPreferentialMortgage??null,dvSpecialStatus:input.dvSpecialStatus??null}):{programs:[],note:input.purchaseType==="cash"?"Покупка за наличные":"Способ покупки уточнит менеджер"};
    const qualificationLabel=input.purchaseType==="cash"?"Наличные":input.purchaseType==="mortgage"?(qualification.programs.length>1?"Несколько сценариев":qualification.programs[0]||"Требует проверки"):"Требует уточнения";
    const row=await db.insertInto("leads").values({
      source:input.source,
      propertyId:input.propertyId||null,
      name:input.name,
      phone:input.phone,
      telegram:input.telegram||null,
      comment:input.comment||null,
      purchaseType:input.purchaseType,
      budgetMln:input.budgetMln??null,
      downPaymentMln:input.downPaymentMln??null,
      citizenshipRf:input.citizenshipRf??null,
      borrowerAge:input.borrowerAge??null,
      maritalStatus:input.maritalStatus??null,
      spouseAge:input.spouseAge??null,
      childrenProfile:input.childrenProfile??null,
      priorPreferentialMortgage:input.priorPreferentialMortgage??null,
      dvSpecialStatus:input.dvSpecialStatus??null,
      mortgagePrograms:input.mortgagePrograms??qualification.programs,
      qualificationLabel,
      qualificationNote:qualification.note,
      pipelineStatus:"new",
      status:"new",
    }).returning("id").executeTakeFirstOrThrow();
    return new Response(superjson.stringify({ok:true,id:String(row.id)} satisfies OutputType),{
      headers:{"Content-Type":"application/json"}
    });
  }catch(error){
    console.error("Lead create error",error);
    return new Response(superjson.stringify({error:"Не удалось сохранить заявку"}),{status:400});
  }
}