create table public.project_assets (
  id          uuid    primary key default gen_random_uuid(),
  project_id  text    not null references public.projects(id) on delete cascade,
  asset_type  text    not null,
  url         text    not null,
  title       text,
  file_type   text,
  scraped_at  timestamptz not null default now(),
  constraint project_assets_asset_type_check
    check (asset_type in ('document', 'photo', 'video', 'map', 'link')),
  unique (project_id, url)
);

create index project_assets_project_id_idx on public.project_assets (project_id);

alter table public.project_assets enable row level security;

create policy "Public can read project assets"
  on public.project_assets for select using (true);

create policy "Secret sync can insert project assets"
  on public.project_assets for insert to anon
  with check (private.sync_request_authorized());

create policy "Secret sync can update project assets"
  on public.project_assets for update to anon
  using (private.sync_request_authorized())
  with check (private.sync_request_authorized());

grant insert, update on public.project_assets to anon;
