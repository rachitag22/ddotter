-- Drop the redundant bike_lane_project source (duplicates the projects table).
-- Add project_id FK so inventory segments can link to their DDOT project.

-- 1. Remove existing bike_lane_project rows
delete from public.bike_network where source = 'bike_lane_project';

-- 2. Tighten the source constraint to the three remaining sources
alter table public.bike_network
  drop constraint bike_network_source_check,
  add constraint bike_network_source_check check (source in (
    'bike_lane_inventory',
    'bike_trail',
    'planned_trail'
  ));

-- 3. Add optional project_id FK (populated later via name-slug matching)
alter table public.bike_network
  add column if not exists project_id text references public.projects(id) on delete set null;

create index if not exists bike_network_project_id_idx on public.bike_network (project_id);
