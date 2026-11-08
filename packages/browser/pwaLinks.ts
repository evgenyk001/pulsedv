/** Same-origin PWA links; never encode phone, tokens or customer details in a URL. */
export function propertyPwaLink(id:string,origin:string,base='/app/'){
 const url=new URL(base,origin);url.hash='/property/'+encodeURIComponent(id);return url.href;
}
/** Installation may retain a public destination, never an external URL or identity. */
export function pwaStartRoute(value:string){
 if(/^\/(catalog|favorites|mortgage|selection|profile|partners|giveaway)$/.test(value))return value;
 if(/^\/property\/[a-zA-Z0-9_%.-]{1,200}$/.test(value)||/^\/announcements\/[a-f0-9-]{36}$/.test(value))return value;
 if(/^\/partner-invite\?code=[a-zA-Z0-9_-]{12,64}$/.test(value))return value;
 return '/';
}
