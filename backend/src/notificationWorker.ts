export type OutboxRecord={
  id:string;
  topic:string;
  aggregateType:string;
  aggregateId:string|null;
  payload:Record<string,unknown>;
  attempts:number;
};

export type NotificationOutboxRepository={
  claimBatch(limit:number):Promise<OutboxRecord[]>;
  managerTelegramUserId(managerId:string):Promise<string|null>;
  userTelegramUserId(userId:string):Promise<string|null>;
  markProcessed(id:string):Promise<void>;
  markFailed(id:string,error:string,nextAttemptAt:string):Promise<void>;
};

export type TelegramBotSender={
  sendMessage(input:{chatId:string;text:string;deepLink?:string|null}):Promise<void>;
};

function asString(value:unknown){
  return typeof value==="string"?value:null;
}

function managerText(event:OutboxRecord){
  const score=event.payload.score??"—";
  const priority=event.payload.priority??"new";
  const city=event.payload.city??"—";
  const action=event.payload.nextAction??"Открыть лид в PULSE Control";
  return `PULSE.DV · ${String(priority).toUpperCase()}\nScore: ${score}\nГород: ${city}\n${action}`;
}

function userText(event:OutboxRecord){
  const title=asString(event.payload.title)??"PULSE.DV";
  const body=asString(event.payload.body)??"Есть обновление по вашему подбору.";
  return `${title}\n${body}`;
}

function retryAt(attempts:number){
  const seconds=Math.min(3600,Math.max(30,30*Math.pow(2,attempts)));
  return new Date(Date.now()+seconds*1000).toISOString();
}

export async function processNotificationOutbox(
  repo:NotificationOutboxRepository,
  telegram:TelegramBotSender,
  limit=25
){
  const batch=await repo.claimBatch(limit);
  let processed=0;

  for(const event of batch){
    try{
      if(event.topic.startsWith("manager.")){
        const managerId=asString(event.payload.managerId);
        if(!managerId)throw new Error("managerId missing");
        const chatId=await repo.managerTelegramUserId(managerId);
        if(!chatId)throw new Error("manager Telegram id missing");
        await telegram.sendMessage({
          chatId,
          text:managerText(event),
          deepLink:asString(event.payload.deepLink),
        });
      }else if(event.topic.startsWith("user.")){
        const userId=asString(event.payload.userId);
        if(!userId)throw new Error("userId missing");
        const chatId=await repo.userTelegramUserId(userId);
        if(!chatId)throw new Error("user Telegram id missing");
        await telegram.sendMessage({
          chatId,
          text:userText(event),
          deepLink:asString(event.payload.deepLink),
        });
      }else{
        throw new Error("unsupported outbox topic: "+event.topic);
      }

      await repo.markProcessed(event.id);
      processed++;
    }catch(error){
      const message=error instanceof Error?error.message:String(error);
      await repo.markFailed(event.id,message,retryAt(event.attempts));
    }
  }

  return{claimed:batch.length,processed};
}
