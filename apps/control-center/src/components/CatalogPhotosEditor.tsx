import React from 'react';
import {ArrowLeft,ArrowRight,Plus,Trash2} from 'lucide-react';
import type {PulseProperty} from '../../../../packages/pulse-data/model';

export function CatalogPhotosEditor({property,onChange,onRemove,disabled=false}:{property:PulseProperty;onChange:(images:PulseProperty['images'])=>void;onRemove:(index:number)=>void;disabled?:boolean}){
 const [url,setUrl]=React.useState(''),[error,setError]=React.useState('');
 const photos=property.images.map((image,index)=>({image,index})).sort((a,b)=>a.image.sortOrder-b.image.sortOrder);
 const move=(position:number,offset:number)=>{
  const next=photos.map(item=>item.image);
  [next[position],next[position+offset]]=[next[position+offset],next[position]];
  onChange(next.map((image,sortOrder)=>({...image,sortOrder})));
 };
 const add=()=>{
  const value=url.trim();
  try{if(new URL(value).protocol!=='https:')throw new Error();}catch{setError('Введите HTTPS-ссылку на фотографию.');return;}
  if(property.images.length>=100){setError('Можно добавить до 100 фотографий в галерею.');return;}
  if(property.images.some(image=>image.url===value)||property.coverImageUrl===value){setError('Эта фотография уже добавлена.');return;}
  onChange([...photos.map(item=>item.image),{id:crypto.randomUUID(),url:value,alt:property.name,sortOrder:photos.length}]);setUrl('');setError('');
 };
 return <div className="catalogPhotosEditor">
  <p className="catalogPhotoHint">{photos.length} / 100 фото · Обложка показывается первой. Порядок и подписи используются в галерее Mini App.</p>
  <div className="mediaGrid">
   {property.coverImageUrl&&<div className="mediaThumb coverThumb"><img src={property.coverImageUrl} alt=""/><span>Обложка</span></div>}
   {photos.map(({image,index},position)=><div className="catalogPhotoItem" key={image.id||image.url}>
    <div className="mediaThumb"><img src={image.url} alt="" loading="lazy"/><span>Фото {position+1}</span><button type="button" aria-label={'Удалить фото '+(position+1)} disabled={disabled} onClick={()=>onRemove(index)}><Trash2 size={14}/></button></div>
    <label className="controlField"><span>Подпись фото {position+1}</span><input maxLength={250} value={image.alt} disabled={disabled} onChange={event=>onChange(property.images.map((photo,i)=>i===index?{...photo,alt:event.target.value}:photo))}/></label>
    <div className="catalogPhotoOrder"><button type="button" disabled={disabled||position===0} aria-label={'Переместить фото '+(position+1)+' раньше'} onClick={()=>move(position,-1)}><ArrowLeft size={14}/></button><button type="button" disabled={disabled||position===photos.length-1} aria-label={'Переместить фото '+(position+1)+' позже'} onClick={()=>move(position,1)}><ArrowRight size={14}/></button></div>
   </div>)}
  </div>
  <div className="catalogPhotoLink"><label className="controlField"><span>Добавить фото по HTTPS-ссылке</span><input type="url" placeholder="https://…" maxLength={2048} value={url} disabled={disabled} onChange={event=>{setUrl(event.target.value);setError('')}}/></label><button type="button" className="secondaryAction" disabled={disabled||!url.trim()||photos.length>=100} onClick={add}><Plus size={15}/>Добавить фото по ссылке</button></div>
  {error&&<p className="errorNotice" role="alert">{error}</p>}
 </div>;
}
