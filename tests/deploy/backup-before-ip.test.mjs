import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,readFile,chmod,rm,readdir} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {spawnSync} from 'node:child_process';
const source=await readFile('deploy/backup-before-ip.sh','utf8');
const docker=`#!/usr/bin/env python3
import sys,os,json,tarfile,io
from pathlib import Path
p=Path(os.environ['STATE']);s=json.loads(p.read_text());a=sys.argv[1:];s['calls'].append(a)
def done(code=0):p.write_text(json.dumps(s));sys.exit(code)
if a[0]=='inspect':print('true');done()
if a[:2]==['image','inspect']:print('{}');done()
if a[0]=='start':
 for x in a[1:]:s['running'][x]=True
 done()
if a[0]=='stop':
 for x in a[3:]:s['running'][x]=False
 done()
if a[0]=='run':print('isolated-check');done()
if a[0]=='rm':done()
if a[0]=='exec':
 if any(x.startswith('pulse-preip-restore-') for x in a):
  if 'pg_restore' in a and os.environ['FAILURE']=='restore':done(43)
  done()
 if 'du'  in a:print('1 /srv/media');done()
 if os.environ['FAILURE']=='media' and '/srv/media' in a:done(42)
 b=io.BytesIO()
 with tarfile.open(fileobj=b,mode='w:gz') as t:
  data=b'fixture';entry=tarfile.TarInfo('fixture.txt');entry.size=len(data);t.addfile(entry,io.BytesIO(data))
 sys.stdout.buffer.write(b.getvalue());done()
if a[0]=='compose':
 if 'ps' in a:print('container-'+a[-1]);done()
 if 'config' in a:print('name: pulsedv');done()
 if 'psql' in a:print('1024');done()
 if 'pg_dump' in a:sys.stdout.buffer.write(b'PGDMP fixture');done()
 if 'pg_restore' in a:sys.stdin.buffer.read();done()
done(90)
`;
for(const failure of ['','media','restore'])test('Pre-IP backup '+(failure||'success')+': resumes existing writers and never recreates services',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pulse-ip-backup-'));try{
 const work=join(root,'repo');await mkdir(work);await mkdir(join(root,'bin'));await mkdir(join(work,'deploy'));await writeFile(join(work,'.env'),'PRIVATE_TEST_TOKEN=keep-private\n');
 const statePath=join(root,'state.json');await writeFile(statePath,JSON.stringify({calls:[],running:{'container-api':true,'container-worker':true,'container-web':true}}));
 const mocks={docker,git:'#!/bin/sh\nprintf "%s\\n" ffffffffffffffffffffffffffffffffffffffff\n',ip:'#!/bin/sh\necho "fixture network"\n',curl:'#!/usr/bin/env python3\nimport sys\nfrom pathlib import Path\na=sys.argv[1:];Path(a[a.index("-o")+1]).write_text(\'{"status":"ready"}\')\n'};
 for(const [name,content] of Object.entries(mocks)){await writeFile(join(root,'bin',name),content);await chmod(join(root,'bin',name),0o755)}
 await writeFile(join(work,'deploy/restore-check.sh'),`#!/bin/sh\n(cd "$1" && sha256sum -c SHA256SUMS) || exit 1\n${failure==='restore'?'exit 43':'echo "isolated restore fixture"'}\n`);
 const script=source.replaceAll('/opt/pulsedv',work).replaceAll('/var/lock/pulsedv-update.lock',join(root,'update.lock')).replaceAll('/var/lock/pulsedv-backup.lock',join(root,'backup.lock')).replaceAll('/root/pulsedv-before-ip.',join(root,'snapshot.')).replaceAll('/root/PULSEDV-before-ip-',join(root,'PULSEDV-before-ip-'));
 await writeFile(join(root,'run.sh'),script);
 const result=spawnSync('bash',[join(root,'run.sh')],{env:{...process.env,PATH:join(root,'bin')+':'+process.env.PATH,STATE:statePath,FAILURE:failure},encoding:'utf8',timeout:30000});
 const state=JSON.parse(await readFile(statePath,'utf8'));assert.equal(state.running['container-api'],true,result.stdout+result.stderr);assert.equal(state.running['container-worker'],true);
 assert.ok(state.calls.some(a=>a[0]==='stop'));assert.ok(state.calls.some(a=>a[0]==='start'));
 assert.ok(!state.calls.some(a=>a.some(v=>['build','up','down','migrate'].includes(v))));
 for(const call of state.calls.filter(a=>a[0]==='rm'))assert.ok(call.at(-1).startsWith('pulse-preip-restore-'));
 if(failure){assert.notEqual(result.status,0);assert.doesNotMatch(result.stdout,/ГОТОВО/)}else{assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/ГОТОВО/);const files=await readdir(root);assert.ok(files.some(f=>f.endsWith('.tar')));assert.ok(files.some(f=>f.endsWith('.sha256')))}
 }finally{await rm(root,{recursive:true,force:true})}
});
