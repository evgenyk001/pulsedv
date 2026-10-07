alter table catalog_properties add column freshness jsonb not null default '{}'::jsonb;
alter table leads add column finance jsonb not null default '{}'::jsonb;
