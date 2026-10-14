-- Prices use millions of rubles in the existing catalog/API/CSV contract.
-- Six fractional digits preserve a whole ruble; keep the original integer range.
alter table catalog_properties alter column price_from type numeric(18,6);
alter table catalog_property_floorplans alter column price_from type numeric(18,6);
