import test from 'node:test';import assert from 'node:assert/strict';
import {criticalStep,smootherstep,FLOW_SCENES,flowPath} from '../motion-core.js';
test('spring has the same result across different frame partitions',()=>{
 const one=criticalStep(500,-30,123,.04);const first=criticalStep(500,-30,123,.02),two=criticalStep(...first,123,.02);
 one.forEach((value,i)=>assert.ok(Math.abs(value-two[i])<1e-10));
});
test('retargeting never resets current position or velocity',()=>{
 for(const target of FLOW_SCENES.flat())assert.deepEqual(criticalStep(320,17,target,0),[320,17]);
});
test('rest-to-rest settling is monotone and does not overshoot',()=>{
 let position=0,velocity=0,previous=0;
 for(let i=0;i<360;i++){[position,velocity]=criticalStep(position,velocity,1,1/60);assert.ok(position>=previous-1e-12&&position<=1+1e-12);previous=position;}
 assert.ok(Math.abs(position-1)<1e-9);assert.ok(Math.abs(velocity)<1e-8);
});
test('continuous line coordinates stay finite through repeated scene changes',()=>{
 let values=FLOW_SCENES[0].slice(),velocity=values.map(()=>0);
 for(let frame=0;frame<2400;frame++){
  const target=FLOW_SCENES[Math.floor(frame/160)%FLOW_SCENES.length];
  values.forEach((value,i)=>{[values[i],velocity[i]]=criticalStep(value,velocity[i],target[i],frame%2?1/120:1/40)});
  for(let line=0;line<5;line++){const d=flowPath(values,line,frame/60);assert.ok(!/NaN|Infinity/.test(d));assert.ok(d.startsWith('M -120 '));}
 }
});
test('phone easing has zero speed at both ends',()=>{
 assert.equal(smootherstep(0),0);assert.equal(smootherstep(1),1);
 const step=1e-4;assert.ok(smootherstep(step)/step<1e-6);assert.ok((1-smootherstep(1-step))/step<1e-6);
});
