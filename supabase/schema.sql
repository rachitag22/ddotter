-- DC Bike Map — consolidated schema (apply in the Supabase SQL editor)
-- This is the final state of all migrations applied in order.

-- ─── Extensions ─────────────────────────────────────────────────────────────
create extension if not exists pgcrypto;

-- ─── Private schema (sync auth) ─────────────────────────────────────────────
create schema if not exists private;

create table if not exists private.sync_secrets (
  key        text primary key,
  secret_hash text not null,
  updated_at  timestamptz not null default now()
);

create or replace function private.sync_request_authorized()
returns boolean
language plpgsql
security definer
set search_path = private, public
as $$
declare
  headers         jsonb  := '{}'::jsonb;
  provided_secret text   := '';
begin
  begin
    headers := coalesce(
      nullif(current_setting('request.headers', true), '')::jsonb,
      '{}'::jsonb
    );
  exception when others then
    headers := '{}'::jsonb;
  end;

  provided_secret := coalesce(headers ->> 'x-sync-secret', '');

  return exists (
    select 1
    from private.sync_secrets
    where key = 'arcgis_sync'
      and secret_hash = encode(extensions.digest(provided_secret, 'sha256'), 'hex')
  );
end;
$$;

grant usage on schema private to anon;
grant execute on function private.sync_request_authorized() to anon;

-- ─── projects ────────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id                             text        primary key,
  source_type                    text        not null,
  source_id                      text        not null,
  name                           text        not null,
  status                         text        not null default 'unknown',
  ward                           text,
  mode                           text,
  description                    text,
  timeline_start                 date,
  timeline_end                   date,
  cost                           numeric,
  official_url                   text,
  geometry                       jsonb       not null,
  raw                            jsonb       not null default '{}'::jsonb,
  synced_at                      timestamptz not null default now(),
  last_enrichment_attempted_at   timestamptz,
  last_enriched_at               timestamptz,
  enrichment_error               text,
  constraint projects_status_check      check (status in ('active', 'planned', 'complete', 'unknown')),
  constraint projects_source_type_check check (source_type in ('capital_project', 'bike_lane', 'trail_project', 'art_installation'))
);

create index if not exists projects_source_type_idx on public.projects (source_type);
create index if not exists projects_status_idx       on public.projects (status);
create index if not exists projects_ward_idx         on public.projects (ward);
create index if not exists projects_synced_at_idx    on public.projects (synced_at desc);
create index if not exists projects_raw_gin_idx      on public.projects using gin (raw);
create index if not exists projects_type_status_idx  on public.projects (source_type, status);
create index if not exists projects_type_ward_idx    on public.projects (source_type, ward);
create index if not exists projects_last_enrichment_attempted_at_idx
  on public.projects (last_enrichment_attempted_at)
  where last_enrichment_attempted_at is null;

alter table public.projects enable row level security;

create policy "Public can read projects"
  on public.projects for select using (true);

create policy "Secret sync can insert projects"
  on public.projects for insert to anon
  with check (private.sync_request_authorized());

create policy "Secret sync can update projects"
  on public.projects for update to anon
  using  (private.sync_request_authorized())
  with check (private.sync_request_authorized());

create policy "Secret sync can delete stale projects"
  on public.projects for delete to anon
  using (private.sync_request_authorized());

grant select             on public.projects to anon, authenticated;
grant insert, update, delete on public.projects to anon;

-- ─── feedback ────────────────────────────────────────────────────────────────
create table if not exists public.feedback (
  id         uuid        primary key default gen_random_uuid(),
  project_id text        not null references public.projects(id) on delete cascade,
  support    boolean     not null,
  comment    text        not null,
  name       text,
  email      text,
  created_at timestamptz not null default now()
);

create index if not exists feedback_project_id_idx on public.feedback (project_id);
create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

create policy "Public can submit feedback"
  on public.feedback for insert to anon, authenticated
  with check (
    char_length(trim(comment)) between 3 and 1200
    and exists (
      select 1 from public.projects where projects.id = feedback.project_id
    )
  );

grant insert on public.feedback to anon, authenticated;

-- ─── sync_log ────────────────────────────────────────────────────────────────
create table if not exists public.sync_log (
  id               uuid        primary key default gen_random_uuid(),
  source_type      text        not null,
  status           text        not null,
  records_seen     integer     not null default 0,
  records_upserted integer     not null default 0,
  error_message    text,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz not null default now(),
  constraint sync_log_status_check check (status in ('success', 'error'))
);

alter table public.sync_log enable row level security;

create policy "Secret sync can insert sync logs"
  on public.sync_log for insert to anon
  with check (private.sync_request_authorized());

grant insert on public.sync_log to anon;

-- ─── projects_with_feedback view ─────────────────────────────────────────────
create or replace view public.projects_with_feedback
with (security_invoker = false)
as
select
  p.*,
  count(feedback.id)::integer as feedback_count,
  count(feedback.id) filter (where feedback.support)::integer as support_count,
  coalesce(
    round(
      (count(feedback.id) filter (where feedback.support)::numeric
       / nullif(count(feedback.id), 0)
      ) * 100
    ),
    0
  )::integer as support_percent
from public.projects p
left join public.feedback on feedback.project_id = p.id
group by p.id;

grant select on public.projects_with_feedback to anon, authenticated;

-- ─── project_assets ──────────────────────────────────────────────────────────
create table if not exists public.project_assets (
  id          uuid        primary key default gen_random_uuid(),
  project_id  text        not null references public.projects(id) on delete cascade,
  asset_type  text        not null,
  url         text        not null,
  title       text,
  file_type   text,
  scraped_at  timestamptz not null default now(),
  constraint project_assets_asset_type_check
    check (asset_type in ('document', 'photo', 'video', 'map', 'link')),
  unique (project_id, url)
);

create index if not exists project_assets_project_id_idx on public.project_assets (project_id);

alter table public.project_assets enable row level security;

create policy "Public can read project assets"
  on public.project_assets for select using (true);

create policy "Secret sync can insert project assets"
  on public.project_assets for insert to anon
  with check (private.sync_request_authorized());

create policy "Secret sync can update project assets"
  on public.project_assets for update to anon
  using  (private.sync_request_authorized())
  with check (private.sync_request_authorized());

grant select             on public.project_assets to anon, authenticated;
grant insert, update     on public.project_assets to anon;

-- ─── bike_network ────────────────────────────────────────────────────────────
create table if not exists public.bike_network (
  id            text        primary key,
  source        text        not null,
  name          text        not null,
  facility_type text        not null default 'unknown',
  status        text        not null default 'unknown',
  ward          text,
  length_m      numeric,
  geometry      jsonb       not null,
  raw           jsonb       not null default '{}'::jsonb,
  synced_at     timestamptz not null default now(),
  project_id    text        references public.projects(id) on delete set null,

  constraint bike_network_source_check check (source in (
    'bike_lane_inventory', 'bike_trail', 'planned_trail'
  )),
  constraint bike_network_facility_type_check check (facility_type in (
    'protected', 'dual_protected',
    'buffered',  'dual_buffered',
    'conventional', 'contraflow',
    'sharrow', 'shared_path', 'trail',
    'unknown'
  )),
  constraint bike_network_status_check check (status in (
    'existing', 'planned', 'under_construction', 'future', 'complete', 'unknown'
  ))
);

create index if not exists bike_network_source_idx        on public.bike_network (source);
create index if not exists bike_network_facility_type_idx on public.bike_network (facility_type);
create index if not exists bike_network_status_idx        on public.bike_network (status);
create index if not exists bike_network_ward_idx          on public.bike_network (ward);
create index if not exists bike_network_synced_at_idx     on public.bike_network (synced_at desc);
create index if not exists bike_network_project_id_idx    on public.bike_network (project_id);

alter table public.bike_network enable row level security;

create policy "Public can read bike_network"
  on public.bike_network for select using (true);

create policy "Secret sync can insert bike_network"
  on public.bike_network for insert to anon
  with check (private.sync_request_authorized());

create policy "Secret sync can update bike_network"
  on public.bike_network for update to anon
  using  (private.sync_request_authorized())
  with check (private.sync_request_authorized());

create policy "Secret sync can delete stale bike_network"
  on public.bike_network for delete to anon
  using (private.sync_request_authorized());

grant select             on public.bike_network to anon, authenticated;
grant insert, update, delete on public.bike_network to anon;

-- ─── Sync secret setup ───────────────────────────────────────────────────────
-- After running this script, insert your SYNC_SECRET hash:
--
--   insert into private.sync_secrets (key, secret_hash)
--   values (
--     'arcgis_sync',
--     encode(extensions.digest('YOUR_SYNC_SECRET_HERE', 'sha256'), 'hex')
--   );
