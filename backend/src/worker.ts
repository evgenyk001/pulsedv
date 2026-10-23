import {refreshStoredScores} from './refreshScores';
import {scanSearchProfiles} from './searchRoutes';
import {scheduleShowingReminders} from './showingReminders';
import { setTimeout } from 'node:timers/promises';
import { readConfig } from './config';
import { postgresDatabase } from './database';
import { processNotificationOutbox } from './notificationWorker';
import {telegramSender} from './telegramSender';
import { outboxRepository } from './outboxRepository';
import { runSecurityMaintenance } from './maintenance';
const config=readConfig();const db=postgresDatabase(config.DATABASE_URL);const abort=new AbortController();let nextMaintenance=0,nextReminders=0,nextSearch=0,nextDelivery=0,searchCursor='';
process.on('SIGTERM',()=>abort.abort());process.on('SIGINT',()=>abort.abort());
try{
 while(!abort.signal.aborted){
  try{
   if(Date.now()>=nextMaintenance){nextMaintenance=Date.now()+6*3600_000;try{const result=await runSecurityMaintenance(db,config);console.log('Security maintenance completed',result)}catch{nextMaintenance=Date.now()+60_000;console.error('Security maintenance failed; will retry')}}
   try{await refreshStoredScores(db)}catch{console.error('Score refresh failed; will retry')}
   if(Date.now()>=nextSearch){try{const result=await scanSearchProfiles(db,config.PUBLIC_ORIGIN,new Date(),searchCursor);searchCursor=result.nextCursor;nextSearch=Date.now()+(searchCursor?5000:60000)}catch{console.error('Saved search scan failed; will retry');nextSearch=Date.now()+60000}}
   // Leave pending messages untouched until Telegram is configured.
   if(config.BOT_TOKEN&&Date.now()>=nextReminders){await scheduleShowingReminders(db,config.PUBLIC_ORIGIN);nextReminders=Date.now()+60_000;}
   if(config.BOT_TOKEN&&Date.now()>=nextDelivery){const result=await processNotificationOutbox(outboxRepository(db),telegramSender(config),5);if(result.retryAfterSeconds)nextDelivery=Date.now()+(result.retryAfterSeconds+1)*1000;}
   await db.query("insert into worker_health(name,updated_at) values('notifications',now()) on conflict(name) do update set updated_at=excluded.updated_at");
  }catch{console.error('Notification batch failed; will retry');}
  await setTimeout(5000,undefined,{signal:abort.signal}).catch(()=>{});
 }
}finally{await db.close();}
