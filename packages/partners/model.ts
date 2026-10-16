import {OFFER_VERSION} from './offer';
export const PARTNER_TERMS_VERSION=OFFER_VERSION;
export const PARTNER_REWARD_BPS=3000;
export const PARTNER_RESERVE_BPS=600;
export type PartnerStatus='active'|'paused';
export type ReferralStatus='pending'|'accepted'|'rejected';
export type RewardStatus='accrued'|'requested'|'paid'|'void';
export type Partner={id:string;userId:string|null;name:string;phone:string;code:string;status:PartnerStatus;termsVersion:string;termsAcceptedAt?:string;createdAt:string};
export type PartnerInvite={id:string;partnerId:string;code:string;label:string;createdAt:string;submitted?:boolean};
export type PartnerEvent={id:string;referralId:string;kind:string;label:string;createdAt:string};
export type PartnerReward={id:string;referralId:string;commissionRub:number;receivedOn?:string;dealOn?:string|null;reserveMinor:number;baseMinor:number;grossMinor:number;status:RewardStatus;recipientType:string|null;requestedAt:string|null;paidOn:string|null;withheldMinor:number;paidMinor:number;payoutReference?:string|null;documentReference?:string|null;revision:number;createdAt:string};
export type PartnerReferral={id:string;partnerId:string;partnerName:string;leadId:string|null;invitationId:string|null;clientName:string;clientPhone?:string;status:ReferralStatus;stage:string;stageLabel:string;conflict:boolean;conflictDetails?:string;conflictLeads?:Array<{id:string;label:string}>;reviewNote?:string;rejectionReason:string|null;revision:number;createdAt:string;acceptedAt:string|null;termsVersion?:string;claimStartedOn?:string|null;claimExpiresOn?:string|null;dealConfirmedOn?:string|null;events:PartnerEvent[];reward:PartnerReward|null};
export type PartnerSummary={accruedMinor:number;paidMinor:number;pendingCount:number;acceptedCount:number};
export type PartnerReservation={id:string;code:string;label:string;phoneHint:string;expiresAt:string;createdAt:string};
export type ReservationResult={outcome:'reserved'|'not_unique'|'self'|'expired'|'confirmed';message:string;reservation?:PartnerReservation};
export type PartnerCabinet={authenticated:boolean;partner:Partner|null;referrals:PartnerReferral[];invitations:PartnerInvite[];reservations?:PartnerReservation[];hasMore:boolean;page:number;total:number;summary:PartnerSummary};
export const partnerStageLabels:Record<string,string>={new:'Новое обращение',contacted:'Связались с покупателем',qualified:'Уточнили задачу',showing:'Организуем показ',booking:'Бронирование',deal:'Сделка состоялась',closed:'Работа завершена',lost:'Покупка не состоялась'};
export const referralLabels:Record<ReferralStatus,string>={pending:'На проверке',accepted:'Клиент закреплён',rejected:'Рекомендация не принята'};
export const rewardLabels:Record<RewardStatus,string>={accrued:'Вознаграждение начислено',requested:'Выплата на оформлении',paid:'Выплачено',void:'Начисление отменено'};
export const partnerRejectReasons={existing:'Покупатель уже обращался в агентство',duplicate:'Рекомендация уже закреплена',self:'Собственная покупка',unconfirmed:'Обращение не подтверждено',fraud:'Подтверждено нарушение правил программы',other:'Условия программы не выполнены'};
export type PartnerRejectReason=keyof typeof partnerRejectReasons;
export function normalizePartnerPhone(value:string){return value.replace(/[^\d+]/g,'').replace(/^8(?=\d{10}$)/,'+7').replace(/^7(?=\d{10}$)/,'+7')}
export function partnerReward(commissionRub:number,reserveBps=PARTNER_RESERVE_BPS,rewardBps=PARTNER_REWARD_BPS){
 if(!Number.isSafeInteger(commissionRub)||commissionRub<=0||commissionRub>1_000_000_000)throw new Error('Укажите полученную комиссию в целых рублях');
 const commissionMinor=commissionRub*100,reserveMinor=Math.round(commissionMinor*reserveBps/10000),baseMinor=commissionMinor-reserveMinor;
 return {commissionRub,reserveMinor,baseMinor,grossMinor:Math.round(baseMinor*rewardBps/10000)};
}
export function partnerMoney(minor:number){return new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',minimumFractionDigits:minor%100?2:0,maximumFractionDigits:2}).format(minor/100)}
export function publicClientName(name:string){const parts=name.trim().split(/\s+/);return parts.length>1?parts[0]+' '+parts[1][0]+'.':parts[0]||'Покупатель'}
export function referralCodeFromStart(start:string|null|undefined){const m=/^ref_([a-zA-Z0-9_-]{12,64})$/.exec(start||'');return m?.[1]??null}
export function partnerLink(code:string,webBase:string,botUsername?:string){return botUsername?'https://t.me/'+botUsername+'?startapp=ref_'+encodeURIComponent(code):webBase+'#/partner-invite?code='+encodeURIComponent(code)}
