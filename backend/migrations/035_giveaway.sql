create table giveaway_campaign (
 id boolean primary key default true check(id),
 settings jsonb not null,
 version integer not null default 1
);
create sequence giveaway_ticket_numbers;
create table giveaway_entries (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references app_users(id) on delete cascade,
 phone text not null,
 rules_version integer not null,
 status text not null default 'pending' check(status in ('pending','confirmed','rejected')),
 ticket_number bigint unique,
 lead_id uuid references leads(id),
 registered_at timestamptz,
 registration_reference text,
 reviewed_by uuid references team_members(id),
 reason text,
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 unique(user_id),unique(phone),unique(lead_id),
 check(status<>'confirmed' or (ticket_number is not null and lead_id is not null and registered_at is not null))
);
create index giveaway_entries_created on giveaway_entries(created_at desc,id);
