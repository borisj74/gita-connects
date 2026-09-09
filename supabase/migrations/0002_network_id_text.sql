-- Networks are created in the browser, offline, long before they reach the
-- cloud — so the client has to own the id. Older saves used a timestamp
-- string, newer ones use a UUID; both are text. Keeping one id space avoids a
-- local→cloud mapping table and makes a re-sync idempotent.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'networks'
      and column_name = 'id' and data_type = 'uuid'
  ) then
    alter table public.networks alter column id drop default;
    alter table public.networks alter column id type text using id::text;
  end if;
end;
$$;
