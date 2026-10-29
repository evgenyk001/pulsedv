import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSafeStorage} from '../packages/browser/storage';

test('restricted property access keeps local and session fallback separate',()=>{
 const old=globalThis.window;
 try{
  Object.defineProperty(globalThis,'window',{configurable:true,value:Object.defineProperties({},{localStorage:{get(){throw Error('Denied')}},sessionStorage:{get(){throw Error('Denied')}}})});
  const local=createSafeStorage('localStorage'),session=createSafeStorage('sessionStorage');
  assert.equal(local.getItem('draft'),null);assert.equal(local.setItem('draft','text'),false);
  assert.equal(local.getItem('draft'),'text');assert.equal(session.getItem('draft'),null);
  assert.equal(local.removeItem('draft'),false);assert.equal(local.getItem('draft'),null);
 }finally{Object.defineProperty(globalThis,'window',{configurable:true,value:old})}
});

test('quota errors preserve the latest value and failed deletions hide stale persisted data',()=>{
 const old=globalThis.window;const stored=new Map([['draft','old']]);let denied=true;
 try{
  Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:{getItem:(key:string)=>stored.get(key)??null,setItem:(key:string,value:string)=>{if(denied)throw Error('Quota exceeded');stored.set(key,value)},removeItem:(key:string)=>{if(denied)throw Error('Denied');stored.delete(key)}}}});
  const safe=createSafeStorage('localStorage');assert.equal(safe.getItem('draft'),'old');
  assert.equal(safe.setItem('draft','new'),false);assert.equal(safe.getItem('draft'),'new');
  assert.equal(safe.removeItem('draft'),false);assert.equal(safe.getItem('draft'),null);
  denied=false;assert.equal(safe.setItem('draft','persisted'),true);assert.equal(stored.get('draft'),'persisted');assert.equal(safe.getItem('draft'),'persisted');
 }finally{Object.defineProperty(globalThis,'window',{configurable:true,value:old})}
});
