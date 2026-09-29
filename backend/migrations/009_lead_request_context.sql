alter table leads add column if not exists request_context jsonb not null default '{}'::jsonb;

do $$
declare
  item record;
begin
  for item in
    select id,comment from leads
    where comment is not null and btrim(comment) like '{%'
  loop
    begin
      update leads
      set request_context=item.comment::jsonb,comment=null
      where id=item.id and jsonb_typeof(item.comment::jsonb)='object';
    exception when others then
      null;
    end;
  end loop;
end $$;

create index if not exists leads_request_context_gin_idx on leads using gin(request_context);
