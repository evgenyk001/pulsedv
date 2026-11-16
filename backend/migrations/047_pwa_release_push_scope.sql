create or replace function pulse_queue_public_push(kind text, event_key text, details jsonb)
returns integer language plpgsql as $$
declare
 event_id uuid;
 deliveries integer;
begin
 insert into pwa_public_push_events values(kind,event_key) on conflict do nothing;
 if not found then return 0; end if;

 insert into outbox_events(topic,aggregate_type,payload,processed_at)
 values('pwa.' || kind,'pwa_public',details,now()) returning id into event_id;

 insert into push_deliveries(event_id,subscription_id)
 select event_id,s.id from push_subscriptions s
 where s.enabled and (kind='catalog' or (kind='release' and s.app_scope=coalesce(details->>'appScope','preview')));
 get diagnostics deliveries = row_count;
 return deliveries;
end $$;
