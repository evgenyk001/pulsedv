import type {JourneyEntry} from './client';
export type ClientUpdate={id:string;leadId:string;title:string;at:string};
export function clientUpdates(entries:JourneyEntry[]):ClientUpdate[]{
 const updates:ClientUpdate[]=[];
 for(const e of entries){
  for(const c of e.journey.collections)if(c.published)updates.push({id:'collection:'+c.id+':'+(c.updatedAt||c.createdAt),leadId:e.leadId,title:'Подборка: '+c.title,at:c.updatedAt||c.createdAt});
  for(const s of e.journey.showings)if(s.updatedBy==='manager'&&s.updatedAt)updates.push({id:'showing:'+s.id+':'+s.updatedAt,leadId:e.leadId,title:s.changeDecision==='declined'?'Перенос показа отклонён':s.changeDecision==='accepted'?'Новое время показа подтверждено':s.status==='confirmed'?'Показ подтверждён':s.status==='cancelled'?'Показ отменён':'Обновление по показу',at:s.updatedAt});
  for(const m of e.journey.messages||[])if(m.author==='manager')updates.push({id:'message:'+m.id,leadId:e.leadId,title:'Сообщение от менеджера',at:m.at});
 }
 return updates.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,50);
}
