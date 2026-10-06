import {readFile} from 'node:fs/promises';
try{
 const at=Number(await readFile('/tmp/pulse-worker-heartbeat','utf8'));
 process.exit(Number.isFinite(at)&&Date.now()-at<120000?0:1);
}catch{process.exit(1);}
