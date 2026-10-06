alter table leads add column next_action_manual boolean not null default false;
-- Existing notes may have been written by a manager; preserve them conservatively.
update leads set next_action_manual=true where next_action is not null;
create table journey_uploads (
 url text primary key,
 lead_id uuid not null references leads(id) on delete cascade,
 actor text not null,
 size bigint not null check(size>0),
 created_at timestamptz not null default now(),
 attached boolean not null default false,
 ready boolean not null default false,
 metadata jsonb
);
create index journey_uploads_lead on journey_uploads(lead_id);
create index journey_uploads_expiry on journey_uploads(created_at) where attached=false;
create table journey_messages (
 id uuid primary key,
 lead_id uuid not null references leads(id) on delete cascade,
 sequence bigserial unique,
 document jsonb not null
);
create index journey_messages_history on journey_messages(lead_id,sequence desc);
insert into journey_messages(id,lead_id,document)
 select (m->>'id')::uuid,j.lead_id,m from client_journeys j,
 lateral jsonb_array_elements(coalesce(j.document->'messages','[]'::jsonb)) with ordinality as entries(m,position)
 order by j.lead_id,position;
update client_journeys set document=document-'messages';
alter table sessions add column score_refreshed_at timestamptz;
create index sessions_score_refresh on sessions(score_refreshed_at nulls first,id);

insert into journey_uploads(url,lead_id,actor,size,attached,ready,metadata)
 select document->'attachment'->>'url',lead_id,'legacy',greatest(1,(document->'attachment'->>'size')::bigint),true,true,document->'attachment'
 from journey_messages where document->'attachment'->>'url' like '/api/v1/journey-media/%'
 on conflict(url) do nothing;

create table media_cleanup (path text primary key, created_at timestamptz not null default now());

create table worker_health (name text primary key, updated_at timestamptz not null);
