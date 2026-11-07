alter table sessions add column auth_provider text not null default 'legacy' check(auth_provider in ('legacy','sms','telegram','passkey'));
alter table sessions add column phone_verified_at timestamptz;
create table pwa_passkey_users (
 user_id uuid primary key references app_users(id) on delete cascade,
 handle text not null unique, revision uuid not null default gen_random_uuid()
);
create table pwa_passkeys (
 id text primary key, user_id uuid not null references pwa_passkey_users(user_id) on delete cascade,
 public_key text not null, counter bigint not null default 0, transports jsonb not null default '[]',
 name text not null default 'Ключ доступа', created_at timestamptz not null default now(), last_used_at timestamptz
);
create index pwa_passkey_owner on pwa_passkeys(user_id);
create table pwa_passkey_challenges (
 id uuid primary key, session_id uuid not null references sessions(id) on delete cascade,
 user_id uuid references app_users(id) on delete cascade,
 kind text not null check(kind in ('registration','unlock','login')),
 challenge text not null, guard_revision uuid, legacy_revision uuid, expires_at timestamptz not null default now()+interval '5 minutes',
 used_at timestamptz, created_at timestamptz not null default now()
);
create index pwa_challenge_session on pwa_passkey_challenges(session_id,created_at);
create table pwa_passkey_grants (
 token_hash text primary key, user_id uuid not null references pwa_passkey_users(user_id) on delete cascade,
 session_id uuid not null references sessions(id) on delete cascade, revision uuid not null,
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '10 minutes'
);
create table pwa_legacy_approvals (
 user_id uuid primary key references app_users(id) on delete cascade, id uuid not null,
 code_hash text not null, revision uuid not null, attempts integer not null default 0,
 approved_session_id uuid references sessions(id) on delete cascade,
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '5 minutes'
);
-- Previously issued browser sessions must not inherit the legacy Telegram path.
update sessions s set auth_provider='sms' where s.user_id in (select user_id from phone_registrations);
