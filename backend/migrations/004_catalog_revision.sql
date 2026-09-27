alter table catalog_properties add column revision integer not null default 1;
create function pulse_catalog_revision() returns trigger language plpgsql as $$
begin new.revision := old.revision + 1; return new; end;
$$;
create trigger catalog_revision before update on catalog_properties
for each row execute function pulse_catalog_revision();
