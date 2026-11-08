// Run on the target server; secrets remain in a new mode-0600 file.
import {randomBytes} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {generateVAPIDKeys} from 'web-push';
const target=resolve(process.argv[2]||'.env.pwa');
const keys=generateVAPIDKeys();
writeFileSync(target,`# Merge into the server .env without replacing existing settings.\nPWA_CALL_LOGIN=false\nZVONOK_PUBLIC_KEY=\nZVONOK_CAMPAIGN_ID=\nCALL_DAILY_LIMIT=50\nPWA_SMS_LOGIN=false\nSMS_RU_API_ID=\nPHONE_OTP_SECRET=${randomBytes(48).toString('base64url')}\nSMS_DAILY_LIMIT=50\nWEB_PUSH_PUBLIC_KEY=${keys.publicKey}\nWEB_PUSH_PRIVATE_KEY=${keys.privateKey}\nWEB_PUSH_SUBJECT=mailto:pulsedv@mail.ru\n`,{mode:0o600,flag:'wx'});
console.log('PWA configuration saved. Existing files were not overwritten. Keep this file private.');
