-- Dedicated bike network table with proper facility type and status enums.
-- Sources: on-street lane inventory (Layer 2), DDOT lane projects (FeatureServer),
--          existing trails (Layer 4), and planned trails (Layer 1).

create table public.bike_network (
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

  constraint bike_network_source_check check (source in (
    'bike_lane_inventory',
    'bike_lane_project',
    'bike_trail',
    'planned_trail'
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

grant insert, update, delete on public.bike_network to anon;
