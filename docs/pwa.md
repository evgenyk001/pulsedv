# PULSEDV.RU PWA — development branch

The PWA is a separate build of the existing Mini App at `/app/`. It uses the
same Fastify API, PostgreSQL catalog and Control Center. The Telegram Mini App
remains at `/pulsedv/mini-app/`. This branch does not deploy or change `main`.

## Entry and accounts

- Mobile browser: branded installation screen, platform instructions, no catalog
  or login until launched in standalone mode. Android uses the native install
  prompt when available. iPhone shows Safari Share → Add to Home Screen.
- Desktop: opens phone login directly; no extra continue button. Mobile still
  requires standalone launch. Legal pages remain accessible by existing URLs and
  on login, while installation has no extra links or branding header.
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

## Browser application integration

PWA shares property links through the native share sheet (or copies a PWA URL),
without sending users back to Telegram. The native share call runs directly in
the user tap so Safari does not lose its required activation. Published uploaded
PDF presentations download through an authenticated same-origin cookie endpoint;
unverified sessions, draft projects and missing files are rejected. Telegram keeps
its existing bot-delivery behavior.

PWA phone registrations appear in Control together with Telegram registrations.
Saved-search push consent is independent from Telegram consent. Cancelling or
changing the search invalidates pending push deliveries. Account profile shows
the verified phone and optional Telegram connection; badges follow the shared
notification inbox. Session expiry clears private query caches and returns to
phone login. Browser pinch-to-zoom is retained for accessibility.

Telegram announcement settings and Telegram-only biometric enrollment are not
shown as unusable browser switches. The existing partner security gate is kept:
if a customer enabled Telegram biometric protection, browser PWA does not bypass
it. That protected cabinet still requires the existing Telegram unlock/recovery;
browser passkey enrollment is not implemented in this branch. Ordinary customer
catalog, favorites, search, requests, conversations and showing flows use the
same API in PWA. Real SMS and OS push need server configuration and device QA.

Visual review uses the real shared components with separate iPhone and Android
screens, then an isolated synthetic account against the actual API. The fixture
session route exists only in the scratch preview server; no preview login,
platform override or synthetic authentication endpoint ships in production.

Visual baseline: existing Mini App components, typography and spacing are reused.
PWA-specific screens avoid duplicate brand captions and explanatory marketing
copy; installation contains the illustration, title and two platform steps.
Consent and actionable errors remain visible.

## GitHub Pages interface review

`npm run build:pwa:preview` produces a separate static review at
`/pulsedv/pwa-preview/`, with its own manifest identity and service-worker scope.
The source entry is isolated from the production bootstrap and build-guarded.
It uses existing browser-local demonstration data, not a phone-login bypass
in the server application. No SMS, server session, real manager messages or
push delivery are simulated as successful. Do not connect this public preview
to production customer data. The workflow rebuilds the existing main-branch
Pages site and adds the PWA directory, without modifying main or the VPS.
