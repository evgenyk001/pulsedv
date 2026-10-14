import {clearPartnerInvite,validateLocalPartnerInvite,recordLocalPartnerReferral} from "../../../../packages/partners/client";
import { addPulseLead } from '../../../../packages/pulse-data';
import { createRemoteLead, runtime } from '../../../../packages/pulse-data/runtime';
export type LeadPayload={source:string;propertyId:string|null;name:string;phone:string;comment:string|null;context?:Record<string,unknown>;idempotencyKey:string;consent:boolean;referralCode?:string;referralConsent?:boolean};
export async function postLead(payload:LeadPayload){
 const phone=payload.phone.replace(/[^\d+]/g,'').replace(/^8(?=\d{10}$)/,'+7').replace(/^7(?=\d{10}$)/,'+7');
 if(payload.name.trim().length<2)throw new Error('Укажите имя');
 if(!payload.consent)throw new Error('Нужно согласие на обработку персональных данных');
 if(!/^\+[1-9]\d{9,14}$/.test(phone))throw new Error('Проверьте номер телефона');
 if(payload.referralCode&&!payload.referralConsent)throw new Error("Подтвердите рекомендацию");
 if(runtime.enabled){const result=await createRemoteLead({...payload,name:payload.name.trim(),phone});clearPartnerInvite();return result;}
 if(payload.referralCode)validateLocalPartnerInvite(payload.referralCode,phone);
 const {idempotencyKey,context,referralCode,referralConsent,...input}=payload;const lead=addPulseLead({...input,requestContext:context??{},name:payload.name.trim(),phone,source:referralCode?"partner":input.source});if(referralCode)recordLocalPartnerReferral(lead.id,phone,referralCode);clearPartnerInvite();return {ok:true,preview:true,id:lead.id};
}
