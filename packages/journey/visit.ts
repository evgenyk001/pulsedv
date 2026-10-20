// A visit is a browser-tab entry, renewed after 30 minutes or a new tagged entry.
export function entrySearch(){
 const params=new URLSearchParams(window.location.search);
 const hash=new URLSearchParams(window.location.hash.split('?')[1]||'');
 for(const [key,value] of hash)if(!params.has(key))params.set(key,value);
 return '?'+params.toString();
}
export function visitId(surface:'landing'|'miniapp'){
 const key='pulse.visit.'+surface+'.v1',search=entrySearch(),params=new URLSearchParams(search);
 let campaign=params.get('utm_source')?search:'';
 const start=params.get('tgWebAppStartParam')||(window as any).Telegram?.WebApp?.initDataUnsafe?.start_param;
 if(!campaign&&typeof start==='string'&&/^acq_[a-f0-9]{32}$/.test(start))campaign='telegram:'+start;
 if(!campaign)try{const ref=new URL(document.referrer);if(['https:','http:'].includes(ref.protocol)&&ref.origin!==window.location.origin)campaign='ref:'+ref.hostname.toLowerCase()}catch{}
 let visit:{id:string;at:number;campaign:string}|null=null;
 try{visit=JSON.parse(sessionStorage.getItem(key)||'null')}catch{}
 if(!visit||!Number.isFinite(visit.at)||Date.now()-visit.at>30*60*1000||(campaign&&campaign!==visit.campaign))visit={id:crypto.randomUUID(),at:Date.now(),campaign};
 visit.at=Date.now();try{sessionStorage.setItem(key,JSON.stringify(visit))}catch{}
 return visit.id;
}
