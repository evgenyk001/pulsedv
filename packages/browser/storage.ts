// Accessing window.localStorage itself can throw in restricted WebViews.
// Keep unavailable writes in this document only; never claim they were persisted.
export function createSafeStorage(kind:'localStorage'|'sessionStorage'){
 const prefix=typeof window!=='undefined'&&window.location.pathname.startsWith('/landing-cinematic/pwa-preview/')?'pulse-preview:':'';
 const fallback=new Map<string,string|null>();
 return {
  getItem(key:string):string|null{
   if(fallback.has(key))return fallback.get(key)??null;
   try{return window[kind].getItem(prefix+key)}catch{return null}
  },
  setItem(key:string,value:string):boolean{
   try{window[kind].setItem(prefix+key,value);fallback.delete(key);return true}
   catch{fallback.set(key,value);return false}
  },
  removeItem(key:string):boolean{
   try{window[kind].removeItem(prefix+key);fallback.delete(key);return true}
   catch{fallback.set(key,null);return false}
  }
 };
}
export const safeLocalStorage=createSafeStorage('localStorage');
export const safeSessionStorage=createSafeStorage('sessionStorage');
