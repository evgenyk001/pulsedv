# PULSE API

Рабочая реализация Fastify + PostgreSQL. Инструкция VPS: [deploy/README.md](../deploy/README.md).

## Запуск

Переменные окружения: `DATABASE_URL`, `PUBLIC_ORIGIN`, `NODE_ENV`, необязательные `BOT_TOKEN`, `MAP_2GIS_KEY`, `CONSENT_VERSION`, `TRUST_PROXY_HOPS`.

```sh
node --import tsx backend/src/migrate.ts
# OWNER_EMAIL и OWNER_PASSWORD передаются только через окружение
node --import tsx backend/src/bootstrap.ts
node --import tsx backend/src/server.ts
node --import tsx backend/src/worker.ts
```

Bootstrap создаёт первого владельца, не сбрасывает пароли существующих пользователей. Пароль минимум 14 символов. Хранение паролей: scrypt; токены в БД хранятся хешированными. Cookie сотрудников HttpOnly, SameSite Strict, Secure в production. CORS для сторонних сайтов не включён. API и фронтенд размещаются на одном origin.

## Маршруты

Префикс `/api/v1`:

- `GET /public/state`, `GET /public/map` — опубликованный каталог и настройка карты.
- `POST /auth/session` — серверная сессия посетителя с Bearer-токеном.
- `POST /auth/telegram` — проверка подписи и возраста initData, привязка истории.
- `POST /events` — до 100 событий с дедупликацией и фильтрацией metadata. `lead_created` создаёт только сервер.
- `POST /leads` — нормализованный телефон, согласие, версия согласия, idempotencyKey; транзакция заявки, событий, задач и outbox.
- `POST /control/login`, `GET /control/me`, `POST /control/logout`, `POST /control/password` — сессии сотрудников.
- `GET /control/snapshot` — данные CRM; менеджер видит только свои назначенные заявки и задачи.
- `PUT /control/state` — сохранение конфигурации с версией; owner/admin.
- `PATCH /control/leads/:id`, `PATCH /control/tasks/:id` — изменения с expectedUpdatedAt; конфликт возвращает 409.
- `POST /control/members`, `PATCH /control/members/:id` — управление сотрудниками; owner.
- `GET /control/audit`, `POST /control/notifications/:id/retry` — аудит и повтор доставки; owner/admin.

`/health` проверяет процесс; `/ready` — доступность БД. Актуальные схемы находятся в `src/validation.ts` и `src/app.ts`; `packages/api-contracts` содержит исходные доменные типы.

## Обработка

Скоринг учитывает события за 30 дней. Анонимный интерес сам по себе не создаёт CRM-заявку. Закрытые заявки не получают новые автоматические задачи. Worker забирает outbox через SKIP LOCKED с арендой и повторяет доставку с задержкой, максимум 8 попыток. Доставка at-least-once: при сбое после приёма сообщения Telegram возможен дубль. Исчерпанные попытки видны в Control, доступен ручной повтор.

Snapshot ограничен 1000 заявок/задач/профилей и 2000 событий; интерфейс сообщает об ограничении. Для большого объёма нужны серверная пагинация и агрегаты. Срок хранения и автоматическая очистка требуют отдельной настройки перед эксплуатацией.
