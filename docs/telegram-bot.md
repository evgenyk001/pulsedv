# Telegram entry and fullscreen

The worker handles private `/start`, `/help` and contact messages using Bot API long polling. Keep one worker; a PostgreSQL advisory lock serializes polling during rolling restarts. Do not configure a webhook or run a separate getUpdates consumer for this bot. A configured webhook causes Telegram error 409; remove it only after verifying it is not serving another deployment.

A welcome message offers the user's own contact and a way to browse without sharing a phone. Contact processing rejects missing/mismatched `contact.user_id`, forwarded contacts, groups and expired/missing consent prompts. Phone lives in `app_users.phone`, matched to the same Telegram ID used by signed Mini App authentication. Consent version and timestamps live in `telegram_contact_consent`; this is not marketing subscription consent and creates no lead by itself. Existing notification/MFA delivery stays separate.

The database cursor advances only after successful processing. Messages can repeat if a worker dies after Telegram sends a response but before the transaction commits (at-least-once delivery). Blocked chats (403) do not hold up the queue. Tokens, contact values and incoming message text are not logged.

Deploy from the reviewed commit, preserving the existing VPS `.env` and Caddy diagnostics/config:

```sh
docker compose build api worker web
docker compose run --rm -T --no-deps api node --import tsx backend/src/migrate.ts
docker compose run --rm -T --no-deps api node --import tsx backend/src/setupTelegramBot.ts
docker compose up -d --wait --wait-timeout 180
```

Do not rebuild web from a pristine Caddyfile over local VPS changes without reviewing them. Run database migration before starting the updated API/worker. Test `/start`, rejection of another contact, skip, own contact, repeat `/start`, and Mini App login. Restart worker and check the processed cursor persists. Never paste `.env`, Bot API URLs containing a token, or phone data into troubleshooting logs.

Mini App calls `requestFullscreen()` on supported authenticated Telegram clients, once per WebApp instance, with `expand()` as the fallback. Existing Telegram safe-area CSS keeps content clear of the notch and Telegram controls. Ordinary browsers are unaffected. Mock/browser tests do not prove real-device fullscreen: check on Telegram iOS and Android after deployment.
