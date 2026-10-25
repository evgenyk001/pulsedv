import React from 'react';
import {useLocation,useNavigate,useNavigationType} from 'react-router-dom';
const positions=new Map<string,number>();
type Entry={key:string;path:string};
type History={entries:Entry[];index:number};
const key='pulse.navigation.v1';
const BackContext=React.createContext({canGoBack:false,previousPath:''});
function readHistory():History{
 try{const value=JSON.parse(sessionStorage.getItem(key)||'null');if(Array.isArray(value?.entries)&&Number.isInteger(value.index)&&value.index>=0&&value.index<value.entries.length&&value.entries.every((e:Entry)=>typeof e.key==='string'&&typeof e.path==='string'&&e.path.startsWith('/')&&!e.path.startsWith('//')))return value}catch{}
 return {entries:[],index:-1};
}
export function propertyReturn(){try{const v=sessionStorage.getItem('pulse.property.return');return v&&/^\/(catalog|favorites|compare|selection|journey|my-search)([?]|$)/.test(v)?v:'/catalog'}catch{return '/catalog'}}
export function useAppBack(fallback='/'){
 const {canGoBack,previousPath}=React.useContext(BackContext),navigate=useNavigate();
 const back=React.useCallback(()=>{if(canGoBack)navigate(-1);else navigate(fallback,{replace:true})},[canGoBack,navigate,fallback]);
 return {canGoBack,previousPath,back};
}
/** Only return to entries owned by this app; direct links never leave the app. */
export function NavigationMemory({children}:{children:React.ReactNode}){
 const location=useLocation(),kind=useNavigationType(),navigate=useNavigate();const path=location.pathname+location.search;
 const [history,setHistory]=React.useState(readHistory);
 const current=React.useMemo(()=>{
  const found=history.entries.findIndex(e=>e.key===location.key);
  if(found>=0){if(found===history.index&&history.entries[found].path===path)return history;return {entries:history.entries.map((e,i)=>i===found?{key:location.key,path}:e),index:found}}
  const entry={key:location.key,path};
  if(kind==='REPLACE'&&history.index>=0)return {entries:history.entries.map((e,i)=>i===history.index?entry:e),index:history.index};
  if(kind==='POP')return {entries:[entry],index:0};
  const entries=[...history.entries.slice(0,history.index+1),entry].slice(-60);return {entries,index:entries.length-1};
 },[history,location.key,path,kind]);
 React.useLayoutEffect(()=>{setHistory(current);try{sessionStorage.setItem(key,JSON.stringify(current))}catch{}},[current]);
 const canGoBack=current.index>0;
 React.useEffect(()=>{
  const tg=(window.Telegram?.WebApp as unknown as {BackButton?:{show:()=>void;hide:()=>void;onClick:(fn:()=>void)=>void;offClick:(fn:()=>void)=>void}})?.BackButton;
  if(!tg)return;const back=()=>{const dialogs=document.querySelectorAll<HTMLElement>('[role="dialog"][data-state="open"]');const dialog=dialogs[dialogs.length-1];if(dialog)dialog.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));else navigate(-1)};canGoBack?tg.show():tg.hide();if(canGoBack)tg.onClick(back);
  return()=>{tg.offClick(back);tg.hide()};
 },[canGoBack,navigate]);
 React.useLayoutEffect(()=>{
  if(!location.pathname.startsWith('/property/')){try{sessionStorage.setItem('pulse.property.return',path)}catch{}}
  const entryKey=location.key;
  const y=kind==='POP'?positions.get(entryKey)||0:0;
  let cancelled=false,frame=0,restoring=y>0;
  const observer=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(move)});
  const stop=()=>{cancelled=true;restoring=false;observer.disconnect();window.clearTimeout(expire)};
  const move=()=>{if(cancelled)return;window.scrollTo(0,y);if(document.documentElement.scrollHeight-window.innerHeight>=y-1){restoring=false;observer.disconnect();window.clearTimeout(expire)}};
  const expire=window.setTimeout(()=>{restoring=false;observer.disconnect()},8000);
  if(restoring)observer.observe(document.body);
  frame=requestAnimationFrame(move);
  const save=()=>{if(restoring&&!cancelled)return;positions.set(entryKey,window.scrollY)};
  window.addEventListener('scroll',save,{passive:true});window.addEventListener('pointerdown',stop,{once:true});window.addEventListener('wheel',stop,{once:true});
  return()=>{cancelAnimationFrame(frame);window.clearTimeout(expire);observer.disconnect();if(!positions.has(entryKey))positions.set(entryKey,window.scrollY);window.removeEventListener('scroll',save);window.removeEventListener('pointerdown',stop);window.removeEventListener('wheel',stop)};
 },[location.key,path,kind]);
 return <BackContext.Provider value={{canGoBack,previousPath:current.entries[current.index-1]?.path||''}}>{children}</BackContext.Provider>;
}
