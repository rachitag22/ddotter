alter table public.features
  drop constraint if exists features_source_type_check;

alter table public.features
  add constraint features_source_type_check
  check (source_type in ('capital_project', 'bike_lane', 'trail_project', 'art_installation'));

create schema if not exists private;

create table if not exists private.sync_secrets (
  key text primary key,
  secret_hash text not null,
  updated_at timestamptz not null default now()
);

create or replace function private.sync_request_authorized()
returns boolean
language plpgsql
security definer
set search_path = private, public
as $$
declare
  headers jsonb := '{}'::jsonb;
  provided_secret text := '';
begin
  begin
    headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  exception
    when others then
      headers := '{}'::jsonb;
  end;

  provided_secret := coalesce(headers ->> 'x-sync-secret', '');

  return exists (
    select 1
    from private.sync_secrets
    where key = 'arcgis_sync'
      and secret_hash = encode(digest(provided_secret, 'sha256'), 'hex')
  );
end;
$$;

grant usage on schema private to anon;
grant execute on function private.sync_request_authorized() to anon;

drop policy if exists "Secret sync can insert features" on public.features;
drop policy if exists "Secret sync can update features" on public.features;
drop policy if exists "Secret sync can insert sync logs" on public.sync_log;

create policy "Secret sync can insert features"
  on public.features for insert
  to anon
  with check (private.sync_request_authorized());

create policy "Secret sync can update features"
  on public.features for update
  to anon
  using (private.sync_request_authorized())
  with check (private.sync_request_authorized());

create policy "Secret sync can insert sync logs"
  on public.sync_log for insert
  to anon
  with check (private.sync_request_authorized());
