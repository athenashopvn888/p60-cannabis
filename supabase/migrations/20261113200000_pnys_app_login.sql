begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'pnys_app') then
    raise exception 'pnys_app role is missing';
  end if;

  if not exists (
    select 1
      from pg_authid
     where rolname = 'pnys_app'
       and rolpassword is not null
  ) then
    raise exception 'pnys_app has no password; refusing to enable login';
  end if;
end
$$;

alter role pnys_app login nobypassrls;

commit;
