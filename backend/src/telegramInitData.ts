import { createHmac, timingSafeEqual } from "node:crypto";

export type TelegramWebAppUser={
  id:number;
  is_bot?:boolean;
  first_name:string;
  last_name?:string;
  username?:string;
  language_code?:string;
  is_premium?:boolean;
};

export type VerifiedTelegramInitData={
  user:TelegramWebAppUser|null;
  authDate:Date;
  queryId:string|null;
  startParam:string|null;
};

function safeEqualHex(a:string,b:string){
  if(a.length!==b.length)return false;
  const left=Buffer.from(a,"hex");
  const right=Buffer.from(b,"hex");
  return left.length===right.length&&timingSafeEqual(left,right);
}

export function verifyTelegramInitData(
  initData:string,
  botToken:string,
  options:{maxAgeSeconds?:number;now?:Date}={}
):VerifiedTelegramInitData{
  if(!botToken)throw new Error("Telegram bot token is not configured");
  const params=new URLSearchParams(initData);
  const hash=params.get("hash");
  if(!hash)throw new Error("Telegram initData hash is missing");

  const dataCheckString=[...params.entries()]
    .filter(([key])=>key!=="hash")
    .sort(([a],[b])=>a.localeCompare(b))
    .map(([key,value])=>`${key}=${value}`)
    .join("\n");

  const secretKey=createHmac("sha256","WebAppData").update(botToken).digest();
  const calculated=createHmac("sha256",secretKey).update(dataCheckString).digest("hex");
  if(!safeEqualHex(hash,calculated))throw new Error("Telegram initData signature is invalid");

  const authDateRaw=params.get("auth_date");
  const authDateUnix=Number(authDateRaw);
  if(!Number.isFinite(authDateUnix)||authDateUnix<=0)throw new Error("Telegram auth_date is invalid");

  const now=options.now??new Date();
  const maxAgeSeconds=options.maxAgeSeconds??3600;
  const ageSeconds=Math.floor(now.getTime()/1000)-authDateUnix;
  if(ageSeconds< -60||ageSeconds>maxAgeSeconds)throw new Error("Telegram initData is expired");

  let user:TelegramWebAppUser|null=null;
  const userRaw=params.get("user");
  if(userRaw){
    try{user=JSON.parse(userRaw) as TelegramWebAppUser}
    catch{throw new Error("Telegram user payload is invalid")}
  }

  return{
    user,
    authDate:new Date(authDateUnix*1000),
    queryId:params.get("query_id"),
    startParam:params.get("start_param"),
  };
}
