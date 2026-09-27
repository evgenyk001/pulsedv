import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInterestDNA,selectIdentityEvents } from '../../packages/interest-dna';
import { DEFAULT_STATE,type PulseEvent } from '../../packages/pulse-data/model';
const now=new Date('2026-09-27T06:00:00Z');
const event=(id:string,type:string,metadata:Record<string,unknown>={},at=now.toISOString()):PulseEvent=>({id,sessionId:'session-a',userId:null,eventType:type,entityType:type==='property_view'||type.startsWith('favorite')||type==='floorplan_view'?'property':'selection',entityId:'solnechniy',metadata,createdAt:at});
test('DNA: ограничение повторов, затухание и исключение будущих событий',()=>{
 const single=event('1','property_view');const few=buildInterestDNA([single,event('2','property_view'),event('3','property_view')],DEFAULT_STATE,now);
 const spam=buildInterestDNA(Array.from({length:100},(_,i)=>event(String(i),'property_view')),DEFAULT_STATE,now);
 assert.equal(few.interests.find(i=>i.dimension==='property')!.strength,spam.interests.find(i=>i.dimension==='property')!.strength);
 assert.equal(spam.interests.find(i=>i.dimension==='property')!.count,3);
 assert.equal(spam.interests.find(i=>i.dimension==='property')!.confidence,'supported');
 const old=buildInterestDNA([event('old','property_view',{},'2026-09-13T06:00:00Z')],DEFAULT_STATE,now);
 const recent=buildInterestDNA([single],DEFAULT_STATE,now);
 assert.ok(old.interests[0].strength<recent.interests[0].strength);
 assert.equal(buildInterestDNA([single,single,event('future','property_view',{},'2030-01-01T00:00:00Z')],DEFAULT_STATE,now).eventCount,1);
 assert.equal(buildInterestDNA([event('ancient','property_view',{},'2025-01-01T00:00:00Z')],DEFAULT_STATE,now).interests.length,0);
});
test('DNA: ипотечный расчёт и просмотр цены не выдумывают бюджет или право на программу',()=>{
 const dna=buildInterestDNA([event('v','property_view',{priceFrom:8}),event('m','mortgage_calculated',{program:'family',price:9_000_000,down:2_000_000,payment:45_000})],DEFAULT_STATE,now);
 assert.equal(dna.facts.length,0);assert.ok(dna.questions.some(q=>q.includes('право')));assert.equal(dna.recommendations.length,0);
 assert.match(dna.brief,/не подтверждена/);
});
test('DNA: актуальные пожелания, изменение запроса, доказательства и рекомендации',()=>{
 const before=event('before','select_submit',{city:'Артём',rooms:'1',purchaseMode:'cash',min:4_000_000,max:6_000_000},'2026-09-23T05:00:00Z');
 const after=event('after','select_submit',{city:'Владивосток',rooms:'2',purchaseMode:'cash',min:8_000_000,max:12_000_000,delivery:'Сдан'},'2026-09-27T05:00:00Z');
 const dna=buildInterestDNA([before,after],DEFAULT_STATE,now);
 assert.equal(dna.facts.find(f=>f.key==='city')!.value,'Владивосток');
 assert.ok(dna.changes.some(c=>c.title.includes('бюджет')));assert.ok(dna.changes.some(c=>c.id.startsWith('return:')));
 assert.deepEqual(dna.changes.find(c=>c.title.includes('бюджет'))!.eventIds,['before','after']);
 assert.ok(dna.questions.includes('Когда планирует покупку?'));
 assert.ok(dna.recommendations.length>0);assert.ok(dna.recommendations.every(p=>DEFAULT_STATE.properties.find(x=>x.id===p.id)?.city==='Владивосток'));
});
test('DNA: снятые предпочтения и удалённое избранное не остаются подтверждёнными',()=>{
 const dna=buildInterestDNA([event('1','select_submit',{city:'Владивосток',rooms:'2',purchaseMode:'cash',min:5e6,max:9e6},'2026-09-26T00:00:00Z'),event('2','select_submit',{city:'Все',rooms:'Не важно',purchaseMode:'mortgage',down:2e6,payment:6e4,program:'family'},'2026-09-27T00:00:00Z'),event('3','favorite_add',{},'2026-09-27T01:00:00Z'),event('4','favorite_remove',{},'2026-09-27T02:00:00Z')],DEFAULT_STATE,now);
 assert.ok(!dna.facts.some(f=>['city','rooms','budget'].includes(f.key)));assert.ok(!dna.interests.some(i=>i.dimension==='property'));
 assert.ok(dna.facts.some(f=>f.key==='down'));assert.ok(dna.questions.some(q=>q.includes('право')));
});
test('DNA: объединение только по подтверждённому userId, не по номеру или совпадению устройства',()=>{
 const a={...event('a','page_view'),userId:'verified'};
 const b={...event('b','page_view'),sessionId:'session-b',userId:'verified'};
 const c={...event('c','page_view'),sessionId:'session-c',userId:'other'};
 assert.deepEqual(selectIdentityEvents([a,b,c],'session-a','verified').map(e=>e.id),['a','b']);
 assert.deepEqual(selectIdentityEvents([a,b,c],'session-a',null).map(e=>e.id),['a']);
});
