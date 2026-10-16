import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readConfig} from '../src/config';
import {deploymentIssues} from '../src/deploymentReadiness';
import {PARTNER_TERMS_VERSION} from '../../packages/partners/model';
import {testDatabase} from './database';
import {migrate} from '../src/migrate';
import {createApp} from '../src/app';

const complete={NODE_ENV:'production',PUBLIC_ORIGIN:'https://pulse-real.ru',DATABASE_URL:'postgres://pulse:W8zR6vB4aT2yK9xQ7mN5dF3sH1cJ0uE6@db/pulse',BOT_TOKEN:'123456789:abcdefghijklmnopqrstuvwxyz12345',MAP_2GIS_KEY:'restricted-key',LEGAL_OPERATOR_NAME:'Оператор',LEGAL_OPERATOR_INN:'251105827238',LEGAL_OPERATOR_ADDRESS:'Адрес',LEGAL_CONTACT_EMAIL:'ops@example.ru',LEGAL_OPERATOR_REGISTRATION:'324253600041443',PARTNER_OFFER_PUBLISHED:'true',PARTNER_OFFER_APPROVED_VERSION:PARTNER_TERMS_VERSION};
test('Deployment gate catches placeholders and incomplete integrations without exposing secrets',()=>{
 assert.deepEqual(deploymentIssues(readConfig(complete)),[]);
 const issues=deploymentIssues(readConfig({...complete,PUBLIC_ORIGIN:'https://pulse.example.com',DATABASE_URL:'postgres://pulse:replace-with-a-long-random-url-safe-password@db/pulse',BOT_TOKEN:'',MAP_2GIS_KEY:'',LEGAL_CONTACT_EMAIL:'',PARTNER_OFFER_APPROVED_VERSION:'old'}));
 assert.ok(issues.filter(i=>i.level==='error').length>=6);
 assert.ok(!JSON.stringify(issues).includes('postgres://'));
 const unpublished=deploymentIssues(readConfig({...complete,PARTNER_OFFER_PUBLISHED:'false'}));
 assert.equal(unpublished.length,1);assert.equal(unpublished[0].level,'warning');
});
test('Readiness rejects an available database with unapplied migrations',async t=>{
 const db=await testDatabase();await migrate(db);
 const app=await createApp(db,readConfig({DATABASE_URL:'unused',NODE_ENV:'test'}));
 t.after(async()=>{await app.close();await db.close()});
 assert.equal((await app.inject('/ready')).statusCode,200);
 const row=(await db.query('select name from schema_migrations order by name desc limit 1')).rows[0];
 await db.query('delete from schema_migrations where name=$1',[row.name]);
 assert.equal((await app.inject('/ready')).statusCode,503);
 await db.query('insert into schema_migrations(name) values($1)',[row.name]);
 assert.equal((await app.inject('/ready')).statusCode,200);
});
