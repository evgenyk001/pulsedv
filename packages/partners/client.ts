import {api,visitorApi,runtime} from '../pulse-data/runtime';
import {listPulseLeads} from '../pulse-data';
import {claimExpiresOn,claimDateError,claimMonths} from './policy';
import {businessDay} from '../pulse-data/business';
import {PARTNER_TERMS_VERSION,partnerReward,partnerRejectReasons,partnerStageLabels,publicClientName,normalizePartnerPhone,type Partner,type PartnerInvite,type PartnerReferral,type PartnerReward,type PartnerCabinet,type PartnerRejectReason} from './model';
type LocalReferral=PartnerReferral&{phone:string;lastStage:string;lastReceivedOn:string|null;attributionCode:string};
type Store={myPartnerId:string|null;partners:Partner[];invitations:PartnerInvite[];referrals:LocalReferral[];rewards:PartnerReward[]};
export type ControlPartners={securityAttempts?:Array<{id:string;reason:string;createdAt:string;partnerName:string|null}>;reservationPage?:number;reservationTotal?:number;reservationHasMore?:boolean;counts?:{total:number;pending:number;requested:number;conflicts:number};reservations?:Array<import('./model').PartnerReservation&{partnerName:string;phone:string}>;partners:Partner[];referrals:PartnerReferral[];page:number;total:number;hasMore:boolean};
const KEY='pulse.partners.v1',EVENT='pulse:partners',ATTRIBUTION='pulse.partner-invitation.v1';
const uid=()=>crypto.randomUUID(),now=()=>new Date().toISOString();
function read():Store{try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s&&Array.isArray(s.partners)&&Array.isArray(s.invitations)&&Array.isArray(s.referrals)&&Array.isArray(s.rewards))return s}catch{}return {myPartnerId:null,partners:[],invitations:[],referrals:[],rewards:[]}}
function write(s:Store){localStorage.setItem(KEY,JSON.stringify(s));window.dispatchEvent(new Event(EVENT))}
const event=(r:LocalReferral,kind:string,label:string)=>r.events.push({id:uid(),referralId:r.id,kind,label,createdAt:now()});
function sync(s:Store){let changed=false;for(const r of s.referrals){const l=listPulseLeads().find(l=>l.id===r.leadId);if(!l||r.status!=='accepted')continue;if(['deal','closed'].includes(l.status)&&!r.dealConfirmedOn){r.dealConfirmedOn=businessDay();changed=true}if(r.lastStage!==l.status){r.lastStage=l.status;event(r,'stage',partnerStageLabels[l.status]||'Статус обновлён');changed=true}if(r.lastReceivedOn!==l.finance?.receivedOn&&l.finance?.receivedOn){r.lastReceivedOn=l.finance.receivedOn;event(r,'commission','Комиссия получена агентством. Вознаграждение ожидает проверки');changed=true}}if(changed)write(s);return s}
function clash(s:Store,r:LocalReferral){return listPulseLeads().filter(l=>l.id!==r.leadId&&normalizePartnerPhone(l.phone)===r.phone&&(l.createdAt<r.createdAt||s.referrals.some(x=>x.leadId===l.id&&x.status==='accepted'))&&!s.referrals.some(x=>x.leadId===l.id&&x.status==='rejected'&&x.rejectionReason==='unconfirmed'))}
function dto(s:Store,r:LocalReferral,privateView:boolean):PartnerReferral{
 const l=listPulseLeads().find(l=>l.id===r.leadId),matches=privateView?clash(s,r):[];
 const w=[...s.rewards].reverse().filter(w=>w.referralId===r.id),reward=w.find(w=>w.status!=='void')??w[0]??null;
 return {id:r.id,partnerId:r.partnerId,partnerName:r.partnerName,leadId:privateView?r.leadId:null,invitationId:r.invitationId,clientName:privateView?l?.name||r.clientName:publicClientName(l?.name||r.clientName),...(privateView?{clientPhone:l?.phone,reviewNote:r.reviewNote,conflictLeads:matches.map(l=>({id:l.id,label:l.name+' · '+l.phone})),conflictDetails:matches.map(l=>l.name+' · '+l.phone).join('\n')}:{ }),termsVersion:r.termsVersion,claimStartedOn:r.claimStartedOn,claimExpiresOn:r.claimExpiresOn,dealConfirmedOn:r.dealConfirmedOn,status:r.status,stage:l?.status||r.stage,stageLabel:partnerStageLabels[l?.status||r.stage]||'Обращение',conflict:matches.length>0,rejectionReason:r.rejectionReason,revision:r.revision,createdAt:r.createdAt,acceptedAt:r.acceptedAt,events:r.events,reward:reward?{...reward,...(!privateView?{payoutReference:undefined,documentReference:undefined}:{})}:null};
}
export function subscribePartners(fn:()=>void){const storage=(e:StorageEvent)=>{if(e.key===null||e.key===KEY||e.key===ATTRIBUTION||e.key==='pulse.dv.control.leads.v1')fn()};window.addEventListener(EVENT,fn);window.addEventListener('storage',storage);window.addEventListener('pulse:control-leads',fn);return()=>{window.removeEventListener(EVENT,fn);window.removeEventListener('storage',storage);window.removeEventListener('pulse:control-leads',fn)}}
export async function getPartnerCabinet(page=1,filter='all'):Promise<PartnerCabinet>{
 if(runtime.enabled){const cabinet=await visitorApi<PartnerCabinet>('/me/partner?page='+page+'&filter='+filter);const invite=rememberedPartnerInvite();if(invite&&cabinet.partner&&(cabinet.partner.code===invite.code||cabinet.invitations.some(i=>i.code===invite.code)||cabinet.reservations?.some(i=>i.code===invite.code)))clearPartnerInvite();return cabinet;}
 const s=sync(read()),partner=s.partners.find(p=>p.id===s.myPartnerId)??null,all=s.referrals.filter(r=>r.partnerId===partner?.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),limit=30;
 const rewards=s.rewards.filter(w=>all.some(r=>r.id===w.referralId));
 const filtered=filter==='payments'?all.filter(r=>s.rewards.some(w=>w.referralId===r.id)):all;
 return {authenticated:true,partner,referrals:filtered.slice((page-1)*limit,page*limit).map(r=>dto(s,r,false)),invitations:s.invitations.filter(i=>i.partnerId===partner?.id).slice(-30).reverse().map(i=>({...i,submitted:s.referrals.some(r=>r.invitationId===i.id)})),page,total:filtered.length,hasMore:filtered.length>page*limit,summary:{accruedMinor:rewards.filter(w=>['accrued','requested'].includes(w.status)).reduce((a,w)=>a+w.grossMinor,0),paidMinor:rewards.filter(w=>w.status==='paid').reduce((a,w)=>a+w.paidMinor,0),pendingCount:all.filter(r=>r.status==='pending').length,acceptedCount:all.filter(r=>r.status==='accepted').length}};
}
export async function joinPartner(input:{name:string;phone:string;consent:boolean;termsVersion:string}){
 if(runtime.enabled)return visitorApi('/me/partner/join',{method:'POST',body:JSON.stringify(input)});
 if(!input.consent||input.termsVersion!==PARTNER_TERMS_VERSION)throw new Error('Примите актуальные условия программы');
 const phone=normalizePartnerPhone(input.phone);if(input.name.trim().length<2||!/^\+[1-9]\d{9,14}$/.test(phone))throw new Error('Укажите имя и телефон');
 const s=read();if(s.myPartnerId)return {partner:s.partners.find(p=>p.id===s.myPartnerId)!};
 const p:Partner={id:uid(),userId:null,name:input.name.trim(),phone,code:'p'+uid().replaceAll('-',''),status:'active',termsVersion:input.termsVersion,termsAcceptedAt:now(),createdAt:now()};s.myPartnerId=p.id;s.partners.push(p);write(s);return {partner:p};
}
export async function acceptPartnerTerms(input:{consent:boolean;termsVersion:string}){
 if(runtime.enabled)return visitorApi('/me/partner/terms',{method:'POST',body:JSON.stringify(input)});
 if(!input.consent||input.termsVersion!==PARTNER_TERMS_VERSION)throw new Error('Примите актуальные условия');const s=read(),p=s.partners.find(p=>p.id===s.myPartnerId);if(!p)throw new Error('Партнёр не найден');p.termsVersion=input.termsVersion;p.termsAcceptedAt=now();write(s);return {ok:true};
}
export async function getPublicPartnerInvite(code:string):Promise<{partnerName:string;code:string;termsVersion:string;isOwn?:boolean}>{
 if(runtime.enabled)return api('/public/partner-invites/'+encodeURIComponent(code));
 const s=read(),invite=s.invitations.find(i=>i.code===code),p=s.partners.find(p=>p.code===code||p.id===invite?.partnerId);if(!p||p.status!=='active'||p.termsVersion!==PARTNER_TERMS_VERSION)throw new Error('Приглашение недоступно. Демоссылка работает в том же браузере');return {partnerName:p.name,code,termsVersion:PARTNER_TERMS_VERSION,isOwn:p.id===s.myPartnerId};
}
export async function createPartnerInvite(input:{label:string;idempotencyKey:string}){
 if(runtime.enabled)return visitorApi<{invitation:PartnerInvite}>('/me/partner/invitations',{method:'POST',body:JSON.stringify(input)});
 const s=read(),p=s.partners.find(p=>p.id===s.myPartnerId);if(!p||p.status!=='active'||p.termsVersion!==PARTNER_TERMS_VERSION)throw new Error('Приглашения недоступны');if(input.label.trim().length<2)throw new Error('Назовите приглашение');
 const old=s.invitations.find(i=>i.id===input.idempotencyKey);if(old){if(old.partnerId!==p.id||old.label!==input.label.trim())throw new Error('Ключ приглашения уже использован');return {invitation:old};}
 const invite:PartnerInvite={id:input.idempotencyKey,partnerId:p.id,code:'i'+uid().replaceAll('-',''),label:input.label.trim(),createdAt:now()};s.invitations.push(invite);write(s);return {invitation:invite};
}
function ownLocalInvite(code:string){const s=read();return !!s.myPartnerId&&(s.partners.some(p=>p.id===s.myPartnerId&&p.code===code)||s.invitations.some(i=>i.partnerId===s.myPartnerId&&i.code===code));}
export function rememberPartnerInvite(input:{code:string;partnerName:string}){if(!runtime.enabled&&ownLocalInvite(input.code))return;localStorage.setItem(ATTRIBUTION,JSON.stringify({...input,expiresAt:Date.now()+7*86400000}));window.dispatchEvent(new Event(EVENT))}
export function rememberedPartnerInvite():{code:string;partnerName:string}|null{try{const v=JSON.parse(localStorage.getItem(ATTRIBUTION)||sessionStorage.getItem(ATTRIBUTION)||'null');if(!v||typeof v.code!=='string'||! /^[a-zA-Z0-9_-]{12,64}$/.test(v.code)||typeof v.partnerName!=='string'||typeof v.expiresAt!=='number'||!Number.isFinite(v.expiresAt)||v.expiresAt<=Date.now())return null;if(!runtime.enabled&&ownLocalInvite(v.code)){localStorage.removeItem(ATTRIBUTION);sessionStorage.removeItem(ATTRIBUTION);return null}return v}catch{return null}}
export function clearPartnerInvite(){sessionStorage.removeItem(ATTRIBUTION);localStorage.removeItem(ATTRIBUTION);window.dispatchEvent(new Event(EVENT))}
export function validateLocalPartnerInvite(code:string,phone:string,excludeLeadId?:string){const s=read(),i=s.invitations.find(i=>i.code===code),p=s.partners.find(p=>p.code===code||p.id===i?.partnerId);if(!p||p.status!=='active'||p.termsVersion!==PARTNER_TERMS_VERSION)throw new Error('Приглашение недоступно');if(p.phone===normalizePartnerPhone(phone))throw new Error('Собственная покупка не участвует в программе');const normalized=normalizePartnerPhone(phone),unconfirmed=(id:string)=>s.referrals.some(r=>r.leadId===id&&r.status==='rejected'&&r.rejectionReason==='unconfirmed');if(listPulseLeads().some(l=>l.id!==excludeLeadId&&normalizePartnerPhone(l.phone)===normalized&&!unconfirmed(l.id))||s.referrals.some(r=>r.leadId!==excludeLeadId&&r.phone===normalized&&!(r.status==='rejected'&&r.rejectionReason==='unconfirmed')))throw new Error('Клиент не уникальный или уже закреплён. Можно отправить обычную заявку без новой рекомендации');return {p,i};}
export function recordLocalPartnerReferral(leadId:string,phone:string,code:string){
 const s=read(),{p,i}=validateLocalPartnerInvite(code,phone,leadId);if(s.referrals.some(r=>r.leadId===leadId))return;
 const l=listPulseLeads().find(l=>l.id===leadId);if(!l)throw new Error('Обращение не найдено');
 const r:LocalReferral={id:uid(),partnerId:p.id,partnerName:p.name,leadId,invitationId:i?.id??null,clientName:l.name,termsVersion:p.termsVersion,status:'pending',stage:l.status,stageLabel:partnerStageLabels[l.status],conflict:false,rejectionReason:null,revision:1,createdAt:now(),acceptedAt:null,events:[],reward:null,phone:normalizePartnerPhone(phone),lastStage:l.status,lastReceivedOn:null,attributionCode:code};event(r,'submitted','Покупатель подтвердил рекомендацию. Проверяем уникальность');s.referrals.push(r);write(s);
}
export async function getControlPartners(page=1,filter='all',reservationPage=1):Promise<ControlPartners>{
 if(runtime.enabled)return api('/control/partners?page='+page+'&filter='+filter+'&reservationPage='+reservationPage);
 const s=sync(read()),whole=[...s.referrals],all=whole.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).filter(r=>filter==='all'||filter==='pending'&&r.status==='pending'||filter==='payouts'&&s.rewards.some(w=>w.referralId===r.id&&['accrued','requested'].includes(w.status))||filter==='conflicts'&&clash(s,r).length>0);return {counts:{total:whole.length,pending:whole.filter(r=>r.status==='pending').length,requested:whole.filter(r=>s.rewards.some(w=>w.referralId===r.id&&w.status==='requested')).length,conflicts:whole.filter(r=>clash(s,r).length).length},partners:s.partners,referrals:all.slice((page-1)*30,page*30).map(r=>dto(s,r,true)),page,total:all.length,hasMore:all.length>page*30};
}
export async function getControlPartnerReferral(id:string){if(runtime.enabled)return api<{referral:PartnerReferral}>('/control/partner-referrals/'+encodeURIComponent(id));const s=sync(read()),r=s.referrals.find(r=>r.id===id);if(!r)throw new Error('Рекомендация не найдена');return {referral:dto(s,r,true)};}
export async function getLeadPartner(leadId:string){if(runtime.enabled)return api<{referral:PartnerReferral|null}>('/control/leads/'+encodeURIComponent(leadId)+'/partner');const s=sync(read()),r=s.referrals.find(r=>r.leadId===leadId);return {referral:r?dto(s,r,true):null};}
export async function reviewPartnerReferral(id:string,input:{revision:number;decision:'accept'|'reject';contactConfirmed:boolean;note:string;reason?:PartnerRejectReason;riskAcknowledged?:boolean;riskFingerprint?:string}){
 if(runtime.enabled)return api('/control/partner-referrals/'+id+'/review',{method:'POST',body:JSON.stringify(input)});
 const s=read(),r=s.referrals.find(r=>r.id===id);if(!r||r.status!=='pending'||r.revision!==input.revision)throw new Error('Рекомендация уже рассмотрена');if(input.note.trim().length<2)throw new Error('Укажите результат проверки');
 if(input.decision==='accept'){if(!input.contactConfirmed)throw new Error('Подтвердите контакт с покупателем');if(clash(s,r).length)throw new Error('Есть совпадение в CRM или более ранняя рекомендация');r.status='accepted';r.acceptedAt=now();if(r.termsVersion&&claimMonths(r.termsVersion)){r.claimStartedOn=businessDay();r.claimExpiresOn=claimExpiresOn(r.claimStartedOn,claimMonths(r.termsVersion));}event(r,'accepted','Клиент проверен и закреплён за партнёром');event(r,'stage',partnerStageLabels[r.stage]);}
 else{if(!input.reason)throw new Error('Укажите причину отказа');r.status='rejected';r.rejectionReason=input.reason;event(r,'rejected',partnerRejectReasons[input.reason]);}r.reviewNote=input.note;r.revision++;write(s);return {ok:true};
}
export async function accruePartnerReward(id:string,revision:number,dealOn?:string){
 if(runtime.enabled)return api('/control/partner-referrals/'+id+'/accrue',{method:'POST',body:JSON.stringify({revision,...(dealOn?{dealOn}:{})})});
 const s=sync(read()),r=s.referrals.find(r=>r.id===id);if(!r||r.revision!==revision||r.status!=='accepted')throw new Error('Подтвердите закрепление');const old=s.rewards.find(w=>w.referralId===id&&w.status!=='void');if(old)return {ok:true,reward:old};
 const l=listPulseLeads().find(l=>l.id===r.leadId);if(!l||!['deal','closed'].includes(l.status)||!l.finance?.receivedOn||!l.finance?.commissionRub||l.finance.receivedOn>businessDay())throw new Error('Укажите завершённую сделку и полученную комиссию в карточке клиента');
 const actual=dealOn||r.dealConfirmedOn||businessDay(),error=claimDateError(r.claimStartedOn,r.claimExpiresOn,actual);if(error)throw new Error(error);r.dealConfirmedOn=actual;
 const w:PartnerReward={id:uid(),referralId:id,dealOn:actual,...partnerReward(l.finance.commissionRub),receivedOn:l.finance.receivedOn,status:'accrued',recipientType:null,requestedAt:null,paidOn:null,withheldMinor:0,paidMinor:0,revision:1,createdAt:now()};s.rewards.push(w);event(r,'accrued','Вознаграждение начислено после проверки полученной комиссии');write(s);return {ok:true,reward:w};
}
export async function requestPartnerPayout(id:string,recipientType:string){
 if(runtime.enabled)return visitorApi('/me/partner/rewards/'+id+'/request',{method:'POST',body:JSON.stringify({recipientType})});
 const s=read(),w=s.rewards.find(w=>w.id===id),r=s.referrals.find(r=>r.id===w?.referralId);if(!w||r?.partnerId!==s.myPartnerId)throw new Error('Начисление не найдено');if(w.status==='requested')return {ok:true};if(w.status!=='accrued')throw new Error('Начисление недоступно');w.status='requested';w.recipientType=recipientType;w.requestedAt=now();w.revision++;event(r,'payout_requested','Партнёр запросил оформление выплаты');write(s);return {ok:true};
}
export async function payPartnerReward(id:string,input:{revision:number;withheldMinor:number;paidOn:string;payoutReference:string;documentReference:string;documentsChecked:boolean}){
 if(runtime.enabled)return api('/control/partner-rewards/'+id+'/pay',{method:'POST',body:JSON.stringify(input)});
 const s=read(),w=s.rewards.find(w=>w.id===id);if(!w||w.revision!==input.revision||!['accrued','requested'].includes(w.status))throw new Error('Начисление уже изменилось');if(!input.documentsChecked||input.payoutReference.trim().length<3||input.documentReference.trim().length<3||!input.paidOn||input.paidOn>businessDay()||!Number.isSafeInteger(input.withheldMinor)||input.withheldMinor<0||input.withheldMinor>w.grossMinor)throw new Error('Проверьте документы, сумму удержаний и фактическую выплату');Object.assign(w,input,{status:'paid',paidMinor:w.grossMinor-input.withheldMinor,revision:w.revision+1});const r=s.referrals.find(r=>r.id===w.referralId)!;event(r,'paid','Выплата подтверждена агентством');write(s);return {ok:true};
}
export async function voidPartnerReward(id:string,revision:number,reason:string){if(runtime.enabled)return api('/control/partner-rewards/'+id+'/void',{method:'POST',body:JSON.stringify({revision,reason})});const s=read(),w=s.rewards.find(w=>w.id===id);if(!w||w.revision!==revision||!['accrued','requested'].includes(w.status))throw new Error('Оплаченное начисление нельзя отменить');if(reason.trim().length<5)throw new Error('Укажите причину отмены');w.status='void';w.revision++;event(s.referrals.find(r=>r.id===w.referralId)!,'void','Неоплаченное начисление отменено агентством');write(s);return {ok:true};}
export async function changePartnerStatus(id:string,status:Partner['status']){if(runtime.enabled)return api('/control/partners/'+id,{method:'PATCH',body:JSON.stringify({status})});const s=read(),p=s.partners.find(p=>p.id===id);if(!p)throw new Error('Партнёр не найден');p.status=status;write(s);return {ok:true};}
export function demoPartnerPaid(from:string,to:string){return read().rewards.filter(w=>w.status==='paid'&&w.paidOn&&w.paidOn>=from&&w.paidOn<=to).reduce((a,w)=>a+w.grossMinor/100,0)}

export async function reservePartnerClient(input:{phone:string;label:string;contactConsent:boolean;idempotencyKey:string}):Promise<import('./model').ReservationResult>{
 if(!runtime.enabled)throw new Error('Автоматическая проверка всей CRM станет доступна после подключения общей базы. Демо не проверяет других пользователей');
 return visitorApi('/me/partner/reservations',{method:'POST',body:JSON.stringify(input)});
}

export async function releasePartnerReservation(id:string,reason:string){return api('/control/partner-reservations/'+encodeURIComponent(id)+'/release',{method:'POST',body:JSON.stringify({reason})});}

export async function reviewPartnerRisk(id:string,input:{revision:number;contactConfirmed:true;riskAcknowledged:boolean;riskFingerprint:string;note:string}){if(!runtime.enabled)throw new Error('Проверка устройств доступна после подключения сервера');return api('/control/partner-referrals/'+id+'/risk-review',{method:'POST',body:JSON.stringify(input)});}
