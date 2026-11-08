import { z } from 'zod';
const schema=z.object({
  NODE_ENV:z.enum(['development','test','production']).default('development'),
  DATABASE_URL:z.string().min(1),
  PORT:z.coerce.number().int().min(1).max(65535).default(3000),
  PUBLIC_ORIGIN:z.url().default('http://localhost:8080'),
  BOT_TOKEN:z.string().default(''),
  PWA_CALL_LOGIN:z.enum(['true','false']).default('false').transform(v=>v==='true'),
  ZVONOK_PUBLIC_KEY:z.string().default(''),
  ZVONOK_CAMPAIGN_ID:z.string().regex(/^\d*$/).default(''),
  CALL_DAILY_LIMIT:z.coerce.number().int().min(1).max(1000).default(50),
  PWA_SMS_LOGIN:z.enum(['true','false']).default('false').transform(v=>v==='true'),
  SMS_RU_API_ID:z.string().default(''),
  SMS_RU_FROM:z.string().default(''),
  PHONE_OTP_SECRET:z.string().default(''),
  SMS_DAILY_LIMIT:z.coerce.number().int().min(1).max(1000).default(50),
  WEB_PUSH_PUBLIC_KEY:z.string().default(''),
  WEB_PUSH_PRIVATE_KEY:z.string().default(''),
  WEB_PUSH_SUBJECT:z.string().default('mailto:pulsedv@mail.ru'),
  REQUIRE_TELEGRAM_PHONE:z.enum(['true','false']).default('false').transform(v=>v==='true'),
  TELEGRAM_BOT_USERNAME:z.string().regex(/^[a-zA-Z0-9_]{5,32}$/).default('pulsedvbot'),
  MAP_YANDEX_KEY:z.string().trim().default(''),
  MAP_2GIS_KEY:z.string().trim().default(''),
  TRUST_PROXY_HOPS:z.coerce.number().int().min(0).max(3).default(0),
  LEGAL_OPERATOR_NAME:z.string().trim().max(300).default(''),
  LEGAL_OPERATOR_INN:z.string().trim().max(12).default(''),
  LEGAL_CONTACT_EMAIL:z.union([z.email(),z.literal('')]).default(''),
  LEGAL_OPERATOR_ADDRESS:z.string().trim().max(500).default(''),
  LEGAL_OPERATOR_REGISTRATION:z.string().trim().max(15).default(''),
  PARTNER_OFFER_APPROVED_VERSION:z.string().default(''),
  PARTNER_OFFER_PUBLISHED:z.enum(['true','false']).default('false').transform(v=>v==='true'),
  CONSENT_VERSION:z.string().default('2026-09-29'),
  MEDIA_ROOT:z.string().min(1).default('/data/media'),
  CLIENT_DATA_RETENTION_DAYS:z.coerce.number().int().min(30).max(3650).default(365),
  ANALYTICS_RETENTION_DAYS:z.coerce.number().int().min(30).max(3650).default(180),
  AUDIT_RETENTION_DAYS:z.coerce.number().int().min(30).max(3650).default(365),
  OUTBOX_RETENTION_DAYS:z.coerce.number().int().min(7).max(3650).default(30),
});
export type RuntimeConfig=z.infer<typeof schema>;
export function readConfig(env:NodeJS.ProcessEnv=process.env){
  const config=schema.parse(env);
  if(config.NODE_ENV==='production'&&!config.PUBLIC_ORIGIN.startsWith('https://'))throw new Error('Production PUBLIC_ORIGIN must use HTTPS');
  if(new URL(config.PUBLIC_ORIGIN).origin!==config.PUBLIC_ORIGIN)throw new Error('PUBLIC_ORIGIN must be an origin without path or trailing slash');
  if(config.PWA_CALL_LOGIN&&(!config.ZVONOK_PUBLIC_KEY||!config.ZVONOK_CAMPAIGN_ID||config.PHONE_OTP_SECRET.length<32))throw new Error('Call login requires Zvonok key, campaign ID and a PHONE_OTP_SECRET of at least 32 characters');
  if(!config.PWA_CALL_LOGIN&&config.PWA_SMS_LOGIN&&(!config.SMS_RU_API_ID||config.PHONE_OTP_SECRET.length<32))throw new Error('SMS login requires provider API ID and a PHONE_OTP_SECRET of at least 32 characters');
  if(!!config.WEB_PUSH_PUBLIC_KEY!==!!config.WEB_PUSH_PRIVATE_KEY)throw new Error('Configure both Web Push VAPID keys');
  return config;
}
