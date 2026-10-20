create table acquisition_visits (
 id uuid primary key,
 surface text not null check(surface in ('landing','miniapp')),
 source text not null,
 medium text not null default '',
 campaign text not null default '',
 content text not null default '',
 term text not null default '',
 referrer text not null default '',
 created_at timestamptz not null default now()
);
create index acquisition_visits_period on acquisition_visits(created_at, surface);
create table acquisition_clicks (
 id uuid primary key,
 visit_id uuid not null references acquisition_visits(id) on delete cascade,
 placement text not null check(placement in ('primary','social','qr')),
 created_at timestamptz not null default now()
);
create index acquisition_clicks_visit on acquisition_clicks(visit_id);
create table acquisition_sessions (
 visit_id uuid not null references acquisition_visits(id) on delete cascade,
 session_id uuid not null references sessions(id) on delete cascade,
 primary key(visit_id,session_id)
);
create index acquisition_sessions_session on acquisition_sessions(session_id);
alter table sessions add column acquisition_id uuid references acquisition_visits(id) on delete set null;
create index sessions_acquisition on sessions(acquisition_id) where acquisition_id is not null;
