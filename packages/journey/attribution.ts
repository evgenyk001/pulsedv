export function attribution(search:string,referrer='',origin=''){
 const p=new URLSearchParams(search),clean=(v:string|null)=>v?.replace(/[^\p{L}\p{N}_ .-]/gu,'').slice(0,100)||'';
 let host='';try{const url=new URL(referrer);if(url.origin!==origin&&['https:','http:'].includes(url.protocol))host=url.hostname.toLowerCase();}catch{}
 return {source:clean(p.get('utm_source'))||host||'direct',medium:clean(p.get('utm_medium'))||(host?'referral':''),campaign:clean(p.get('utm_campaign')),content:clean(p.get('utm_content')),term:clean(p.get('utm_term')),referrer:host};
}
