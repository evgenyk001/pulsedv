create index if not exists user_events_property_popularity_idx
 on user_events(occurred_at,entity_id)
 where event_type='property_view' and entity_id is not null;
