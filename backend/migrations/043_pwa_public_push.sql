alter table push_subscriptions add column catalog_news boolean not null default false;
alter table push_subscriptions add column app_scope text not null default 'preview' check (app_scope in ('preview','app'));

-- Keep publication history after the delivery outbox is pruned.
create table pwa_public_push_events (
 kind text not null check (kind in ('catalog', 'release')),
 event_key text not null,
 primary key (kind, event_key)
);

insert into pwa_public_push_events(kind,event_key)
select 'catalog',id from catalog_properties where status='published';

create function pulse_queue_public_push(kind text, event_key text, details jsonb)
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
 where s.enabled and ((kind='release' and s.app_scope='preview') or (kind='catalog' and s.catalog_news));
 get diagnostics deliveries = row_count;
 return deliveries;
end $$;

create function pulse_catalog_publication_push() returns trigger language plpgsql as $$
begin
 if new.status<>'published' then return new; end if;
 if TG_OP='UPDATE' and old.status='published' then return new; end if;
 perform pulse_queue_public_push('catalog',new.id,jsonb_build_object('propertyId',new.id));
 return new;
end $$;

create trigger pulse_catalog_publication_push after insert or update of status on catalog_properties
for each row execute function pulse_catalog_publication_push();
