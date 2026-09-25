import { z } from 'zod';
const schema=z.object({
  NODE_ENV:z.enum(['development','test','production']).default('development'),
  DATABASE_URL:z.string().min(1),
  PORT:z.coerce.number().int().min(1).max(65535).default(3000),
  PUBLIC_ORIGIN:z.url().default('http://localhost:8080'),
  BOT_TOKEN:z.string().default(''),
  MAP_2GIS_KEY:z.string().default(''),
  TRUST_PROXY_HOPS:z.coerce.number().int().min(0).max(3).default(0),
  CONSENT_VERSION:z.string().default('2026-09-25'),
});
export type RuntimeConfig=z.infer<typeof schema>;
export function readConfig(env:NodeJS.ProcessEnv=process.env){
  const config=schema.parse(env);
  if(config.NODE_ENV==='production'&&!config.PUBLIC_ORIGIN.startsWith('https://'))throw new Error('Production PUBLIC_ORIGIN must use HTTPS');
  if(new URL(config.PUBLIC_ORIGIN).origin!==config.PUBLIC_ORIGIN)throw new Error('PUBLIC_ORIGIN must be an origin without path or trailing slash');
  return config;
}
