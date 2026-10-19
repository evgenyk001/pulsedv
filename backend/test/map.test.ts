import {test} from 'node:test';
import assert from 'node:assert/strict';
import {configuredMap} from '../../packages/pulse-data/mapConfig';
import {createApp} from '../src/app';
import {readConfig} from '../src/config';
import {testDatabase} from './database';

test('Map configuration prefers Yandex, preserves explicit 2GIS fallback and rejects blank keys',()=>{
 assert.deepEqual(configuredMap({yandex:' yandex-browser ',twoGis:'2gis-browser'}),{provider:'yandex',key:'yandex-browser'});
 assert.deepEqual(configuredMap({yandex:' ',twoGis:' 2gis-browser '}),{provider:'2gis',key:'2gis-browser'});
 assert.equal(configuredMap({yandex:' ',twoGis:' '}),null);
});

test('Public map endpoint exposes only selected browser key and returns 503 when unconfigured',async t=>{
 const db=await testDatabase();t.after(()=>db.close());
 for(const [keys,expected] of [
  [{MAP_YANDEX_KEY:'yandex-browser',MAP_2GIS_KEY:'2gis-browser'},{provider:'yandex',key:'yandex-browser'}],
  [{MAP_YANDEX_KEY:'',MAP_2GIS_KEY:'2gis-browser'},{provider:'2gis',key:'2gis-browser'}],
  [{MAP_YANDEX_KEY:'',MAP_2GIS_KEY:''},null],
 ] as const){
  const app=await createApp(db,readConfig({DATABASE_URL:'unused',NODE_ENV:'test',BOT_TOKEN:'private-bot-token',...keys}));
  try{
   const response=await app.inject('/api/v1/public/map');
   assert.equal(response.statusCode,expected?200:503);
   if(expected)assert.deepEqual(response.json(),expected);
   assert.ok(!response.body.includes('private-bot-token'));
  }finally{await app.close();}
 }
});
