alter table client_notification_reads add column dismissed_at timestamptz;
create table client_journey_preferences (
 owner text not null,
 lead_id uuid not null references leads(id) on delete cascade,
 pinned_at timestamptz,
 hidden_at timestamptz,
 primary key(owner,lead_id)
);
