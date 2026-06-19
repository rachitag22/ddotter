create extension if not exists pgcrypto;

create table if not exists public.features (
  id text primary key,
  source_type text not null,
  source_id text not null,
  name text not null,
  status text not null default 'unknown',
  ward text,
  mode text,
  description text,
  timeline_start date,
  timeline_end date,
  cost numeric,
  official_url text,
  geometry jsonb not null,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  constraint features_status_check check (status in ('active', 'planned', 'complete', 'unknown')),
  constraint features_source_type_check check (source_type in ('capital_project', 'trail_project', 'art_installation'))
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  feature_id text not null references public.features(id) on delete cascade,
  support boolean not null,
  comment text not null,
  name text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.sync_log (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  status text not null,
  records_seen integer not null default 0,
  records_upserted integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz not null default now(),
  constraint sync_log_status_check check (status in ('success', 'error'))
);

create index if not exists features_source_type_idx on public.features (source_type);
create index if not exists features_status_idx on public.features (status);
create index if not exists features_ward_idx on public.features (ward);
create index if not exists features_synced_at_idx on public.features (synced_at desc);
create index if not exists features_raw_gin_idx on public.features using gin (raw);
create index if not exists feedback_feature_id_idx on public.feedback (feature_id);
create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

create or replace view public.features_with_feedback
with (security_invoker = true)
as
select
  f.*,
  count(feedback.id)::integer as feedback_count,
  count(feedback.id) filter (where feedback.support)::integer as support_count,
  coalesce(
    round(
      (
        count(feedback.id) filter (where feedback.support)::numeric
        / nullif(count(feedback.id), 0)
      ) * 100
    ),
    0
  )::integer as support_percent
from public.features f
left join public.feedback on feedback.feature_id = f.id
group by f.id;

alter table public.features enable row level security;
alter table public.feedback enable row level security;
alter table public.sync_log enable row level security;

create policy "Public can read features"
  on public.features for select
  using (true);
