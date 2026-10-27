# Telegram entry and fullscreen

The worker handles private `/start`, `/help` and contact messages using Bot API long polling. Keep one worker; a PostgreSQL advisory lock serializes polling during rolling restarts. Do not configure a webhook or run a separate getUpdates consumer for this bot. A configured webhook causes Telegram error 409; remove it only after verifying it is not serving another deployment.

The welcome message uses inline buttons for entry and legal documents. In VPS mode a server-verified own contact is mandatory; there is no skip path. The Mini App uses Telegram requestContact after explicit consent, then waits until the worker persists the contact. A client callback or client-submitted phone is never proof. Contact processing rejects missing/mismatched `contact.user_id`, forwarded contacts, groups and expired/missing consent prompts. Phone lives in `app_users.phone`, matched to the same Telegram ID used by signed Mini App authentication. Consent version and timestamps live in `telegram_contact_consent`; this is not marketing subscription consent and creates no lead by itself. Existing notification/MFA delivery stays separate.

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

## Required registration

Compose enables `REQUIRE_TELEGRAM_PHONE=true` by default; config parsing defaults to false for existing development/test fixtures. GitHub Pages remains a local demo. The server rejects private `/me` operations and lead submission until the signed account has an accepted Telegram contact. Public published catalog metadata and legal documents remain public API data; phone registration is not a confidentiality boundary around published listings. Legal documents stay readable before registration. Direct links and old bot menu buttons render the registration gate. Existing verified contacts remain valid.

Control → «Посетители и интерес» contains an owner/admin-only registered-client list with name, phone, Telegram ID/username and confirmation time. It is paginated and searchable. Registration creates no artificial lead. Managers do not receive this global contact directory.

The Compose reliability smoke keeps anonymous CRM fixture mode (`REQUIRE_TELEGRAM_PHONE=false`) because it has no live Telegram bot. Mandatory registration is separately tested with signed initData and real SQL in account-registration.test.ts, plus API-mode browser tests on Chromium and WebKit.

### Анонсы и работа при потере связи

С версии с миграцией `029_announcement_defaults.sql` анонсы включены для Telegram-аккаунтов без сохранённой настройки. Миграция добавляет отсутствующие подписки; повторный вход и `/start` создают настройку только при её отсутствии. Явное отключение не сбрасывается. Настройка сохраняется на сервере и действует на всех устройствах. Само обновление не отправляет рассылку.

В мини-приложении ошибки фонового чтения не добавляют текстовые баннеры поверх уже загруженного содержимого. Для первой неудачной загрузки есть единая кнопка повтора; чтения повторяются при восстановлении сети. Избранное сохраняет очередь изменений и синхронизирует её после восстановления связи. Ошибки действий (заявка, сообщение, изменение настроек) остаются видимыми и не подменяются сообщением об успехе. Подробности сетевых и серверных ошибок доступны диагностике, а пользователю выводится короткое сообщение без технических данных.
