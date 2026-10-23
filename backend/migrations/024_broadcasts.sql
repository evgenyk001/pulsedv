create table announcement_subscriptions (
 user_id uuid primary key references app_users(id) on delete cascade,
 enabled boolean not null default false,
 consent_key uuid not null default gen_random_uuid(),
 consent_version text not null default 'announcements-v1',
 updated_at timestamptz not null default now()
);
create index announcement_subscribers on announcement_subscriptions(user_id) where enabled=true;
create table broadcasts (
 id uuid primary key,
 content jsonb not null,
 version integer not null default 1,
 status text not null default 'draft' check(status in ('draft','queued','cancelled')),
 created_by uuid references team_members(id) on delete set null,
 created_at timestamptz not null default now(),
 sent_at timestamptz,
 recipient_count integer not null default 0,
 sent_count integer not null default 0,
 failed_count integer not null default 0,
 skipped_count integer not null default 0
);
create index broadcasts_created on broadcasts(created_at desc,id);
create index broadcast_deliveries on outbox_events(aggregate_id,created_at) where topic='user.broadcast';
