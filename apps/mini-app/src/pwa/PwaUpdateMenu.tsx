import React from 'react';
import {useLocation} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {Check, ChevronRight, Download, RefreshCw, X} from 'lucide-react';
import {Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger} from '../components/Sheet';
import release from './release.json';
import mark from './release-mark.svg';
import './pwa.css';

type Release = typeof release & {build:string};

async function fetchRelease(signal:AbortSignal):Promise<Release>{
 const response=await fetch(import.meta.env.BASE_URL+'app-release.json',{cache:'no-store',signal});
 if(!response.ok)throw new Error('Release metadata unavailable');
 const value=await response.json() as Release;
 if(!/^[a-f0-9]{16}$/.test(value?.build)||typeof value.version!=='string'||
    !Array.isArray(value.notes)||!value.notes.every(note=>typeof note==='string')){
  throw new Error('Invalid release metadata');
 }
 return value;
}

function waitForWorker(worker:ServiceWorker){
 return new Promise<void>((resolve,reject)=>{
  const timer=window.setTimeout(()=>finish(new Error('Worker timed out')),15000);
  const finish=(error?:Error)=>{
   window.clearTimeout(timer);
   worker.removeEventListener('statechange',check);
   if(error)reject(error);
   else resolve();
  };
  const check=()=>{
   if(worker.state==='redundant')finish(new Error('Worker is redundant'));
   if(['installed','activating','activated'].includes(worker.state))finish();
  };
  worker.addEventListener('statechange',check);
  check();
 });
}

function activateWorker(container:ServiceWorkerContainer,worker:ServiceWorker,expectedBuild:string){
 return new Promise<void>((resolve,reject)=>{
  const wasActive=worker===container.controller;
  const channel=new MessageChannel();
  let accepted=false;
  const timer=window.setTimeout(()=>finish(new Error('Activation timed out')),15000);
  const finish=(error?:Error)=>{
   window.clearTimeout(timer);
   channel.port1.close();
   container.removeEventListener('controllerchange',check);
   if(error)reject(error);
   else resolve();
  };
  const check=()=>{
   if(accepted&&(wasActive||container.controller===worker))finish();
  };
  container.addEventListener('controllerchange',check);
  channel.port1.onmessage=event=>{
   if(event.data!==expectedBuild){finish(new Error('Activation rejected'));return}
   accepted=true;
   check();
  };
  try{worker.postMessage({type:'PULSE_ACTIVATE',build:expectedBuild},[channel.port2])}
  catch{finish(new Error('Activation request failed'))}
 });
}

const updateStages={
 prepare:{label:'Подготавливаем обновление…',floor:5,ceiling:62},
 activate:{label:'Применяем обновление…',floor:65,ceiling:94},
 restart:{label:'Перезапускаем приложение…',floor:100,ceiling:100},
} as const;

export function PwaUpdateMenu(){
 const [build]=React.useState(()=>document.querySelector<HTMLMetaElement>('meta[name="pulse-build"]')?.content);
 const [stage,setStage]=React.useState<'prepare'|'activate'|'restart'|null>(null);
 const [error,setError]=React.useState(false);
 const [open,setOpen]=React.useState(false);
 const {search}=useLocation();
 React.useEffect(()=>{
  if(/^[a-f0-9]{16}$/.test(new URLSearchParams(search).get('update')??''))setOpen(true);
 },[search]);
 const [progress,setProgress]=React.useState(0);
 const sheet=React.useRef<HTMLDivElement>(null);
 const latest=useQuery({
  queryKey:['pwa-release',import.meta.env.BASE_URL],
  queryFn:({signal})=>fetchRelease(signal),
  retry:false,
  refetchInterval:open&&!stage?15000:false,
 });
 const next=build&&latest.data?.build!==build?latest.data:undefined;
 const shown=next??release;
 const phase=stage&&updateStages[stage];

 React.useEffect(()=>{
  if(!phase)return;
  setProgress(value=>Math.max(value,phase.floor));
  if(phase.floor===phase.ceiling)return;
  const timer=window.setInterval(()=>{
   setProgress(value=>Math.min(phase.ceiling,value+Math.max(1,Math.ceil((phase.ceiling-value)/7))));
  },90);
  return ()=>window.clearInterval(timer);
 },[phase]);

 const apply=async()=>{
  if(stage||!next)return;
  setError(false);
  setProgress(0);
  setStage('prepare');
  try{
   const container=navigator.serviceWorker;
   const registration=await container?.getRegistration(import.meta.env.BASE_URL);
   if(!registration)throw new Error('Update worker unavailable');
   await Promise.all([
    registration.update(),
    new Promise(resolve=>window.setTimeout(resolve,550)),
   ]);
   if(registration.installing)await waitForWorker(registration.installing);
   const worker=registration.waiting??registration.active;
   if(!worker)throw new Error('Update worker unavailable');
   setStage('activate');
   await Promise.all([
    activateWorker(container,worker,next.build),
    new Promise(resolve=>window.setTimeout(resolve,500)),
   ]);
   setStage('restart');
   await new Promise(resolve=>window.setTimeout(resolve,420));
   setOpen(false);
   // Let the sheet unmount and release its overlay and scroll lock before navigating.
   const deadline=performance.now()+700;
   while(sheet.current&&performance.now()<deadline){
    await new Promise(resolve=>window.setTimeout(resolve,25));
   }
   history.scrollRestoration='manual';
   window.scrollTo(0,0);
   await new Promise(resolve=>window.requestAnimationFrame(resolve));
   location.reload();
  }catch{
   setError(true);
   setStage(null);
  }
 };

 const description=next?'Версия '+shown.version:latest.isFetching?'Проверяем обновления…':latest.isError?'Не удалось проверить обновления.':'У вас самая свежая версия';

 return <Sheet open={open} onOpenChange={value=>{if(!stage)setOpen(value)}}>
  <SheetTrigger asChild>
   <button type="button" className="pwaReleaseRow" onClick={()=>void latest.refetch()}>
    <span className="pwaReleaseRowIcon" aria-hidden="true"><RefreshCw size={17}/></span>
    <span className="pwaReleaseLabel">
     Версия приложения
     {next&&<strong>Доступно обновление</strong>}
    </span>
    <span className="pwaReleaseVersion">{release.version}</span>
    <ChevronRight className="pwaReleaseChevron" size={16} aria-hidden="true"/>
   </button>
  </SheetTrigger>
  <SheetContent ref={sheet} side="bottom" className="pwaReleaseSheet">
   <div className="pwaReleasePanel">
    <SheetHeader className="pwaReleaseHeader">
     <div className="pwaReleaseHeading">
      <span className="pwaReleaseMark" aria-hidden="true"><img src={mark} alt="" width="35" height="36"/></span>
      <SheetTitle className="pwaReleaseTitle">{next?'Обновление приложения':'Версия приложения'}</SheetTitle>
      <SheetClose className="pwaReleaseClose" aria-label="Закрыть" disabled={Boolean(stage)}><X size={17}/></SheetClose>
     </div>
     <div className="pwaReleaseSummary" data-update={Boolean(next)}>
      {!next&&!latest.isError&&!latest.isFetching&&<Check size={17} aria-hidden="true"/>}
      <SheetDescription className="pwaReleaseDescription" aria-live="polite">{description}</SheetDescription>
      {!next&&<span className="pwaReleaseVersion">{release.version}</span>}
     </div>
    </SheetHeader>
    {next&&shown.notes.length>0&&<section className="pwaReleaseNotes">
     <h3>Что нового</h3>
     <ul>{shown.notes.map((note,index)=><li key={index}>{note}</li>)}</ul>
    </section>}
    {phase&&<div className="pwaReleaseProgress">
     <div className="pwaReleaseProgressLabel"><span role="status">{phase.label}</span><strong aria-hidden="true">{progress}%</strong></div>
     <div className="pwaReleaseProgressTrack" role="progressbar" aria-label="Установка обновления" aria-valuenow={progress}>
      <div style={{width:progress+'%'}}/>
     </div>
    </div>}
    {error&&<p className="pwaReleaseError" role="alert">Не удалось применить обновление. Попробуйте ещё раз.</p>}
    {!stage&&(next
     ? <button type="button" className="pwaButton" onClick={()=>void apply()}><Download size={18} aria-hidden="true"/>Обновить</button>
     : latest.isError&&<button type="button" className="pwaTextButton" disabled={latest.isFetching} onClick={()=>void latest.refetch()}><RefreshCw size={15} aria-hidden="true"/>Повторить проверку</button>)}
   </div>
  </SheetContent>
 </Sheet>;
}
