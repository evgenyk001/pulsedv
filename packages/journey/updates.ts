import type {JourneyEntry} from './client';
export type ClientUpdate={id:string;leadId:string;title:string;at:string;kind:'message'|'collection'|'showing';body:string;read?:boolean};
export function clientUpdates(entries:JourneyEntry[],limit=50):ClientUpdate[]{
 const updates:ClientUpdate[]=[];
 for(const e of entries){
  for(const c of e.journey.collections)if(c.published)updates.push({id:'collection:'+c.id+':'+(c.updatedAt||c.createdAt),leadId:e.leadId,title:'Подборка: '+c.title,at:c.updatedAt||c.createdAt,kind:'collection',body:'Новые варианты для вашей покупки'});
  for(const s of e.journey.showings)if(s.updatedBy==='manager'&&s.updatedAt)updates.push({id:'showing:'+s.id+':'+s.updatedAt,leadId:e.leadId,title:s.changeDecision==='declined'?'Перенос показа отклонён':s.changeDecision==='accepted'?'Новое время показа подтверждено':s.status==='confirmed'?'Показ подтверждён':s.status==='cancelled'?'Показ отменён':'Обновление по показу',at:s.updatedAt,kind:'showing',body:'Посмотрите время и детали встречи'});
  for(const m of e.journey.messages||[])if(m.author==='manager')updates.push({id:'message:'+m.id,leadId:e.leadId,title:'Сообщение от менеджера',at:m.at,kind:'message',body:m.text.slice(0,160),read:!!m.readAt});
 }
 return updates.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,limit);
}
