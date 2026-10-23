// Native/browser focus events can fire while a WebView is navigating away.
// Do not start replacement requests in a document that is being discarded.
let leaving=false;
let requests=new AbortController();
const leave=()=>{leaving=true;requests.abort()};
if(typeof window!=='undefined'){
 window.addEventListener('beforeunload',leave);
 window.addEventListener('pagehide',leave);
 window.addEventListener('pageshow',()=>{leaving=false;if(requests.signal.aborted)requests=new AbortController()});
}
export const pageIsLeaving=()=>leaving;

export const pageRequestSignal=()=>requests.signal;
