create table if not exists catalog_properties (
  id text primary key,
  name text not null,
  city text not null,
  district text not null default '',
  address text,
  latitude double precision,
  longitude double precision,
  price_from numeric(14,2) not null default 0,
  delivery text not null default '',
  class_name text not null default '',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  description text not null default '',
  developer_name text not null default '',
  tags jsonb not null default '[]'::jsonb,
  cover_image_url text,
  sort_order integer not null default 999,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists catalog_properties_public_idx
  on catalog_properties(status,sort_order,id);
create index if not exists catalog_properties_city_idx
  on catalog_properties(city,status,sort_order);
create index if not exists catalog_properties_price_idx
  on catalog_properties(price_from,status);

create table if not exists catalog_property_images (
  id text primary key,
  property_id text not null references catalog_properties(id) on delete cascade,
  url text not null,
  alt text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists catalog_property_images_property_idx
  on catalog_property_images(property_id,sort_order,id);

create table if not exists catalog_property_features (
  id text primary key,
  property_id text not null references catalog_properties(id) on delete cascade,
  label text not null,
  icon text not null default 'building',
  sort_order integer not null default 0
);
create index if not exists catalog_property_features_property_idx
  on catalog_property_features(property_id,sort_order,id);

create table if not exists catalog_property_floorplans (
  id text primary key,
  property_id text not null references catalog_properties(id) on delete cascade,
  room_label text not null,
  area_from numeric(10,2),
  area_to numeric(10,2),
  price_from numeric(14,2),
  image_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists catalog_property_floorplans_property_idx
  on catalog_property_floorplans(property_id,sort_order,id);
create index if not exists catalog_property_floorplans_room_price_idx
  on catalog_property_floorplans(room_label,price_from);

create table if not exists catalog_property_documents (
  id text primary key,
  property_id text not null references catalog_properties(id) on delete cascade,
  kind text not null default 'presentation' check (kind in ('presentation','document')),
  name text not null,
  url text not null,
  mime_type text,
  size_bytes bigint,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists catalog_property_documents_property_idx
  on catalog_property_documents(property_id,sort_order,id);

insert into catalog_properties(
  id,name,city,district,address,latitude,longitude,price_from,delivery,class_name,status,
  description,developer_name,tags,cover_image_url,sort_order
)
select
  p->>'id',
  coalesce(p->>'name',''),
  coalesce(p->>'city',''),
  coalesce(p->>'district',''),
  nullif(p->>'address',''),
  nullif(p->>'latitude','')::double precision,
  nullif(p->>'longitude','')::double precision,
  coalesce(nullif(p->>'priceFrom','')::numeric,0),
  coalesce(p->>'delivery',''),
  coalesce(p->>'className',''),
  coalesce(p->>'status','draft'),
  coalesce(p->>'description',''),
  coalesce(p->>'developerName',''),
  coalesce(p->'tags','[]'::jsonb),
  nullif(p->>'coverImageUrl',''),
  coalesce(nullif(p->>'sortOrder','')::integer,999)
from app_config a
cross join lateral jsonb_array_elements(coalesce(a.document->'properties','[]'::jsonb)) p
where a.singleton=true and nullif(p->>'id','') is not null
on conflict(id) do nothing;

insert into catalog_property_images(id,property_id,url,alt,sort_order)
select
  coalesce(nullif(img->>'id',''),p->>'id'||'-image-'||ord::text),
  p->>'id',
  img->>'url',
  coalesce(img->>'alt',''),
  coalesce(nullif(img->>'sortOrder','')::integer,ord::integer-1)
from app_config a
cross join lateral jsonb_array_elements(coalesce(a.document->'properties','[]'::jsonb)) p
cross join lateral jsonb_array_elements(coalesce(p->'images','[]'::jsonb)) with ordinality as t(img,ord)
where a.singleton=true and nullif(p->>'id','') is not null and nullif(img->>'url','') is not null
on conflict(id) do nothing;

insert into catalog_property_features(id,property_id,label,icon,sort_order)
select
  coalesce(nullif(feature->>'id',''),p->>'id'||'-feature-'||ord::text),
  p->>'id',
  coalesce(feature->>'label',''),
  coalesce(feature->>'icon','building'),
  coalesce(nullif(feature->>'sortOrder','')::integer,ord::integer-1)
from app_config a
cross join lateral jsonb_array_elements(coalesce(a.document->'properties','[]'::jsonb)) p
cross join lateral jsonb_array_elements(coalesce(p->'features','[]'::jsonb)) with ordinality as t(feature,ord)
where a.singleton=true and nullif(p->>'id','') is not null and coalesce(feature->>'label','')<>''
on conflict(id) do nothing;

insert into catalog_property_floorplans(id,property_id,room_label,area_from,area_to,price_from,image_url,sort_order)
select
  coalesce(nullif(plan->>'id',''),p->>'id'||'-floorplan-'||ord::text),
  p->>'id',
  coalesce(plan->>'roomLabel','1'),
  nullif(plan->>'areaFrom','')::numeric,
  nullif(plan->>'areaTo','')::numeric,
  nullif(plan->>'priceFrom','')::numeric,
  nullif(plan->>'imageUrl',''),
  coalesce(nullif(plan->>'sortOrder','')::integer,ord::integer-1)
from app_config a
cross join lateral jsonb_array_elements(coalesce(a.document->'properties','[]'::jsonb)) p
cross join lateral jsonb_array_elements(coalesce(p->'floorplans','[]'::jsonb)) with ordinality as t(plan,ord)
where a.singleton=true and nullif(p->>'id','') is not null
on conflict(id) do nothing;

drop trigger if exists touch_catalog_properties on catalog_properties;
create trigger touch_catalog_properties before update on catalog_properties
for each row execute function pulse_touch_updated_at();

drop trigger if exists touch_catalog_property_floorplans on catalog_property_floorplans;
create trigger touch_catalog_property_floorplans before update on catalog_property_floorplans
for each row execute function pulse_touch_updated_at();
