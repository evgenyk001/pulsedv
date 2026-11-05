// Telegram startapp accepts only URL-safe characters, up to 512 characters.
export function propertyStartParam(id:string){
 if(!id||id.length>200||/[\u0000-\u001f\u007f]/.test(id))throw new Error('Invalid property id');
 const bytes=new TextEncoder().encode(id);
 const token='property_'+btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
 if(token.length>512)throw new Error('Property link is too long');
 return token;
}
export function propertyFromStart(value:unknown):string|null{
 if(typeof value!=='string'||!/^property_[A-Za-z0-9_-]+$/.test(value)||value.length>512)return null;
 try{const token=value.slice(9);const id=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(token.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0)));
 return propertyStartParam(id)===value?id:null;}catch{return null;}
}
export function propertyTelegramLink(id:string,botUsername:string){
 if(!/^[A-Za-z0-9_]{5,32}$/.test(botUsername))throw new Error('Invalid bot username');
 return 'https://t.me/'+botUsername+'?startapp='+propertyStartParam(id);
}
