# PULSEDV.RU PWA — development branch

The PWA is a separate build of the existing Mini App at `/app/`. It uses the
same Fastify API, PostgreSQL catalog and Control Center. The Telegram Mini App
remains at `/pulsedv/mini-app/`. This branch does not deploy or change `main`.

## Entry and accounts

- Mobile browser: branded installation screen, platform instructions, no catalog
  or login until launched in standalone mode. Android uses the native install
  prompt when available. iPhone shows Safari Share → Add to Home Screen.
- Desktop: installation is required too; there is no bypass/continue button.
  Legal pages remain accessible by their existing URLs and on the login screen,
  but the installation screen has no extra links or branding header.
- After installation: consent and a phone code delivered by SMS.RU. No Telegram
  connection is required to log into PWA.
- A previously verified Telegram phone resolves to the existing account. If PWA
  came first, sharing the same own contact with the bot attaches a fresh Telegram
  account to it. Favorites, searches, conversations and applications use their
  existing server records. Catalog edits are common to both builds.
- Two established conflicting identities are never silently merged; a conflict
  requires support. Old duplicate phone records are preserved, not guessed.
- Calculator input/history and other existing device-local UI preferences remain
  device-local. This does not duplicate catalog, customer or transaction data.
- Installation detection is a UX gate, not server authentication. The server
  verifies the phone independently. Public catalog API behavior is unchanged.

SMS codes are hashed, session-bound, expire in five minutes, allow five attempts,
are single-use, and rotate the login token. Quotas apply per phone, IP and a
server-wide daily budget. No code or provider key is sent back to the browser.

## System notifications

User enables notifications in Profile on each device. VAPID Web Push sends
manager/journey updates, giveaway status, showing reminders and saved-search
updates through a separate retry queue. Security codes, marketing broadcasts and
private message contents are excluded. Notifications open the authenticated
relevant screen. Expired device subscriptions are removed automatically.

Delivery depends on OS support, permission, connectivity and battery settings;
this is not a guaranteed real-time channel. On iPhone/iPad Web Push requires an
installed Home Screen app and supported OS (iOS/iPadOS 16.4+). The permission
request is issued only after a user tap. There is no background GPS or silent
push tracking. Existing announcements/marketing consent is not automatically
converted into browser push consent.

Sources: [WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/),
[SMS.RU API](https://sms.ru/docs/api/api_group_sms/send).

## Build and configuration

```
npm ci
npm run check --workspaces
VITE_PULSE_MODE=api npm run build
```

Outputs: existing Mini App, Control Center and `dist/pwa`. The web Dockerfile
already copies the complete `dist` output; Caddy serves `/app/` with fresh entry,
manifest and service-worker responses. Production requires HTTPS.

New backend migration: `037_pwa.sql`. API and worker must be updated together
with web; a web-only update is insufficient. Use the existing deployment backup,
migration and health-check procedure. Do not drop migration tables to roll back;
disable `PWA_SMS_LOGIN` and retain records.

Generate secrets **on the target server** (not in source control):

```
node scripts/generate-pwa-config.mjs
```

This creates a new private `.env.pwa` without overwriting an existing file or
printing secrets. Merge the generated settings into the existing server `.env`.
Configure `SMS_RU_API_ID` using an actual SMS.RU account, verify sender/balance,
set `PWA_SMS_LOGIN=true` only after a test SMS succeeds. Default global budget is
50 attempts per rolling 24 hours; provider failures also consume quota. SMS is a
paid provider service; this branch neither buys credits nor sends real messages.
Keep VAPID keys stable across deployments; changing them requires subscriptions
to be renewed. API and worker receive all settings through the Compose anchor.
Never use VITE_ variables for OTP secret, SMS key or private VAPID key.

Until configured, the UI explicitly reports SMS/push unavailability and does not
fake a successful login or subscription. Existing Telegram login is unaffected.

## Offline and updates

Only public hashed JS/CSS/fonts, app icon and the offline fallback are cached.
API responses, media, token data and personalized HTML are never cached by the
service worker. There is an honest offline screen; prices/actions require a
connection. An update is applied after a user tap so an open form is not silently
reloaded. Quick actions in the manifest open Catalog, Favorites and Mortgage.

## Verification and release gate

Automated API tests cover both identity directions, OTP abuse/replay/session
ownership, token revocation, push recipient isolation, SSRF endpoint rejection,
private payloads and expired subscriptions. The complete existing backend suite
also passes. Browser review at 390px covers installation and phone-entry layout.
The isolated test sender never calls a real SMS provider.

Before public launch, verify on physical iPhone and Android: installation from
external browser (including links opened from Telegram), standalone relaunch,
real SMS and existing-account history, push permission/delivery while closed,
notification routing, logout/switching account, offline fallback, and updating
with an open form. Actual OS delivery and real SMS have not been verified here.
