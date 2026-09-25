create extension if not exists pgcrypto;

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint unique,
  name text not null,
  role text not null check (role in ('owner','admin','manager')),
  cities text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint unique,
  telegram_username text,
  first_name text,
  last_name text,
  language_code text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key,
  user_id uuid references app_users(id) on delete set null,
  source text,
  medium text,
  campaign text,
  content text,
  term text,
  referrer text,
  telegram_start_param text,
  app_version text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists sessions_user_last_seen_idx
  on sessions(user_id,last_seen_at desc);

create table if not exists user_events (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  session_id uuid not null references sessions(id) on delete cascade,
  user_id uuid references app_users(id) on delete set null,
  event_type text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);

create index if not exists user_events_session_time_idx
  on user_events(session_id,occurred_at desc);
create index if not exists user_events_user_time_idx
  on user_events(user_id,occurred_at desc) where user_id is not null;
create index if not exists user_events_type_time_idx
  on user_events(event_type,occurred_at desc);
create index if not exists user_events_entity_idx
  on user_events(entity_type,entity_id,occurred_at desc)
  where entity_type is not null and entity_id is not null;
create index if not exists user_events_metadata_gin_idx
  on user_events using gin(metadata);

create table if not exists scoring_rules (
  id text primary key,
  event_type text not null,
  label text not null,
  weight integer not null,
  max_count integer not null check (max_count > 0),
  enabled boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into scoring_rules(id,event_type,label,weight,max_count,sort_order) values
('property_view','property_view','Смотрел карточки ЖК',7,5,10),
('favorite_add','favorite_add','Добавлял ЖК в избранное',16,3,20),
('favorite_remove','favorite_remove','Убирал ЖК из избранного',-8,3,30),
('catalog_filter','catalog_filter','Настраивал фильтры каталога',4,3,40),
('compare_add','compare_add','Сравнивал проекты',12,3,50),
('mortgage_program','mortgage_program','Выбирал ипотечную программу',5,2,60),
('mortgage_calculated','mortgage_calculated','Рассчитывал ипотеку',15,2,70),
('select_submit','select_submit','Прошёл PULSE Select',18,1,80),
('property_share','property_share','Делился объектом',8,2,90),
('lead_form_open','lead_form_open','Открыл форму консультации',15,2,100),
('contact_click','contact_click','Пытался связаться с PULSE.DV',20,2,110),
('lead_created','lead_created','Оставил контакт',35,1,120),
('return_visit','return_visit','Вернулся в приложение',8,2,130)
on conflict (id) do nothing;

create table if not exists lead_engine_settings (
  singleton boolean primary key default true check (singleton),
  warm_threshold integer not null default 30 check (warm_threshold between 0 and 100),
  hot_threshold integer not null default 55 check (hot_threshold between 0 and 100),
  urgent_threshold integer not null default 75 check (urgent_threshold between 0 and 100),
  updated_at timestamptz not null default now()
);
insert into lead_engine_settings(singleton) values(true) on conflict do nothing;

create table if not exists visitor_profiles (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references sessions(id) on delete cascade,
  user_id uuid references app_users(id) on delete set null,
  score integer not null default 0 check (score between 0 and 100),
  priority text not null default 'cold' check (priority in ('cold','warm','hot','urgent')),
  score_reasons jsonb not null default '[]'::jsonb,
  top_property_id text,
  city text,
  mortgage_program text,
  next_action text,
  event_count integer not null default 0,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists visitor_profiles_priority_score_idx
  on visitor_profiles(priority,score desc,last_seen_at desc);
create index if not exists visitor_profiles_user_idx
  on visitor_profiles(user_id) where user_id is not null;

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete set null,
  session_id uuid references sessions(id) on delete set null,
  source text not null,
  property_id text,
  name text not null,
  phone text not null,
  comment text,
  status text not null default 'new'
    check (status in ('new','contacted','qualified','showing','booking','deal','closed','lost')),
  manager_id uuid references team_members(id) on delete set null,
  score integer not null default 0 check (score between 0 and 100),
  priority text not null default 'cold' check (priority in ('cold','warm','hot','urgent')),
  score_reasons jsonb not null default '[]'::jsonb,
  top_property_id text,
  city text,
  mortgage_program text,
  next_action text,
  consent_at timestamptz,
  consent_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_queue_idx
  on leads(status,priority,score desc,created_at desc);
create index if not exists leads_manager_idx
  on leads(manager_id,status,updated_at desc) where manager_id is not null;
create index if not exists leads_session_idx
  on leads(session_id) where session_id is not null;

create table if not exists crm_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  profile_id uuid references visitor_profiles(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  assigned_to uuid references team_members(id) on delete set null,
  title text not null,
  reason text not null,
  priority text not null check (priority in ('warm','hot','urgent')),
  status text not null default 'today'
    check (status in ('today','in_progress','waiting','done')),
  due_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists crm_tasks_one_open_per_lead_idx
  on crm_tasks(lead_id)
  where lead_id is not null and status <> 'done';
create index if not exists crm_tasks_queue_idx
  on crm_tasks(status,priority,due_at);

create table if not exists lead_score_history (
  id bigserial primary key,
  profile_id uuid references visitor_profiles(id) on delete cascade,
  lead_id uuid references leads(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  priority text not null check (priority in ('cold','warm','hot','urgent')),
  reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists lead_score_history_profile_idx
  on lead_score_history(profile_id,created_at desc);

create table if not exists routing_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  enabled boolean not null default true,
  priority integer not null default 100,
  city text,
  source text,
  manager_id uuid not null references team_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists routing_rules_match_idx
  on routing_rules(enabled,priority,city,source);

create table if not exists outbox_events (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  aggregate_type text not null,
  aggregate_id uuid,
  payload jsonb not null default '{}'::jsonb,
  available_at timestamptz not null default now(),
  attempts integer not null default 0,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index if not exists outbox_pending_idx
  on outbox_events(available_at,created_at)
  where processed_at is null;

create or replace function pulse_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_team_members on team_members;
create trigger touch_team_members before update on team_members
for each row execute function pulse_touch_updated_at();

drop trigger if exists touch_app_users on app_users;
create trigger touch_app_users before update on app_users
for each row execute function pulse_touch_updated_at();

drop trigger if exists touch_visitor_profiles on visitor_profiles;
create trigger touch_visitor_profiles before update on visitor_profiles
for each row execute function pulse_touch_updated_at();

drop trigger if exists touch_leads on leads;
create trigger touch_leads before update on leads
for each row execute function pulse_touch_updated_at();

drop trigger if exists touch_crm_tasks on crm_tasks;
create trigger touch_crm_tasks before update on crm_tasks
for each row execute function pulse_touch_updated_at();

drop trigger if exists touch_routing_rules on routing_rules;
create trigger touch_routing_rules before update on routing_rules
for each row execute function pulse_touch_updated_at();
