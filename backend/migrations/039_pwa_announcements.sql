-- Marketing consent is independent from OS push permission and Telegram consent.
create table pwa_announcement_subscriptions (
 user_id uuid primary key references app_users(id) on delete cascade,
 enabled boolean not null default false, consent_key uuid not null default gen_random_uuid(),
 consent_version text not null, updated_at timestamptz not null default now()
);
create table pwa_announcement_receipts (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references broadcasts(id) on delete cascade,
 user_id uuid not null references app_users(id) on delete cascade, content jsonb not null,
 created_at timestamptz not null default now(), unique(campaign_id,user_id)
);
create index pwa_announcement_inbox on pwa_announcement_receipts(user_id,created_at desc);
create or replace function pulse_queue_web_push() returns trigger language plpgsql as $$
begin
 if TG_OP='UPDATE' and new.topic<>'user.showing_reminder' then return new; end if;
 if new.topic in ('user.journey','user.giveaway','user.showing_reminder','user.search_updates','user.broadcast_pwa','user.partner') then
  insert into push_deliveries(event_id,subscription_id,available_at)
   select new.id,s.id,new.available_at from push_subscriptions s where s.enabled and s.user_id::text=new.payload->>'userId'
   on conflict(event_id,subscription_id) do update set available_at=excluded.available_at,dead_at=null,locked_until=null,lock_token=null
   where push_deliveries.delivered_at is null;
 end if;
 return new;
end $$;