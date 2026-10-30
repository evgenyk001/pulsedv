-- Additive metadata; existing projects/plans remain valid and unassigned.
alter table catalog_property_floorplans add column if not exists building_id text;
alter table catalog_property_floorplans add column if not exists section_label text;
create index if not exists catalog_floorplans_building_idx on catalog_property_floorplans(property_id,building_id);
