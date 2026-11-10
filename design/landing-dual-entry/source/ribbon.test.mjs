import test from 'node:test';import assert from 'node:assert/strict';
import {ribbonGeometry} from '../ribbon-geometry.js';
test('visible movement continues with a fixed phone scene',()=>{
 const a=ribbonGeometry(0),b=ribbonGeometry(1);
 assert.ok(Math.abs(a.nodes[36].y-b.nodes[36].y)>70);
 assert.notEqual(a.body,b.body);
});
test('geometry remains finite across twists and scene offsets',()=>{
 for(let i=0;i<600;i++){
  const r=ribbonGeometry(i*.07,Math.sin(i*.1)*22);
  for(const name of ['body','shade','shine','edge'])assert.ok(!/NaN|Infinity/.test(r[name]));
  for(const n of r.nodes){assert.ok(n.half>3&&n.half<20);assert.ok(n.y>150&&n.y<530);}
 }
});
test('motion and width are continuous through a twist reversal',()=>{
 for(let t=0;t<20;t+=.037){const a=ribbonGeometry(t),b=ribbonGeometry(t+1e-4);for(let i=0;i<a.nodes.length;i++){assert.ok(Math.abs(a.nodes[i].y-b.nodes[i].y)<.02);assert.ok(Math.abs(a.nodes[i].half-b.nodes[i].half)<.003);}}
});
