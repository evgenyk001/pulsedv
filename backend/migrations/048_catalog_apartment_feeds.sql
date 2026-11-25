alter table catalog_property_floorplans add column apartment jsonb;

create table catalog_feed_state (
  property_id text primary key references catalog_properties(id) on delete cascade,
  source text not null,
  checked_at timestamptz not null default now(),
  generation timestamptz,
  successful_at timestamptz,
  error text,
  changes jsonb
);

create table catalog_feed_apartments (
  property_id text not null references catalog_feed_state(property_id) on delete cascade,
  id text not null,
  external_id text not null,
  room_label text not null,
  area_from numeric not null,
  price_from numeric not null,
  image_url text not null,
  apartment jsonb not null,
  active boolean not null default true,
  primary key(property_id,id)
);

create view catalog_public_floorplans as
  select f.id,f.property_id,f.room_label,f.area_from,f.area_to,f.price_from,f.price_to,
         f.is_exact,f.image_url,f.finish_type,f.finish_options,f.sort_order,f.apartment,f.building_id,f.section_label
  from catalog_property_floorplans f
  where not exists (select 1 from catalog_feed_state s where s.property_id=f.property_id and s.successful_at is not null)
  union all
  select f.id,f.property_id,f.room_label,f.area_from,f.area_from,f.price_from,f.price_from,
         true,f.image_url,null,'[]'::jsonb,0,f.apartment,null,null
  from catalog_feed_apartments f where f.active;

create view catalog_feed_inventory as
  select property_id,count(*)::int as available,min(price_from) as min_price
  from catalog_feed_apartments where active group by property_id;
