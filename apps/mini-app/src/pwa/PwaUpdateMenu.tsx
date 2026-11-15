import React from 'react';
import {useQuery} from '@tanstack/react-query';
import {ChevronRight, Download, RefreshCw} from 'lucide-react';
import {Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger} from '../components/Sheet';
import release from './release.json';
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

function activateWorker(container:ServiceWorkerContainer,worker:ServiceWorker){
 return new Promise<void>((resolve,reject)=>{
  const previous=container.controller;
  const timer=window.setTimeout(()=>{
   container.removeEventListener('controllerchange',check);
   reject(new Error('Activation timed out'));
  },15000);
  const check=()=>{
   if(container.controller&&container.controller!==previous){
    window.clearTimeout(timer);
    container.removeEventListener('controllerchange',check);
    resolve();
   }
  };
  container.addEventListener('controllerchange',check);
  worker.postMessage({type:'PULSE_ACTIVATE'});
 });
}

export function PwaUpdateMenu(){
 const [build]=React.useState(()=>document.querySelector<HTMLMetaElement>('meta[name="pulse-build"]')?.content);
 const [stage,setStage]=React.useState<'prepare'|'activate'|'restart'|null>(null);
 const [error,setError]=React.useState(false);
 const latest=useQuery({
  queryKey:['pwa-release',import.meta.env.BASE_URL],
  queryFn:({signal})=>fetchRelease(signal),
  retry:false,
 });
 const next=build&&latest.data?.build!==build?latest.data:undefined;
 const shown=next??release;
 const status=stage==='prepare'?'Подготавливаем обновление…':stage==='activate'?'Применяем обновление…':stage==='restart'?'Перезапускаем приложение…':null;

 const apply=async()=>{
  setError(false);
  setStage('prepare');
  try{
   const container=navigator.serviceWorker;
   const registration=await container?.getRegistration(import.meta.env.BASE_URL);
   if(registration){
    await registration.update();
    if(registration.installing)await waitForWorker(registration.installing);
    if(registration.waiting){
     setStage('activate');
     await activateWorker(container,registration.waiting);
    }
   }
   setStage('restart');
   location.reload();
  }catch{
   setError(true);
   setStage(null);
  }
 };

 return <Sheet>
  <SheetTrigger asChild>
   <button type="button" className="pwaReleaseRow" onClick={()=>void latest.refetch()}>
    <span>Версия приложения{next&&<strong><i aria-hidden="true"/>Доступно обновление</strong>}</span>
    <span className="pwaReleaseVersion">{release.version}</span>
    <ChevronRight size={15} aria-hidden="true"/>
   </button>
  </SheetTrigger>
  <SheetContent side="bottom" className="pwaReleaseSheet">
   <img src={import.meta.env.BASE_URL+'pulse-app-192-v3.png'} alt="" width="58" height="58"/>
   <SheetHeader>
    <SheetTitle>{next?'Обновление PULSEDV.RU':'Версия приложения'}</SheetTitle>
    <SheetDescription>{next?'Версия '+shown.version:latest.isFetching?'Проверяем обновления…':latest.isError?'Не удалось проверить обновления.':'У вас самая свежая версия'}</SheetDescription>
   </SheetHeader>
   {next&&shown.notes.length>0&&<ul>{shown.notes.map((note,index)=><li key={index}>{note}</li>)}</ul>}
   {status&&<div className="pwaReleaseProgress" role="status"><span aria-hidden="true"/>{status}</div>}
   {error&&<p role="alert">Не удалось применить обновление. Попробуйте ещё раз.</p>}
   {!stage&&(next
    ? <button type="button" className="pwaButton" onClick={()=>void apply()}><Download size={18}/>Обновить</button>
    : latest.isError&&<button type="button" className="pwaTextButton" disabled={latest.isFetching} onClick={()=>void latest.refetch()}><RefreshCw size={15}/>Повторить проверку</button>)}
  </SheetContent>
 </Sheet>;
}
