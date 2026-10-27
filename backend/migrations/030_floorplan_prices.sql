alter table catalog_property_floorplans
 add column price_to numeric,
 add column is_exact boolean not null default false;
alter table catalog_property_floorplans add constraint floorplan_price_range
 check (price_to is null or (price_from is not null and price_to>=price_from));
