-- Rename features → projects and update all dependent objects.

-- 1. Drop old view (references features table)
drop view if exists public.features_with_feedback;

-- 2. Rename table
alter table public.features rename to projects;

-- 3. Rename feedback FK column
alter table public.feedback rename column feature_id to project_id;

-- 4. Rename constraints and indexes to match new table name
alter table public.projects rename constraint features_status_check to projects_status_check;
alter table public.projects rename constraint features_source_type_check to projects_source_type_check;

alter index if exists features_source_type_idx rename to projects_source_type_idx;
alter index if exists features_status_idx rename to projects_status_idx;
alter index if exists features_ward_idx rename to projects_ward_idx;
alter index if exists features_synced_at_idx rename to projects_synced_at_idx;
alter index if exists features_raw_gin_idx rename to projects_raw_gin_idx;
alter index if exists feedback_feature_id_idx rename to feedback_project_id_idx;
alter index if exists features_last_enrichment_attempted_at_idx rename to projects_last_enrichment_attempted_at_idx;

-- 5. Recreate view referencing new table/column names
create or replace view public.projects_with_feedback
with (security_invoker = true)
as
select
  p.*,
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
from public.projects p
left join public.feedback on feedback.project_id = p.id
group by p.id;

-- 6. Drop old RLS policies on features (now projects) and recreate
drop policy if exists "Public can read features" on public.projects;
drop policy if exists "Secret sync can insert features" on public.projects;
drop policy if exists "Secret sync can update features" on public.projects;
drop policy if exists "Secret sync can delete stale features" on public.projects;

create policy "Public can read projects"
  on public.projects for select
  using (true);

create policy "Secret sync can insert projects"
  on public.projects for insert
  to anon
  with check (private.sync_request_authorized());

create policy "Secret sync can update projects"
  on public.projects for update
  to anon
  using (private.sync_request_authorized())
  with check (private.sync_request_authorized());

create policy "Secret sync can delete stale projects"
  on public.projects for delete
  to anon
  using (private.sync_request_authorized());

-- 7. Re-grant table permissions
grant insert, update, delete on public.projects to anon;
