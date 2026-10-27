import React from 'react';
import {api} from '../../../../packages/pulse-data/runtime';
import type {MapConfig} from '../../../../packages/pulse-data/mapConfig';
import type {PulseProperty} from '../../../../packages/pulse-data/model';
import type {Coordinates,PropertyMapAdapter,MapMarker} from '../../../../packages/pulse-data/propertyMapAdapter';

const centers:Record<string,Coordinates>={'Владивосток':[131.8855,43.1155],'Уссурийск':[131.952,43.797],'Артём':[132.188,43.355],'Находка':[132.893,42.824],'Большой Камень':[132.35,43.112]};
export function PropertyLocationEditor({property,onChange}:{property:PulseProperty;onChange:(change:Partial<PulseProperty>)=>void}){
 const host=React.useRef<HTMLDivElement>(null),map=React.useRef<PropertyMapAdapter|null>(null),marker=React.useRef<MapMarker|null>(null);
 const change=React.useRef(onChange);change.current=onChange;
 const current=React.useRef(property);current.current=property;
 const [opened,setOpened]=React.useState(false),[status,setStatus]=React.useState(''),[attempt,setAttempt]=React.useState(0);
 const located=property.latitude!=null&&property.longitude!=null;
 const mark=React.useCallback((coordinates:Coordinates)=>{
  marker.current?.destroy();
  const pin=document.createElement('div');pin.textContent='ЖК';
  Object.assign(pin.style,{background:'#ef001c',color:'white',padding:'8px 12px',borderRadius:'18px',fontWeight:'700',transform:'translate(-50%,-100%)',boxShadow:'0 2px 12px #0003'});
  marker.current=map.current?.addMarker(coordinates,pin,10)??null;
 },[]);
 React.useEffect(()=>{
  if(!opened||!host.current)return;
  const controller=new AbortController();let dispose:(()=>void)|undefined;
  setStatus('Загружаем карту…');
  void (async()=>{
   try{
    const config=await api<MapConfig>('/public/map');
    const {createPropertyMap}=await import('../../../../packages/pulse-data/propertyMapAdapter');
    if(controller.signal.aborted)return;
    const p=current.current;
    const hasPoint=p.longitude!=null&&p.latitude!=null;
    const center:Coordinates=hasPoint?[p.longitude!,p.latitude!]:centers[p.city]??centers['Владивосток'];
    const adapter=await createPropertyMap(config,host.current!,center,controller.signal);
    if(controller.signal.aborted){adapter.destroy();return}
    map.current=adapter;adapter.expand(center,hasPoint?16:12);
    if(hasPoint)mark(center);
    dispose=adapter.onPick(([longitude,latitude])=>{
     if(!Number.isFinite(longitude)||!Number.isFinite(latitude)||Math.abs(longitude)>180||Math.abs(latitude)>90)return;
     change.current({longitude:Number(longitude.toFixed(6)),latitude:Number(latitude.toFixed(6))});
    });
    setStatus('');
   }catch{if(!controller.signal.aborted)setStatus('Карта не загрузилась. Попробуйте ещё раз или укажите координаты вручную.')}
  })();
  return()=>{controller.abort();dispose?.();marker.current?.destroy();marker.current=null;map.current?.destroy();map.current=null};
 },[opened,attempt,mark]);
 React.useEffect(()=>{if(map.current){if(located)mark([property.longitude!,property.latitude!]);else{marker.current?.destroy();marker.current=null}}},[property.longitude,property.latitude,located,mark]);
 return <section className="catalogEditorSection">
  <div className="catalogEditorSectionHead"><div><b>Расположение на карте</b><small>Откройте карту, приблизьте нужный дом и нажмите на него. Координаты заполнятся автоматически. Точку можно изменить повторным нажатием.</small></div></div>
  <p>{property.address||property.city}{located?' · Точка выбрана':' · Точка ещё не выбрана'}</p>
  <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:12}}>
   <button type="button" className="secondaryAction" onClick={()=>setOpened(v=>!v)}>{opened?'Скрыть карту':located?'Изменить точку на карте':'Выбрать точку на карте'}</button>
   <a className="secondaryAction" target="_blank" rel="noreferrer" href={'https://yandex.ru/maps/?text='+encodeURIComponent([property.city,property.address].filter(Boolean).join(', '))}>Найти адрес в Яндекс Картах</a>
   {located&&<button type="button" className="textDanger" onClick={()=>onChange({latitude:null,longitude:null})}>Убрать точку</button>}
  </div>
  {opened&&<><div ref={host} role="region" aria-label="Выбор расположения ЖК" style={{height:340,borderRadius:16,overflow:'hidden',background:'#e7ecef'}}/>{status&&<p role="status">{status}{!status.includes('…')&&<button type="button" onClick={()=>setAttempt(v=>v+1)}>Повторить</button>}</p>}</>}
  <details style={{marginTop:12}}><summary>Координаты вручную</summary><div className="formGrid">
   {(['latitude','longitude'] as const).map(key=><label className="controlField" key={key}><span>{key==='latitude'?'Широта':'Долгота'}</span><input type="number" step="any" min={key==='latitude'?-90:-180} max={key==='latitude'?90:180} value={property[key]??''} onChange={e=>onChange({[key]:e.target.value===''?null:Number(e.target.value)})}/></label>)}
  </div></details>
 </section>;
}
