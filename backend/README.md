# PULSE.DV backend / Lead Engine

This directory is the production backend foundation for the PULSE.DV lead-generation system.
The current browser-storage adapter in `packages/pulse-data` remains a preview adapter only.

## Runtime flow

```
Telegram Mini App
  -> POST /v1/auth/telegram
  -> POST /v1/events (batched, idempotent)
  -> Postgres user_events
  -> Lead Engine
  -> visitor_profiles / leads / crm_tasks
  -> transactional outbox
  -> Telegram bot notifications
  -> PULSE Control
```

## Identity

The client sends raw Telegram WebApp `initData`.
Only the server verifies it with the bot token. Client-supplied Telegram user ids are never trusted.

A user can have many sessions. Anonymous sessions are allowed. Once Telegram identity or a contact form is available,
the session is linked without discarding the behavioral history accumulated before the lead was created.

## Event ingestion

`POST /v1/events` accepts batches of up to 100 events.

Every event carries:
- a client-generated `idempotencyKey`;
- `sessionId`;
- `eventType`;
- optional entity type/id;
- metadata;
- client occurrence timestamp.

The database has a unique constraint on `idempotency_key`, so retries are safe.
The API returns accepted vs duplicate counts.

Important product events include:
`property_view`, `favorite_add`, `compare_add`, `catalog_filter`,
`mortgage_program`, `mortgage_calculated`, `select_submit`,
`property_share`, `lead_form_open`, `lead_created`.

## Lead Engine

The scoring algorithm is pure TypeScript in `packages/lead-engine`.
Weights and thresholds are stored in Postgres and edited from PULSE Control.

The engine derives:
- Interest Score 0–100;
- cold / warm / hot / urgent priority;
- top property;
- city and mortgage intent;
- explainable score reasons;
- recommended next action.

Anonymous high-intent visitors remain visitor profiles, not fake CRM leads.
A CRM lead is created only when a contact/identity path exists.

## CRM tasks and SLA

When a contactable lead reaches:
- warm: task due in 60 minutes;
- hot: task due in 15 minutes;
- urgent: task due in 5 minutes.

New signals may shorten the deadline, never move it later.
Closed/lost leads do not receive new automated tasks.

Manager routing first prefers active managers matching the city, then lowest open-task load.
More routing dimensions can be added via `routing_rules` without changing the Mini App.

## Reliable notifications

The Lead Engine never calls Telegram directly inside the lead/event transaction.
It writes an `outbox_events` row in the same durable backend flow.

The worker:
1. claims pending outbox rows;
2. resolves manager/user Telegram id;
3. sends the bot message;
4. marks success;
5. retries failures with exponential backoff.

This prevents a temporary Telegram outage from losing a hot-lead alert.

## Production API surface

Planned stable v1 routes:

- `POST /v1/auth/telegram`
- `POST /v1/events`
- `POST /v1/leads`
- `GET /v1/control/leads`
- `PATCH /v1/control/leads/:id`
- `GET /v1/control/profiles`
- `GET /v1/control/tasks`
- `PATCH /v1/control/tasks/:id`
- `GET /v1/control/lead-engine`
- `PUT /v1/control/lead-engine`
- `GET /v1/control/analytics/funnel`

The request/response types live in `packages/api-contracts`.

## Data and privacy

Phone/name are stored on `leads`, not duplicated into every event.
Consent timestamp/version is recorded with the lead.
Raw behavior stays in `user_events`; operational summaries stay in `visitor_profiles`.
Retention windows should be configurable before production launch.

## Migration from preview

No page should know whether data comes from localStorage or Postgres.
The next integration step is to implement a production API adapter with the same domain interfaces already consumed by Mini App and PULSE Control.
