alter table outbox_events add column if not exists dedup_key text;
create unique index if not exists outbox_dedup_idx on outbox_events(dedup_key) where dedup_key is not null;
create index if not exists showing_reminders_pending_idx on outbox_events(aggregate_id) where processed_at is null and topic in ('manager.showing_reminder','user.showing_reminder');

alter table leads add column if not exists loss_reason text check (loss_reason in ('down_payment','mortgage_declined','postponed','other_property','no_contact','not_relevant','other'));
alter table leads add column if not exists loss_note text check (length(loss_note)<=1000);
alter table leads add column if not exists lost_at timestamptz;
-- Do not invent dates or reasons for historical losses.
create index if not exists leads_loss_period_idx on leads(lost_at,manager_id) where status='lost';
