alter table catalog_properties add column if not exists project_details jsonb not null default '{}'::jsonb;
