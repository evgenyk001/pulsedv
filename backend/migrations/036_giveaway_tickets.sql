-- One application per verified customer; one ticket per distinct registered deal.
create table giveaway_tickets (
 id uuid primary key default gen_random_uuid(),
 entry_id uuid not null references giveaway_entries(id) on delete cascade,
 lead_id uuid not null unique references leads(id),
 ticket_number bigint not null unique,
 registered_at timestamptz not null,
 registration_reference text not null,
 reviewed_by uuid references team_members(id),
 created_at timestamptz not null default now()
);
create index giveaway_tickets_entry on giveaway_tickets(entry_id,ticket_number);
insert into giveaway_tickets(entry_id,lead_id,ticket_number,registered_at,registration_reference,reviewed_by)
 select id,lead_id,ticket_number,registered_at,coalesce(registration_reference,''),reviewed_by
 from giveaway_entries where ticket_number is not null and lead_id is not null and registered_at is not null;
