import React from 'react';
import {Monitor, Moon, Sun} from 'lucide-react';
export type AppearanceMode='light'|'dark'|'system';
const key='pulse-control-appearance';
const AppearanceContext=React.createContext<{mode:AppearanceMode;setMode:(mode:AppearanceMode)=>void}>({mode:'light',setMode:()=>{}});
function storedMode():AppearanceMode{try{const value=localStorage.getItem(key);return value==='dark'||value==='system'?value:'light'}catch{return 'light'}}
function applyAppearance(mode:AppearanceMode,systemDark:boolean){const resolved=mode==='system'?(systemDark?'dark':'light'):mode;document.documentElement.dataset.appearance=resolved;document.querySelector('meta[name=theme-color]')?.setAttribute('content',resolved==='dark'?'#191c21':'#eef0f2');}
export function initializeAppearance(){applyAppearance(storedMode(),matchMedia('(prefers-color-scheme: dark)').matches);}
export function AppearanceProvider({children}:{children:React.ReactNode}){
 const [mode,setMode]=React.useState<AppearanceMode>(storedMode);
 React.useLayoutEffect(()=>{const media=matchMedia('(prefers-color-scheme: dark)');const apply=()=>applyAppearance(mode,media.matches);apply();try{localStorage.setItem(key,mode)}catch{}media.addEventListener('change',apply);return()=>media.removeEventListener('change',apply)},[mode]);
 React.useEffect(()=>{const sync=(event:StorageEvent)=>{if(event.key===key)setMode(storedMode())};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync)},[]);
 return <AppearanceContext.Provider value={{mode,setMode}}>{children}</AppearanceContext.Provider>;
}
export function AppearanceControl({expanded=false}:{expanded?:boolean}){
 const {mode,setMode}=React.useContext(AppearanceContext);
 return <div className={'appearanceControl'+(expanded?' appearanceExpanded':'')} role="group" aria-label="Тема интерфейса">{([{id:'light',label:'День',Icon:Sun},{id:'dark',label:'Ночь',Icon:Moon},{id:'system',label:'Система',Icon:Monitor}] as const).map(({id,label,Icon})=><button key={id} type="button" title={label} aria-label={'Тема: '+label} aria-pressed={mode===id} onClick={()=>setMode(id)}><Icon size={15}/>{expanded&&<span>{label}</span>}</button>)}</div>;
}
