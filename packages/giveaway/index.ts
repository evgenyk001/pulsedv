export type GiveawaySettings={enabled:boolean;title:string;prize:string;startsAt:string;endsAt:string;drawAt:string;rules:string;version:number};
export type GiveawayEntry={id:string;status:'pending'|'confirmed'|'rejected';ticket:string|null;createdAt:string;registeredAt:string|null;leadId:string|null;reason:string|null};
export type GiveawayState={settings:GiveawaySettings;entry:GiveawayEntry|null;serverNow:string;observedAt?:number};
export const DEFAULT_GIVEAWAY:GiveawaySettings={enabled:false,title:'Новая квартира. Новый iPhone?',prize:'iPhone 18 Pro',startsAt:'2026-11-06T00:00:00+10:00',endsAt:'2027-01-02T00:00:00+10:00',drawAt:'2027-01-15T12:00:00+10:00',rules:'',version:1};
export function giveawayCountdown(deadline:string,now:number){
 const total=Math.max(0,Math.floor((Date.parse(deadline)-now)/1000));
 return {days:Math.floor(total/86400),hours:Math.floor(total/3600)%24,minutes:Math.floor(total/60)%60,seconds:total%60};
}
