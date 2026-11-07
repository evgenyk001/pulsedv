/** Same-origin PWA links; never encode phone, tokens or customer details in a URL. */
export function propertyPwaLink(id:string,origin:string,base='/app/'){
 const url=new URL(base,origin);url.hash='/property/'+encodeURIComponent(id);return url.href;
}
