import { createApp } from './app';
import { readConfig } from './config';
import { postgresDatabase } from './database';
const config=readConfig();const db=postgresDatabase(config.DATABASE_URL);
const app=await createApp(db,config);
await app.listen({host:'0.0.0.0',port:config.PORT});
let stopping=false;
async function shutdown(){if(stopping)return;stopping=true;await app.close();await db.close();}
process.on('SIGTERM',()=>void shutdown());process.on('SIGINT',()=>void shutdown());
