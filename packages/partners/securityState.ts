// Unlock credentials live only in memory, never in browser storage.
let grant='';
export const partnerGrant=()=>grant;
export const setPartnerGrant=(value:string)=>{grant=value;};
