alter table team_members add column if not exists email text;
alter table team_members add column if not exists password_hash text;
create unique index if not exists team_email_unique on team_members(lower(email)) where email is not null;
create table if not exists auth_tokens (
  token_hash text primary key,
  kind text not null check(kind in ('visitor','control')),
  session_id uuid references sessions(id) on delete cascade,
  member_id uuid references team_members(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check ((kind='visitor' and session_id is not null and member_id is null) or
         (kind='control' and member_id is not null and session_id is null))
);
create index if not exists auth_tokens_expiry on auth_tokens(expires_at);
create table if not exists app_config (
  singleton boolean primary key default true check(singleton),
  document jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table leads add column if not exists idempotency_key text;
create unique index if not exists leads_idempotency_unique on leads(session_id,idempotency_key);
alter table outbox_events add column if not exists locked_until timestamptz;
alter table outbox_events add column if not exists lock_token uuid;
alter table outbox_events add column if not exists dead_at timestamptz;
create table if not exists audit_log (
  id bigserial primary key,
  member_id uuid references team_members(id) on delete set null,
  action text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
