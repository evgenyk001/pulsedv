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
- After installation: consent and phone verification by Flash Call (optional SMS.RU configuration is retained). No Telegram
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

Phone proofs are hashed and session-bound. Flash Call expires in three minutes with three attempts; optional SMS expires in five minutes with five attempts. They
are single-use, and rotate the login token. Quotas apply per phone, IP and a
server-wide daily budget. No code or provider key is sent back to the browser.

## System notifications

User enables notifications in Profile on each device. VAPID Web Push sends
manager/journey updates, giveaway status, showing reminders and saved-search
updates through a separate retry queue. Security codes and private message contents are excluded. Marketing is sent only with separate PWA announcement consent. Notifications open the authenticated
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
Configure Zvonok Flash Call as described below; keep SMS disabled for the chosen call flow. Default global budget is 50 attempts per rolling 24 hours; provider failures also consume quota. This branch neither buys credits nor makes live calls.
Keep VAPID keys stable across deployments; changing them requires subscriptions
to be renewed. API and worker receive all settings through the Compose anchor.
Never use VITE_ variables for OTP secret, SMS key or private VAPID key.

Until configured, the UI explicitly reports phone-login/push unavailability and does not
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

PWA uses its own WebAuthn passkeys for the partner cabinet, independent of
Telegram biometrics. Phone/passkey sessions are tagged on the server; protected
partner endpoints require a short-lived, session-bound key grant. Existing
browser sessions are backfilled into that guard by migration 038. Keys require
user verification (Face ID, fingerprint or device PIN), exact PUBLIC_ORIGIN / RP
hostname, one-time challenges and verified signatures. Grants live in memory,
expire after ten minutes, and lock on background/navigation; payout updates and
key management need a fresh confirmation. Removing keys revokes grants.

First key enrollment needs a phone verified within five minutes. If Telegram
biometric protection is already active, the first PWA key additionally needs an
eight-digit approval from the protected Telegram profile, valid for five minutes
and bound to that phone session. Phone verification alone cannot replace existing protection.
Lost last key requires fresh phone verification and, when enabled, the Telegram approval.
Passkeys can also log into the same account without repeating phone verification. Never change
PUBLIC_ORIGIN casually: passkeys are scoped to its hostname.

Phone entry uses the shared app theme, native telephone keyboard and system
emoji. It confirms the formatted number in a bottom sheet before requesting a verification call.
The next screen supports one-time-code autofill, six-digit submission, editing
the number and server-enforced resend cooldown. No synthetic keyboard is drawn.
Real SMS, physical-device passkey dialogs and OS push still need configured
infrastructure and iPhone/Android acceptance testing.

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

## Channel parity review (migration 039)

| Scenario | Telegram | PWA | Verification |
| --- | --- | --- | --- |
| Account | Signed Telegram identity and own contact | Flash Call, then optional passkey | API identity, merge, token rotation tests |
| Marketing | Explicit bot permission / saved subscription | Separate opt-in; full immutable inbox message, optional image and action | Cross-channel audience, ownership, full text, read/dismiss tests |
| Channel choice | Enabling Telegram marketing switches off PWA marketing | PWA marketing takes priority when enabled | Pending pushes revoked; one recipient per campaign |
| OS permission denied | Bot independent | Inbox still receives announcements | API tests without any push subscription |
| Manager replies / collections | Bot link | Generic private push and shared inbox | Independent queue and inbox tests |
| Showing reminders | Existing bot worker | Due-time queue and current showing validation | No early push, cancellation and live due reminder tests |
| Saved search | Own Telegram consent | Independent push consent | Published-only matches and revocation checks |
| Giveaway | Bot notification and current tickets | Generic push, inbox per ticket, same giveaway page | Shared state; Control shows channel-specific delivery |
| Partner updates | Existing protected cabinet | Generic push to passkey-protected cabinet | Signature/grant tests; no amounts in push payload |
| PDF | Bot document | Authenticated inline PDF viewer; saving/sharing through viewer | Published PDF / anonymous denial Inline/download disposition and anonymous denial API tests |
| Share project / partner invite | Telegram deep link | Same-origin PWA destination and native share | URL helpers and browser navigation |
| First installation from public link | Not applicable | Scoped dynamic manifest keeps public destination, stable `/app/` identity | Allowlist/redirect rejection tests; device acceptance pending |
| Network / updates | Existing Mini App behavior | No private cache; offline fallback and explicit update | Service-worker tests |

PWA announcements are off until the user enables them. This is separate from
permission to display operating-system notifications. Telegram consent remains
saved when PWA is selected; turning PWA off restores the existing Telegram
choice for future campaigns. Enabling Telegram explicitly turns PWA marketing
off. Previously queued work checks current consent before sending. A send
already accepted by an external provider cannot be recalled.

A Control broadcast snapshots its PWA recipients and full content. It counts
an inbox insert as delivered to PWA, not as a push or as a read. Device push
counts are shown separately, because one person may have several devices.
Campaigns work without BOT_TOKEN and without VAPID keys: the inbox still works.
The existing "test in Telegram" button is labelled as such; PWA preview is
available in Control's content preview and can be checked with a synthetic
customer against the API. No live customer campaign was sent during review.
Unsubscribing cancels pending marketing push; existing inbox announcements stay
readable for 180 days. Cancellation does not delete already saved announcements.

The browser review uses disposable synthetic customers, never real phone codes,
real marketing sends or production data. Physical iOS/Android installation,
Safari/Chrome file saving and sharing, real provider SMS/calls, device passkeys,
and background OS push acceptance remain release checks. The current phone
providers are SMS.RU (optional) and Zvonok Flash Call (preferred); neither has been tested with a live customer call here.
Partner offer text/version publication is controlled by the existing legal
configuration; PWA work does not silently republish accepted agreements.

Profile rows use the same GroupedMenu geometry, IconTile materials and Switch component as the Mini App. Passkey enrollment and key removal live in a bottom sheet, reached through the protection switch. Toggling an enrolled key opens management; server protection is never disabled by a cosmetic switch. PWA PDF buttons open the protected `?view=inline` endpoint directly from the click, with no token in the URL and no forced file download.


## Flash Call login (preferred PWA channel)

Enable only after creating a Zvonok Flash Call campaign and testing its delivery:
set server-only `ZVONOK_PUBLIC_KEY`, `ZVONOK_CAMPAIGN_ID`, a random
`PHONE_OTP_SECRET` (at least 32 characters), and `PWA_CALL_LOGIN=true`.
Keep `PWA_SMS_LOGIN=false`. Calls take priority if both flags are enabled;
there is no automatic paid SMS fallback. Compose passes these values to the
backend. Do not put credentials in VITE variables or commit server .env files.

The user confirms their phone, receives an incoming call and enters the last
four digits of its caller number; answering is unnecessary. The server requests
a provider-selected suffix with the official FormData Flash Call endpoint.
The provider pincode stays server-side and is stored only as a keyed hash.
The challenge is bound to the originating session, expires in three minutes,
allows three verification attempts and is consumed once. Resending requires
90 seconds; shared phone quotas are 3/hour and 6/day. CALL_DAILY_LIMIT defaults
to 50 total attempts per rolling day, including failed provider requests.
Account lookup, consent, cookie/token rotation and Telegram identity merging
use the same existing phone-account flow. Call-authenticated sessions cannot
bypass the partner passkey gate; first-key setup requires recent phone proof.

Official API:
https://www.postman.com/zvonok/zvonokcom-s-public-workspace/documentation/32qvk9z/api
POST https://zvonok.com/manager/cabapi_external/api/v1/phones/flashcall/

Automated checks use a synthetic call sender and exercise real database
migrations, wrong digits, expiration, replay, pending/failed delivery, shared
quotas, account continuity and fresh-proof key setup. A funded provider account
and a physical iPhone/Android delivery check are still required before launch.
