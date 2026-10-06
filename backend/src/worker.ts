import {refreshStoredScores} from './refreshScores';
import { setTimeout } from 'node:timers/promises';
import { readConfig } from './config';
import { postgresDatabase } from './database';
import { processNotificationOutbox } from './notificationWorker';
import { outboxRepository } from './outboxRepository';
import { runSecurityMaintenance } from './maintenance';
const config=readConfig();const db=postgresDatabase(config.DATABASE_URL);const abort=new AbortController();let nextMaintenance=0;
process.on('SIGTERM',()=>abort.abort());process.on('SIGINT',()=>abort.abort());
try{
 while(!abort.signal.aborted){
  try{
   if(Date.now()>=nextMaintenance){nextMaintenance=Date.now()+6*3600_000;try{const result=await runSecurityMaintenance(db,config);console.log('Security maintenance completed',result)}catch{nextMaintenance=Date.now()+60_000;console.error('Security maintenance failed; will retry')}}
   try{await refreshStoredScores(db)}catch{console.error('Score refresh failed; will retry')}
   // Leave pending messages untouched until Telegram is configured.
   if(config.BOT_TOKEN)await processNotificationOutbox(outboxRepository(db),{async sendMessage(input){
    const response=await fetch(`https://api.telegram.org/bot${config.BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(10000),body:JSON.stringify({chat_id:input.chatId,text:input.text,...(input.deepLink?.startsWith(config.PUBLIC_ORIGIN+'/')?{reply_markup:{inline_keyboard:[[{text:input.deepLink.includes('/control-center/')?'Открыть PULSE Control':'Открыть обращение',url:input.deepLink}]]}}:{})})});
    const result=await response.json() as {ok?:boolean;error_code?:number};
    if(!response.ok||!result.ok)throw new Error(`Telegram delivery failed (${result.error_code??response.status})`);
   }},5);
   await db.query("insert into worker_health(name,updated_at) values('notifications',now()) on conflict(name) do update set updated_at=excluded.updated_at");
  }catch{console.error('Notification batch failed; will retry');}
  await setTimeout(5000,undefined,{signal:abort.signal}).catch(()=>{});
 }
}finally{await db.close();}
