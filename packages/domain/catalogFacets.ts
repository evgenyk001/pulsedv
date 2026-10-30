import {projectDeliveries} from './projectBuildings';
import type {ProjectDetails} from '../pulse-data/model';
/** Public filter choices are derived from published catalog data, never editor presets. */
export function normalizeRoomLabel(label:string):string|null{
 const text=label.trim().toLowerCase();
 if(/студ/.test(text))return 'Студия';
 const match=text.match(/\d+/);if(!match)return null;
 const count=Number(match[0]);
 return count>0&&count<=100?String(count)+(text.includes('+')?'+':''):null;
}
export function sortRoomLabels(labels:string[]){
 return [...new Set(labels.map(normalizeRoomLabel).filter((v):v is string=>v!==null))].sort((a,b)=>a==='Студия'?-1:b==='Студия'?1:parseInt(a)-parseInt(b)||a.localeCompare(b,'ru'));
}
export function catalogFacets(roomLabels:string[],deliveries:string[]){
 const years=new Set<string>();let completed=false;
 for(const value of deliveries){
  if(/сдан|готов|введ[её]н/i.test(value)&&! /не\s+(?:сдан|готов|введ)/i.test(value))completed=true;
  for(const year of value.matchAll(/\b20\d{2}\b/g))years.add(year[0]);
 }
 return {rooms:sortRoomLabels(roomLabels),deliveries:[...(completed?['Сдан']:[]),...[...years].sort()]};
}
export function publishedCatalogFacets(properties:readonly {status:string;delivery:string;projectDetails?:ProjectDetails;floorplans:readonly {roomLabel:string}[]}[]){
 const published=properties.filter(p=>p.status==='published');
 return catalogFacets(published.flatMap(p=>p.floorplans.map(f=>f.roomLabel)),published.flatMap(projectDeliveries));
}
export function roomChoiceLabel(value:string){return value==='Все'||value==='Не важно'?'Любая комнатность':value==='Студия'?'Студия':value+' комн.'}
