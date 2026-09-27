create index if not exists user_events_identity_time on user_events(user_id,occurred_at desc) where user_id is not null;
create unique index if not exists interest_notification_dedupe on outbox_events(aggregate_id,(payload->>'signalKey')) where topic='manager.interest_changed';
create index if not exists interest_notification_cooldown on outbox_events(aggregate_id,created_at desc) where topic='manager.interest_changed';
