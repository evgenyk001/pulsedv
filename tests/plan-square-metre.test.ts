import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planSquareMetreLabel} from '../apps/mini-app/src/helpers/planSquareMetre';
import type {PulseProperty} from '../packages/pulse-data/model';
const plan:PulseProperty['floorplans'][number]={roomLabel:'1',areaFrom:30,areaTo:30,priceFrom:5.13,priceTo:5.13,isExact:true,imageUrl:null,sortOrder:0};
const normalize=(value:string|null)=>value?.replace(/\s/g,' ')??null;
test('Uses the paired exact price and area, including fractional areas and legacy exact bounds',()=>{
 assert.equal(normalize(planSquareMetreLabel(plan)),'171 000 ₽/м²');
 assert.equal(normalize(planSquareMetreLabel({...plan,areaFrom:38.2,areaTo:38.2,priceFrom:6.5322,priceTo:6.5322})),'171 000 ₽/м²');
 assert.equal(normalize(planSquareMetreLabel({...plan,isExact:undefined})),'171 000 ₽/м²');
 assert.equal(normalize(planSquareMetreLabel({...plan,areaTo:null})),'171 000 ₽/м²');
});
test('Starting prices and price ranges retain their uncertainty for a fixed area',()=>{
 assert.equal(normalize(planSquareMetreLabel({...plan,priceTo:null})),'от 171 000 ₽/м²');
 assert.equal(normalize(planSquareMetreLabel({...plan,isExact:false,priceTo:5.4})),'171 000–180 000 ₽/м²');
});
test('Selected finishes use their own prices, without substituting an unknown offer',()=>{
 const withOffers={...plan,finishOptions:[{finishType:'rough' as const,priceFrom:5.13,priceTo:5.13},{finishType:'white_box' as const,priceFrom:5.4,priceTo:5.4},{finishType:'finished' as const,priceFrom:null,priceTo:null}]};
 assert.equal(normalize(planSquareMetreLabel(withOffers,'rough')),'171 000 ₽/м²');
 assert.equal(normalize(planSquareMetreLabel(withOffers,'white_box')),'180 000 ₽/м²');
 assert.equal(planSquareMetreLabel(withOffers,'finished'),null);
 assert.equal(normalize(planSquareMetreLabel(withOffers)),'от 171 000 ₽/м²');
});
test('Unknown, invalid and unpaired ranges never invent a unit price',()=>{
 for(const patch of [{areaFrom:null},{areaFrom:0,areaTo:0},{areaFrom:NaN,areaTo:NaN},{areaTo:50},{isExact:false,areaTo:null},{priceFrom:null},{priceFrom:0},{priceFrom:-1},{priceFrom:Infinity},{priceTo:4}])assert.equal(planSquareMetreLabel({...plan,...patch}),null,JSON.stringify(patch));
});
