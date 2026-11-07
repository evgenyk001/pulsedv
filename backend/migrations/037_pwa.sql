-- Shared identity and device subscriptions; catalog remains in its existing tables.
create table phone_identities (
 phone text primary key, user_id uuid not null references app_users(id) on delete cascade,
 verified_at timestamptz not null default now()
);
insert into phone_identities(phone,user_id)
 select '+'||regexp_replace(u.phone,'[^0-9]','','g'),min(u.id::text)::uuid
 from app_users u join telegram_contact_consent c on c.user_id=u.id and c.accepted_at is not null
 where u.phone ~ '^\+[1-9][0-9]{6,14}$'
 group by regexp_replace(u.phone,'[^0-9]','','g') having count(*)=1;
create table phone_registrations (
 user_id uuid primary key references app_users(id) on delete cascade,
 phone text not null, consent_version text not null, verified_at timestamptz not null default now()
);
create table phone_login_challenges (
 id uuid primary key, session_id uuid not null references sessions(id) on delete cascade,
 phone text not null, code_hash text not null, consent_version text not null,
 attempts integer not null default 0, expires_at timestamptz not null,
 consumed_at timestamptz, created_at timestamptz not null default now()
);
create index phone_login_limits on phone_login_challenges(phone,created_at);
create table push_subscriptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references app_users(id) on delete cascade,
 endpoint text not null unique, p256dh text not null, auth text not null,
 enabled boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index push_subscriptions_user on push_subscriptions(user_id) where enabled;
create table push_deliveries (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references outbox_events(id) on delete cascade,
 subscription_id uuid not null references push_subscriptions(id) on delete cascade,
 attempts integer not null default 0, available_at timestamptz not null default now(),
 locked_until timestamptz, lock_token uuid, delivered_at timestamptz, dead_at timestamptz,
 unique(event_id,subscription_id)
);
create index push_delivery_pending on push_deliveries(available_at) where delivered_at is null and dead_at is null;
-- Separate delivery queue: Telegram failures never prevent browser delivery and vice versa.
create function pulse_queue_web_push() returns trigger language plpgsql as $$
begin
 if new.topic in ('user.journey','user.giveaway','user.showing_reminder','user.search_updates') then
  insert into push_deliveries(event_id,subscription_id)
   select new.id,s.id from push_subscriptions s
   where s.enabled and s.user_id::text=new.payload->>'userId';
 end if;
 return new;
end $$;
create trigger pulse_web_push after insert on outbox_events for each row execute function pulse_queue_web_push();
