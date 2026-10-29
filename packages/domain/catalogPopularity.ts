import type {PulseEvent,PulseProperty} from '../pulse-data/model';
/** One vote per confirmed identity (or session) and project; refreshes cannot add votes. */
export function rankPopularProperties(properties:PulseProperty[],events:PulseEvent[],city:string|null=null,now=Date.now()){
 const votes=new Map<string,Map<string,number>>();
 for(const event of events){
  const time=Date.parse(event.createdAt);
  if(event.eventType!=='property_view'||!event.entityId||!Number.isFinite(time)||time>now||time<now-30*86400000)continue;
  const people=votes.get(event.entityId)??new Map<string,number>();
  const person=event.userId??event.sessionId;
  people.set(person,Math.max(people.get(person)??0,time));votes.set(event.entityId,people);
 }
 const score=(id:string)=>[...(votes.get(id)?.values()??[])].reduce((sum,time)=>sum+(time>=now-7*86400000?2:1),0);
 return properties.filter(p=>p.status==='published'&&(!city||p.city===city)).sort((a,b)=>score(b.id)-score(a.id)||(votes.get(b.id)?.size??0)-(votes.get(a.id)?.size??0)||a.id.localeCompare(b.id));
}
