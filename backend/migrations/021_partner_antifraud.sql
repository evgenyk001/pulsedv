-- Opaque browser marks are evidence, never proof of a physical device or identity.
create table antifraud_secret (
 singleton boolean primary key default true check(singleton),
 secret text not null
);
insert into antifraud_secret(singleton,secret) values(true,encode(gen_random_bytes(32),'hex'));
create table antifraud_devices (
 id uuid primary key default gen_random_uuid(),
 token_hash text not null unique,
 created_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now()
);
alter table leads add column antifraud_device_id uuid references antifraud_devices(id) on delete set null;
create index leads_antifraud_device_idx on leads(antifraud_device_id,created_at);
create table antifraud_observations (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references sessions(id) on delete cascade,
 device_id uuid references antifraud_devices(id) on delete set null,
 ip_hash text not null,
 agent_hash text not null,
 first_seen_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 unique(session_id,device_id,ip_hash)
);
create index antifraud_observations_device_idx on antifraud_observations(device_id,last_seen_at);
create index antifraud_observations_ip_idx on antifraud_observations(ip_hash,last_seen_at);
alter table partner_referrals add column antifraud_device_id uuid references antifraud_devices(id) on delete set null;
alter table partner_referrals add column antifraud_ip_hash text;
alter table partner_referrals add column antifraud_initial jsonb;
create table partner_risk_reviews (
 id uuid primary key default gen_random_uuid(),
 referral_id uuid not null references partner_referrals(id),
 stage text not null check(stage in ('accept','finance')),
 fingerprint text not null,
 assessment jsonb not null,
 reviewer_id uuid references team_members(id) on delete set null,
 note text not null,
 created_at timestamptz not null default now()
);
create index partner_risk_reviews_referral_idx on partner_risk_reviews(referral_id,created_at desc);
create table partner_security_attempts (
 id uuid primary key default gen_random_uuid(),
 session_id uuid references sessions(id) on delete set null,
 partner_id uuid references partner_profiles(id) on delete set null,
 reason text not null,
 created_at timestamptz not null default now()
);
create index partner_security_attempts_created_idx on partner_security_attempts(created_at desc);
