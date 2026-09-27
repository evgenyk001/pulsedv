create table favorite_sets (
 owner text primary key,
 property_ids text[] not null default '{}',
 updated_at timestamptz not null default now(),
 check(cardinality(property_ids)<=500)
);
create table favorite_imports (
 session_id uuid primary key references sessions(id) on delete cascade
);
