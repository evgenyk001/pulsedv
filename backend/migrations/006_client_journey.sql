create table if not exists client_journeys (
 lead_id uuid primary key references leads(id) on delete cascade,
 revision integer not null default 0,
 document jsonb not null,
 updated_at timestamptz not null default now()
);
create table if not exists catalog_verifications (
 property_id text primary key references catalog_properties(id) on delete cascade,
 checked_at timestamptz not null default now(),
 checked_by uuid references team_members(id) on delete set null,
 note text not null default '',
 revision integer not null default 1
);
create table if not exists lead_stage_events (
 id bigserial primary key,
 lead_id uuid not null references leads(id) on delete cascade,
 status text not null,
 created_at timestamptz not null default now()
);
create index if not exists lead_stage_events_lead_idx on lead_stage_events(lead_id,status);
