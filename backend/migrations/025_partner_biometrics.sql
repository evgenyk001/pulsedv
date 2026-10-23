create table partner_biometric_credentials (
 user_id uuid primary key references app_users(id) on delete cascade,
 device_hash text not null,
 token_hash text not null,
 active boolean not null default false,
 revision uuid not null default gen_random_uuid(),
 created_at timestamptz not null default now()
);
create table partner_biometric_grants (
 token_hash text primary key,
 user_id uuid not null references app_users(id) on delete cascade,
 session_id uuid not null references sessions(id) on delete cascade,
 revision uuid not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null
);
create index partner_biometric_grant_owner on partner_biometric_grants(user_id);
create table partner_biometric_recovery (
 user_id uuid primary key references app_users(id) on delete cascade,
 id uuid not null default gen_random_uuid(),
 session_id uuid not null references sessions(id) on delete cascade,
 code_hash text not null,
 attempts integer not null default 0,
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
