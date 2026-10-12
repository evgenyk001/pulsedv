create table if not exists search_profiles (
 owner text primary key,
 settings jsonb not null default '{"criteria":null,"watchFavorites":false,"telegram":false}'::jsonb,
 baseline jsonb not null default '{}'::jsonb,
 feed jsonb not null default '[]'::jsonb,
 consent_key uuid not null default gen_random_uuid(),
 last_notified_at timestamptz,
 updated_at timestamptz not null default now()
);
