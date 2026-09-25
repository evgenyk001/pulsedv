import { addPulseLead } from '../../../../packages/pulse-data';
import { createRemoteLead, runtime } from '../../../../packages/pulse-data/runtime';
export type LeadPayload={source:string;propertyId:string|null;name:string;phone:string;comment:string|null;idempotencyKey:string};
export async function postLead(payload:LeadPayload){
 const phone=payload.phone.replace(/[^\d+]/g,'').replace(/^8(?=\d{10}$)/,'+7').replace(/^7(?=\d{10}$)/,'+7');
 if(payload.name.trim().length<2)throw new Error('Укажите имя');
 if(!/^\+[1-9]\d{9,14}$/.test(phone))throw new Error('Проверьте номер телефона');
 if(runtime.enabled)return createRemoteLead({...payload,name:payload.name.trim(),phone});
 const {idempotencyKey,...input}=payload;addPulseLead({...input,name:payload.name.trim(),phone});return {ok:true,preview:true};
}
