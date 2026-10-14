import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_STATE,DEFAULT_PARTNER_BANNER} from '../../packages/pulse-data/model';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
test('Existing CRM gets the referral campaign once without resetting edited or disabled campaigns',async t=>{
 const db=await testDatabase();t.after(()=>db.close());await migrate(db);
 const legacy={...DEFAULT_STATE,banners:[{...DEFAULT_STATE.banners.find(b=>b.id==='b1')!,title:'Наш собственный баннер',enabled:false}]};
 await db.query('update app_config set document=$1::jsonb,version=7',[JSON.stringify(legacy)]);
 await db.query("delete from schema_migrations where name='017_partner_banner.sql'");await migrate(db);
 const row=(await db.query('select document,version from app_config')).rows[0];
 assert.equal(row.version,8);assert.deepEqual(row.document.banners,[legacy.banners[0],DEFAULT_PARTNER_BANNER]);
 await db.query('update app_config set document=$1::jsonb',[JSON.stringify(legacy)]);await migrate(db);
 const removed=(await db.query('select document,version from app_config')).rows[0];assert.deepEqual(removed.document.banners,legacy.banners);assert.equal(removed.version,8,'Removing the campaign after upgrading is authoritative');
});
