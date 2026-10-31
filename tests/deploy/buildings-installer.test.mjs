import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,chmod,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const source=await readFile(resolve('deploy/update-project-buildings.sh'),'utf8');
const selectsSource=await readFile(resolve('deploy/update-control-catalog.sh'),'utf8');
const docker=`#!/usr/bin/env python3
import sys,os,json,gzip
from pathlib import Path
p=Path(os.environ['MOCK_STATE']);s=json.loads(p.read_text());a=sys.argv[1:];failure=os.environ.get('MOCK_FAILURE','')
def save():p.write_text(json.dumps(s))
def emit(value):print(value)
def finish(code=0):save();sys.exit(code)
s['calls'].append(a)
if a[:2]==['image','tag']:
 source,target=a[2:4]
 if target.startswith('sha256:'):finish(91)
 s['refs'][target]=s['refs'].get(source,source);finish()
if a[:2]==['image','inspect']:emit(s['refs'][a[-1]]);finish()
if a[0]=='inspect':
 if '.Config.Image' in a[2]:finish(92)
 emit(s['containers'][a[-1].replace('container-','')]['image']);finish()
if a[0]!='compose':finish(93)
a=a[1:];files=[]
while a and a[0].startswith('-'):
 flag=a.pop(0)
 if flag in ['--project-directory','-f']:
  value=a.pop(0)
  if flag=='-f':files.append(value)
command=a.pop(0)
services=[x for x in a if x in ['api','worker','web']]
if command=='ps':
 service=a[-1]
 if '-a' in a or s['containers'][service]['running']:emit('container-'+service)
 finish()
if command=='start':
 for service in services:s['containers'][service]['running']=True
 finish()
if command=='config':
 config={'name':'pulsedv','services':{x:{'build':{'context':'.'}} for x in s['containers']}}
 if failure=='immutable':config['services']['api']['image']=s['containers']['api']['image']
 emit(json.dumps(config));finish()
if command=='build':
 for index,service in enumerate(services):
  s['refs']['pulsedv-'+service]=s['new'][service]
  if failure=='build' and index==0:finish(41)
 finish()
if command=='stop':
 for service in services:s['containers'][service]['running']=False
 finish()
if command=='run':
 if 'tar' in a:sys.stdout.buffer.write(gzip.compress(b'media archive fixture'));finish()
 if 'backend/src/migrate.ts' in a:
  if failure=='migration':finish(42)
  s['migrated']=True
 finish()
if command=='up':
 override=json.loads(Path(files[-1]).read_text());rollback='rollback-image' in files[-1]
 for service in services:
  ref=override['services'][service]['image'];s['containers'][service]={'image':s['refs'].get(ref,ref),'running':True}
  if failure=='activation' and not rollback:finish(43)
 finish()
if command=='exec':
 if 'pg_dump' in a:sys.stdout.buffer.write(b'PGDMP database fixture');finish()
 if 'pg_restore' in a:sys.stdin.buffer.read();finish()
 if 'cat' in a:emit('.control select option{background-color:#252a31;color:#f2f4f7}' if a[-1].endswith('.css') else '<!doctype html><link href="/pulsedv/control-center/assets/test.css" rel="stylesheet"><script src="/assets/test.js"></script>');finish()
 if 'api' in a and failure=='schema':finish(44)
 finish()
finish(94)
`;
const git=`#!/usr/bin/env python3
import sys,os
from pathlib import Path
a=sys.argv[1:]
if a[0]=='rev-parse':print(os.environ['MOCK_TARGET'])
elif a[0]=='show':print((Path.cwd()/'deploy/Caddyfile').read_text(),end='')
`;
const curl=`#!/usr/bin/env python3
import sys,os
from pathlib import Path
a=sys.argv[1:]
if os.environ.get('MOCK_FAILURE')=='https':sys.exit(22)
url=next(x for x in a if x.startswith('https://'));body='{"status":"ready"}' if url.endswith('/ready') else '.control select option{background-color:#252a31;color:#f2f4f7}\\n' if url.endswith('.css') else '<!doctype html><link href="/pulsedv/control-center/assets/test.css" rel="stylesheet"><script src="/assets/test.js"></script>\\n'
Path(a[a.index('-o')+1]).write_text(body)
`;
for(const [kind,installer] of [['buildings',source],['selects',selectsSource]])for(const failure of kind==='buildings'?['', 'build','migration','activation','schema','https','immutable']:['','build','activation','https'])test(`Installer ${kind}: ${failure||'success'}`,async()=>{
 const root=await mkdtemp(join(tmpdir(),'pulse-installer-'));
 try{
  await mkdir(join(root,'deploy'));await mkdir(join(root,'bin'));await writeFile(join(root,'.env'),'SITE_DOMAIN=pulsedv.ru\n');await writeFile(join(root,'compose.yaml'),'name: pulsedv\n');await writeFile(join(root,'deploy/Caddyfile'),'pulsedv.ru {\n respond "OK"\n}\n');
  const old={api:'sha256:'+'1'.repeat(64),worker:'sha256:'+'2'.repeat(64),web:'sha256:'+'3'.repeat(64)};
  const next={api:'sha256:'+'4'.repeat(64),worker:'sha256:'+'5'.repeat(64),web:'sha256:'+'6'.repeat(64)};
  const state={containers:Object.fromEntries(Object.entries(old).map(([service,image])=>[service,{image,running:kind==='selects'||service==='web'}])),refs:Object.fromEntries(Object.entries(old).map(([service,image])=>['pulsedv-'+service,image])),new:next,calls:[],migrated:false};
  const statePath=join(root,'state.json');await writeFile(statePath,JSON.stringify(state));
  for(const [name,content] of Object.entries({docker,git,curl})){const path=join(root,'bin',name);await writeFile(path,content);await chmod(path,0o700)}
  const script=installer.replaceAll('/opt/pulsedv',root).replaceAll('/var/lock/pulsedv-update.lock',join(root,'update.lock')).replaceAll('/root/pulsedv-buildings-recovery.',join(root,'backup.')).replaceAll('/root/pulsedv-control-catalog.',join(root,'backup.'));
  await writeFile(join(root,'installer.sh'),script);
  const run=spawnSync('bash',[join(root,'installer.sh'),'f'.repeat(40)],{env:{...process.env,PATH:join(root,'bin')+':'+process.env.PATH,MOCK_STATE:statePath,MOCK_TARGET:'f'.repeat(40),MOCK_FAILURE:failure},encoding:'utf8',timeout:30000});
  const final=JSON.parse(await readFile(statePath,'utf8'));
  if(!failure){assert.equal(run.status,0,run.stdout+run.stderr);assert.match(run.stdout,/ГОТОВО/);assert.equal(final.migrated,kind==='buildings');for(const service of Object.keys(old))assert.equal(final.containers[service].image,kind==='buildings'||service==='web'?next[service]:old[service]);}
  else{assert.notEqual(run.status,0);assert.match(run.stdout,/ОШИБКА на этапе:/);assert.doesNotMatch(run.stdout,/ГОТОВО/);for(const service of Object.keys(old)){assert.equal(final.containers[service].image,old[service]);assert.equal(final.refs['pulsedv-'+service],old[service]);}}
  for(const service of Object.keys(old))assert.equal(final.containers[service].running,true,service+' must be running');
  assert.ok(final.calls.some(call=>call.includes('ps')&&call.includes('-a')));
  assert.ok(!final.calls.some(call=>call.join(' ').includes('.Config.Image')));
  const start=final.calls.findIndex(call=>call.includes('start')),build=final.calls.findIndex(call=>call.includes('build'));
  if(build>=0&&kind==='buildings')assert.ok(start<build,'restore service before attempting build');
  if(kind==='selects'){assert.equal(final.migrated,false);for(const service of ['api','worker'])assert.deepEqual(final.containers[service],state.containers[service]);assert.ok(!final.calls.some(call=>['start','stop'].some(command=>call.includes(command))))}
 }finally{await rm(root,{recursive:true,force:true})}
});
