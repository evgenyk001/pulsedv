import {test,expect} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {testDatabase} from '../../backend/test/database';
import {migrate} from '../../backend/src/migrate';
import {createApp} from '../../backend/src/app';
import {readConfig} from '../../backend/src/config';
import {hashPassword} from '../../backend/src/security';

test('real browser cookie path protects manager chat attachment',async({browser})=>{
 const db=await testDatabase();await migrate(db);
 const root=await mkdtemp(join(tmpdir(),'pulse-browser-media-'));
 const origin='http://127.0.0.1:14839';
 const app=await createApp(db,readConfig({NODE_ENV:'test',DATABASE_URL:'unused',PUBLIC_ORIGIN:origin,MEDIA_ROOT:root}));
 const context=await browser.newContext();
 try{
  await db.query("insert into team_members(name,email,password_hash,role) values('Owner','browser@example.test',$1,'owner')",[await hashPassword('browser-test-password')]);
  const lead=(await db.query("insert into leads(name,phone,source) values('Client','+79990000000','test') returning id")).rows[0];
  await app.listen({host:'127.0.0.1',port:14839});
  const login=await context.request.post(origin+'/api/v1/control/login',{headers:{origin},data:{email:'browser@example.test',password:'browser-test-password'}});expect(login.status()).toBe(200);
  const upload=await context.request.post(origin+'/api/v1/control/journeys/'+lead.id+'/attachments',{headers:{origin,'content-type':'image/png'},data:await sharp({create:{width:8,height:8,channels:3,background:'red'}}).png().toBuffer()});expect(upload.status()).toBe(200);
  const {attachment}=await upload.json();
  const sent=await context.request.post(origin+'/api/v1/control/journeys/'+lead.id,{headers:{origin},data:{revision:0,command:{type:'message',id:randomUUID(),text:'Photo',attachment}}});expect(sent.status()).toBe(200);
  const page=await context.newPage();
  const privateUrl=origin+attachment.url.replace('/api/v1/journey-media/','/api/v1/control/journey-media/');
  expect((await page.goto(privateUrl))!.status()).toBe(200);
  await expect(page.locator('img')).toBeVisible();
  // The original cookie scope remains narrow; no broadening to fix media access.
  const cookies=await context.cookies();expect(cookies.find(c=>c.name==='pulse_control')?.path).toBe('/api/v1/control');
  const stranger=await browser.newContext();try{expect((await (await stranger.newPage()).goto(privateUrl))!.status()).toBe(401)}finally{await stranger.close()}
 }finally{await context.close();await app.close();await db.close();await rm(root,{recursive:true,force:true})}
});
