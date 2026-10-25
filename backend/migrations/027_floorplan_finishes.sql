alter table catalog_property_floorplans
  add column if not exists finish_type text;

alter table catalog_property_floorplans
  drop constraint if exists catalog_floorplan_finish_type_check;

alter table catalog_property_floorplans
  add constraint catalog_floorplan_finish_type_check
  check (finish_type is null or finish_type in ('rough','white_box','finished','unfinished'));
