import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildSeo,origin} from '../scripts/build-seo.mjs';

test('SEO preserves the entire visible landing and switches discovery between production and preview',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'pulse-seo-'));
 try{
  const original=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
  const body=html=>html.slice(html.indexOf('<body'));
  await writeFile(join(directory,'index.html'),original);
  await buildSeo({directory});
  const production=await readFile(join(directory,'index.html'),'utf8');
  assert.equal(body(production),body(original),'Visible text, elements and links are unchanged');
  assert.equal((production.match(/<title>/g)||[]).length,1);
  assert.equal((production.match(/rel="canonical"/g)||[]).length,1);
  assert.ok(production.includes(`rel="canonical" href="${origin}/"`));
  assert.match(production,/<meta name="robots" content="index,follow,max-image-preview:large">/);
  const structured=JSON.parse(production.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(structured['@context'],'https://schema.org');
  assert.equal(structured['@graph'].find(x=>x['@type']==='WebPage').url,origin+'/');
  const organization=structured['@graph'].find(x=>x['@type']==='Organization');
  assert.deepEqual(organization.areaServed.map(x=>x.name),['Приморский край','Владивосток','Артём','Уссурийск']);
  assert.ok(!organization.address&&!organization.aggregateRating,'No invented offices or reviews');
  const sitemap=await readFile(join(directory,'sitemap.xml'),'utf8');
  assert.equal((sitemap.match(/<loc>/g)||[]).length,1);
  assert.ok(sitemap.includes('<loc>https://pulsedv.ru/</loc>'));
  assert.ok(!/mini-app|control-center|github.io|utm_/.test(sitemap));
  assert.match(await readFile(join(directory,'robots.txt'),'utf8'),/Sitemap: https:\/\/pulsedv.ru\/sitemap.xml/);
  await buildSeo({directory,preview:true});
  const preview=await readFile(join(directory,'index.html'),'utf8');
  assert.match(preview,/content="noindex,follow"/);assert.equal(body(preview),body(original));
  assert.ok(!(await readFile(join(directory,'robots.txt'),'utf8')).includes('Sitemap:'));
  await assert.rejects(readFile(join(directory,'sitemap.xml')),{code:'ENOENT'});
  await buildSeo({directory});
  assert.equal(await readFile(join(directory,'index.html'),'utf8'),production);
  const withTitle=production.replace('</body>','<svg><title>Описание иконки</title></svg></body>');
  await writeFile(join(directory,'index.html'),withTitle);await buildSeo({directory});
  assert.equal(body(await readFile(join(directory,'index.html'),'utf8')),body(withTitle));
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('App and CRM entry documents are excluded from search independently of server headers',async()=>{
 for(const app of ['mini-app','control-center'])assert.match(await readFile(new URL(`../apps/${app}/index.html`,import.meta.url),'utf8'),/name="robots" content="noindex,nofollow"/);
});
